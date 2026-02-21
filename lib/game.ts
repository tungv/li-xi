import { redis } from "./redis"
import { realtime } from "./realtime"
import { generateRoomId } from "./utils"
import { generateEnvelopes, envelopeCode } from "./envelopes"
import type { Room, Player, Envelope, Trade, PrizeConfig, GameState } from "@/types"
import { nanoid } from "nanoid"

const ROOM_TTL = 14400 // 4 hours in seconds

// ─── Create Room ───────────────────────────────────────────────

export async function createRoom(
  creatorId: string,
  creatorName: string,
  maxPlayers: number,
  prizes: PrizeConfig[]
): Promise<string> {
  const roomId = generateRoomId()
  const now = Date.now()
  const envelopeCount = prizes.reduce((sum, p) => sum + p.count, 0)
  const totalPrize = prizes.reduce((sum, p) => sum + p.amount * p.count, 0)

  const pipe = redis.pipeline()

  pipe.hset(`room:${roomId}`, {
    id: roomId,
    creatorId,
    creatorName,
    status: "waiting",
    maxPlayers: maxPlayers.toString(),
    envelopeCount: envelopeCount.toString(),
    totalPrize: totalPrize.toString(),
    createdAt: now.toString(),
  })

  pipe.set(`room:${roomId}:config`, JSON.stringify(prizes))

  pipe.sadd(`room:${roomId}:players`, creatorId)

  pipe.hset(`room:${roomId}:player:${creatorId}`, {
    id: creatorId,
    name: creatorName,
    envelopeIndex: "-1",
    joinedAt: now.toString(),
  })

  pipe.zadd("rooms:active", { score: now, member: roomId })

  // Set TTLs
  pipe.expire(`room:${roomId}`, ROOM_TTL)
  pipe.expire(`room:${roomId}:config`, ROOM_TTL)
  pipe.expire(`room:${roomId}:players`, ROOM_TTL)
  pipe.expire(`room:${roomId}:player:${creatorId}`, ROOM_TTL)

  await pipe.exec()

  return roomId
}

// ─── Join Room ─────────────────────────────────────────────────

export async function joinRoom(
  roomId: string,
  playerId: string,
  playerName: string
): Promise<void> {
  const room = await getRoom(roomId)
  if (!room) throw new Error("Room not found")

  // Check if already in room
  const isMember = await redis.sismember(`room:${roomId}:players`, playerId)
  if (isMember) return // silently succeed

  if (room.status !== "waiting") throw new Error("Game already started")

  const playerCount = await redis.scard(`room:${roomId}:players`)
  if (playerCount >= room.maxPlayers) throw new Error("Room is full")

  const now = Date.now()
  const pipe = redis.pipeline()

  pipe.sadd(`room:${roomId}:players`, playerId)
  pipe.hset(`room:${roomId}:player:${playerId}`, {
    id: playerId,
    name: playerName,
    envelopeIndex: "-1",
    joinedAt: now.toString(),
  })
  pipe.expire(`room:${roomId}:player:${playerId}`, ROOM_TTL)

  await pipe.exec()

  await realtime.channel(`room-${roomId}`).emit("player.joined", {
    playerId,
    playerName,
  })
}

// ─── Start Game ────────────────────────────────────────────────

export async function startGame(roomId: string, creatorId: string): Promise<void> {
  const room = await getRoom(roomId)
  if (!room) throw new Error("Room not found")
  if (room.creatorId !== creatorId) throw new Error("Only the creator can start the game")
  if (room.status !== "waiting") throw new Error("Game already started")

  const configData = await redis.get(`room:${roomId}:config`)
  if (!configData) throw new Error("Room config not found")
  // Upstash auto-deserializes JSON, so configData may already be an object
  const prizes: PrizeConfig[] = typeof configData === "string" ? JSON.parse(configData) : configData as PrizeConfig[]

  const envelopes = generateEnvelopes(prizes)

  // Reset all players' envelopeIndex to -1 (clear stale state)
  const playerIds = await redis.smembers(`room:${roomId}:players`)

  const pipe = redis.pipeline()

  for (const pid of playerIds) {
    pipe.hset(`room:${roomId}:player:${pid}`, { envelopeIndex: "-1" })
  }

  for (const env of envelopes) {
    pipe.hset(`room:${roomId}:envelope:${env.index}`, {
      index: env.index.toString(),
      amount: env.amount.toString(),
      decoration: env.decoration,
      status: "available",
      pickedBy: "",
    })
    pipe.expire(`room:${roomId}:envelope:${env.index}`, ROOM_TTL)
  }

  pipe.hset(`room:${roomId}`, { status: "picking", envelopeCount: envelopes.length.toString() })

  await pipe.exec()

  await realtime.channel(`room-${roomId}`).emit("game.started", {
    envelopeCount: envelopes.length,
    decorations: envelopes.map((e) => e.decoration),
  })
}

// ─── Pick Envelope ─────────────────────────────────────────────

export async function pickEnvelope(
  roomId: string,
  playerId: string,
  playerName: string,
  envelopeIndex: number
): Promise<void> {
  const room = await getRoom(roomId)
  if (!room) throw new Error("Room not found")
  if (room.status !== "picking") throw new Error("Not in picking phase")

  // Check player hasn't already picked
  const playerData = await redis.hgetall(`room:${roomId}:player:${playerId}`)
  if (!playerData) throw new Error("Player not in room")
  if (playerData.envelopeIndex !== "-1") {
    // Check if this is stale state from the old buggy HSETNX code:
    // player has envelopeIndex set but the envelope doesn't have them as pickedBy
    const oldIdx = playerData.envelopeIndex as string
    const oldEnv = await redis.hgetall(`room:${roomId}:envelope:${oldIdx}`)
    if (oldEnv && oldEnv.pickedBy === playerId) {
      throw new Error("You already picked an envelope")
    }
    // Stale state: reset the player's pick so they can try again
    await redis.hset(`room:${roomId}:player:${playerId}`, { envelopeIndex: "-1" })
  }

  // Atomically claim the envelope: check status=available AND set to picked in one Lua script
  // This prevents two players from picking the same envelope simultaneously
  const claimScript = `
    local key = KEYS[1]
    local status = redis.call('HGET', key, 'status')
    if status ~= 'available' then
      return 0
    end
    redis.call('HSET', key, 'status', 'picked', 'pickedBy', ARGV[1])
    return 1
  `
  const claimed = await redis.eval(
    claimScript,
    [`room:${roomId}:envelope:${envelopeIndex}`],
    [playerId]
  )
  if (!claimed) throw new Error("Envelope already taken")

  // Update the player's envelope index
  await redis.hset(`room:${roomId}:player:${playerId}`, { envelopeIndex: envelopeIndex.toString() })

  await realtime.channel(`room-${roomId}`).emit("envelope.picked", {
    envelopeIndex,
    playerId,
    playerName,
  })

  // Check if all players have picked -> transition to trading
  // We verify each player's envelope actually has them as pickedBy
  // (not just that envelopeIndex is set, which could be stale)
  const playerIds = await redis.smembers(`room:${roomId}:players`)
  const playerPipe = redis.pipeline()
  for (const pid of playerIds) {
    playerPipe.hgetall(`room:${roomId}:player:${pid}`)
  }
  const playerResults = await playerPipe.exec()

  let allPicked = true
  for (const pr of playerResults) {
    const pd = pr as Record<string, string> | null
    if (!pd || pd.envelopeIndex === "-1") {
      allPicked = false
      break
    }
    // Verify the envelope actually has this player
    const env = await redis.hget(`room:${roomId}:envelope:${pd.envelopeIndex}`, "pickedBy")
    if (env !== pd.id) {
      allPicked = false
      break
    }
  }

  if (allPicked) {
    await redis.hset(`room:${roomId}`, { status: "trading" })
    await realtime.channel(`room-${roomId}`).emit("game.statusChanged", {
      status: "trading",
    })
  }
}

// ─── Offer Trade ───────────────────────────────────────────────

export async function offerTrade(
  roomId: string,
  fromPlayerId: string,
  fromPlayerName: string,
  toPlayerId: string
): Promise<string> {
  const room = await getRoom(roomId)
  if (!room) throw new Error("Room not found")
  if (room.status !== "trading") throw new Error("Not in trading phase")
  if (fromPlayerId === toPlayerId) throw new Error("Cannot trade with yourself")

  const [fromPlayer, toPlayer] = await Promise.all([
    redis.hgetall(`room:${roomId}:player:${fromPlayerId}`),
    redis.hgetall(`room:${roomId}:player:${toPlayerId}`),
  ])

  if (!fromPlayer || !toPlayer) throw new Error("Player not found")
  if (fromPlayer.envelopeIndex === "-1" || toPlayer.envelopeIndex === "-1") {
    throw new Error("Both players must have envelopes")
  }

  // Enforce one active trade at a time: block if this player already has a pending outgoing offer
  const existingTradesRaw = await redis.lrange(`room:${roomId}:trades`, 0, -1)
  const existingTrades: Trade[] = existingTradesRaw.map((t) =>
    (typeof t === "string" ? JSON.parse(t) : t) as Trade
  )
  const hasPendingOutgoing = existingTrades.some(
    (t) => t.fromPlayerId === fromPlayerId && t.status === "pending"
  )
  if (hasPendingOutgoing) {
    throw new Error("You already have a pending trade offer. Cancel it before making a new one.")
  }

  // Check if the target player already has a pending offer TO us — auto-accept it
  const matchingIncoming = existingTrades.find(
    (t) => t.fromPlayerId === toPlayerId && t.toPlayerId === fromPlayerId && t.status === "pending"
  )
  if (matchingIncoming) {
    // Auto-accept the existing incoming trade instead of creating a new one
    await respondTrade(roomId, matchingIncoming.id, fromPlayerId, true)
    return matchingIncoming.id
  }

  const tradeId = nanoid(8)
  const trade: Trade = {
    id: tradeId,
    fromPlayerId,
    fromPlayerName,
    toPlayerId,
    toPlayerName: toPlayer.name as string,
    fromEnvelopeIndex: parseInt(fromPlayer.envelopeIndex as string),
    toEnvelopeIndex: parseInt(toPlayer.envelopeIndex as string),
    status: "pending",
    createdAt: Date.now(),
  }

  await redis.lpush(`room:${roomId}:trades`, JSON.stringify(trade))
  await redis.expire(`room:${roomId}:trades`, ROOM_TTL)

  await realtime.channel(`room-${roomId}`).emit("trade.offered", {
    tradeId,
    fromPlayerId,
    fromPlayerName,
    toPlayerId,
    toPlayerName: toPlayer.name as string,
    fromEnvelopeIndex: trade.fromEnvelopeIndex,
    toEnvelopeIndex: trade.toEnvelopeIndex,
  })

  return tradeId
}

// ─── Respond to Trade ──────────────────────────────────────────

export async function respondTrade(
  roomId: string,
  tradeId: string,
  responderId: string,
  accept: boolean
): Promise<void> {
  const room = await getRoom(roomId)
  if (!room) throw new Error("Room not found")
  if (room.status !== "trading") throw new Error("Not in trading phase")

  // Find the trade in the list
  const tradesRaw = await redis.lrange(`room:${roomId}:trades`, 0, -1)
  const trades: Trade[] = tradesRaw.map((t) => (typeof t === "string" ? JSON.parse(t) : t) as Trade)
  const tradeIndex = trades.findIndex((t) => t.id === tradeId)
  if (tradeIndex === -1) throw new Error("Trade not found")

  const trade = trades[tradeIndex]
  if (trade.toPlayerId !== responderId) throw new Error("Only the recipient can respond")
  if (trade.status !== "pending") throw new Error("Trade already responded to")

  // Update trade status
  trade.status = accept ? "accepted" : "declined"
  await redis.lset(`room:${roomId}:trades`, tradeIndex, JSON.stringify(trade))

  if (accept) {
    // Get current envelope indices (may have changed from other trades)
    const [fromPlayer, toPlayer] = await Promise.all([
      redis.hgetall(`room:${roomId}:player:${trade.fromPlayerId}`),
      redis.hgetall(`room:${roomId}:player:${trade.toPlayerId}`),
    ])

    if (!fromPlayer || !toPlayer) throw new Error("Player not found")

    const fromIdx = parseInt(fromPlayer.envelopeIndex as string)
    const toIdx = parseInt(toPlayer.envelopeIndex as string)

    // Swap envelope ownership
    const pipe = redis.pipeline()
    pipe.hset(`room:${roomId}:player:${trade.fromPlayerId}`, {
      envelopeIndex: toIdx.toString(),
    })
    pipe.hset(`room:${roomId}:player:${trade.toPlayerId}`, {
      envelopeIndex: fromIdx.toString(),
    })
    pipe.hset(`room:${roomId}:envelope:${fromIdx}`, {
      pickedBy: trade.toPlayerId,
    })
    pipe.hset(`room:${roomId}:envelope:${toIdx}`, {
      pickedBy: trade.fromPlayerId,
    })
    await pipe.exec()
  }

  await realtime.channel(`room-${roomId}`).emit("trade.responded", {
    tradeId,
    accepted: accept,
    fromPlayerId: trade.fromPlayerId,
    toPlayerId: trade.toPlayerId,
    fromEnvelopeIndex: trade.fromEnvelopeIndex,
    toEnvelopeIndex: trade.toEnvelopeIndex,
  })

  // After accepting, auto-decline all other pending trades involving either player
  if (accept) {
    const involvedIds = new Set([trade.fromPlayerId, trade.toPlayerId])
    for (let i = 0; i < trades.length; i++) {
      const t = trades[i]
      if (t.id === tradeId || t.status !== "pending") continue
      if (!involvedIds.has(t.fromPlayerId) && !involvedIds.has(t.toPlayerId)) continue

      t.status = "declined"
      await redis.lset(`room:${roomId}:trades`, i, JSON.stringify(t))
      await realtime.channel(`room-${roomId}`).emit("trade.responded", {
        tradeId: t.id,
        accepted: false,
        fromPlayerId: t.fromPlayerId,
        toPlayerId: t.toPlayerId,
        fromEnvelopeIndex: t.fromEnvelopeIndex,
        toEnvelopeIndex: t.toEnvelopeIndex,
      })
    }
  }
}

// ─── Cancel Trade ──────────────────────────────────────────────

export async function cancelTrade(
  roomId: string,
  tradeId: string,
  requesterId: string
): Promise<void> {
  const room = await getRoom(roomId)
  if (!room) throw new Error("Room not found")
  if (room.status !== "trading") throw new Error("Not in trading phase")

  const tradesRaw = await redis.lrange(`room:${roomId}:trades`, 0, -1)
  const trades: Trade[] = tradesRaw.map((t) => (typeof t === "string" ? JSON.parse(t) : t) as Trade)
  const tradeIndex = trades.findIndex((t) => t.id === tradeId)
  if (tradeIndex === -1) throw new Error("Trade not found")

  const trade = trades[tradeIndex]
  if (trade.fromPlayerId !== requesterId) throw new Error("Only the sender can cancel this offer")
  if (trade.status !== "pending") throw new Error("Trade is no longer pending")

  trade.status = "cancelled"
  await redis.lset(`room:${roomId}:trades`, tradeIndex, JSON.stringify(trade))

  await realtime.channel(`room-${roomId}`).emit("trade.cancelled", {
    tradeId,
    fromPlayerId: trade.fromPlayerId,
    toPlayerId: trade.toPlayerId,
  })
}

// ─── Reveal Envelopes ──────────────────────────────────────────

export async function revealEnvelopes(
  roomId: string,
  creatorId: string
): Promise<void> {
  const room = await getRoom(roomId)
  if (!room) throw new Error("Room not found")
  if (room.creatorId !== creatorId) throw new Error("Only the creator can reveal")
  if (room.status !== "trading") throw new Error("Not in trading phase")

  // Read all envelopes
  const envelopePipe = redis.pipeline()
  for (let i = 0; i < room.envelopeCount; i++) {
    envelopePipe.hgetall(`room:${roomId}:envelope:${i}`)
  }
  const envelopeResults = await envelopePipe.exec()

  const envelopes = envelopeResults.map((e) => {
    const data = e as Record<string, string>
    return {
      index: parseInt(data.index),
      amount: parseInt(data.amount),
      decoration: data.decoration,
      pickedBy: data.pickedBy,
    }
  })

  await redis.hset(`room:${roomId}`, { status: "revealed" })

  await realtime.channel(`room-${roomId}`).emit("game.revealed", {
    envelopes,
  })
}

// ─── Reset Game ───────────────────────────────────────────────

export async function resetGame(roomId: string, creatorId: string): Promise<void> {
  const room = await getRoom(roomId)
  if (!room) throw new Error("Room not found")
  if (room.creatorId !== creatorId) throw new Error("Only the creator can reset")
  if (room.status === "waiting") return // already in lobby, nothing to reset

  const pipe = redis.pipeline()

  // Delete all envelope keys
  for (let i = 0; i < room.envelopeCount; i++) {
    pipe.del(`room:${roomId}:envelope:${i}`)
  }

  // Reset all players' envelopeIndex to -1
  const playerIds = await redis.smembers(`room:${roomId}:players`)
  for (const pid of playerIds) {
    pipe.hset(`room:${roomId}:player:${pid}`, { envelopeIndex: "-1" })
  }

  // Delete trades
  pipe.del(`room:${roomId}:trades`)

  // Reset room status and envelope count
  pipe.hset(`room:${roomId}`, { status: "waiting", envelopeCount: "0" })

  await pipe.exec()

  await realtime.channel(`room-${roomId}`).emit("game.statusChanged", {
    status: "waiting",
  })
}

// ─── Remove Player ─────────────────────────────────────────────

export async function removePlayer(
  roomId: string,
  creatorId: string,
  targetPlayerId: string
): Promise<void> {
  const room = await getRoom(roomId)
  if (!room) throw new Error("Room not found")
  if (room.creatorId !== creatorId) throw new Error("Only the creator can remove players")
  if (room.status !== "waiting") throw new Error("Players can only be removed in the lobby")
  if (targetPlayerId === creatorId) throw new Error("Creator cannot remove themselves")

  const isMember = await redis.sismember(`room:${roomId}:players`, targetPlayerId)
  if (!isMember) throw new Error("Player not in room")

  const playerData = await redis.hgetall(`room:${roomId}:player:${targetPlayerId}`)
  const playerName = playerData?.name as string | undefined

  const pipe = redis.pipeline()
  pipe.srem(`room:${roomId}:players`, targetPlayerId)
  pipe.del(`room:${roomId}:player:${targetPlayerId}`)
  await pipe.exec()

  await realtime.channel(`room-${roomId}`).emit("player.removed", {
    playerId: targetPlayerId,
    playerName: playerName ?? targetPlayerId,
  })
}

// ─── Force Rename Player ────────────────────────────────────────

export async function renamePlayer(
  roomId: string,
  creatorId: string,
  targetPlayerId: string,
  newName: string
): Promise<void> {
  const room = await getRoom(roomId)
  if (!room) throw new Error("Room not found")
  if (room.creatorId !== creatorId) throw new Error("Only the creator can rename players")
  if (room.status !== "waiting") throw new Error("Players can only be renamed in the lobby")

  const isMember = await redis.sismember(`room:${roomId}:players`, targetPlayerId)
  if (!isMember) throw new Error("Player not in room")

  const trimmed = newName.trim()
  if (!trimmed || trimmed.length > 20) throw new Error("Name must be 1–20 characters")

  await redis.hset(`room:${roomId}:player:${targetPlayerId}`, { name: trimmed })

  // If renaming the creator themselves, update creatorName in the room hash too
  if (targetPlayerId === creatorId) {
    await redis.hset(`room:${roomId}`, { creatorName: trimmed })
  }

  await realtime.channel(`room-${roomId}`).emit("player.renamed", {
    playerId: targetPlayerId,
    newName: trimmed,
  })
}

// ─── Read Helpers ──────────────────────────────────────────────

export async function getRoom(roomId: string): Promise<Room | null> {
  const data = await redis.hgetall(`room:${roomId}`)
  if (!data || Object.keys(data).length === 0) return null
  return {
    id: data.id as string,
    creatorId: data.creatorId as string,
    creatorName: data.creatorName as string,
    status: data.status as Room["status"],
    maxPlayers: parseInt(data.maxPlayers as string),
    envelopeCount: parseInt(data.envelopeCount as string),
    totalPrize: parseInt(data.totalPrize as string) || 0,
    createdAt: parseInt(data.createdAt as string),
  }
}

export async function getRoomState(roomId: string, hideAmounts: boolean = true): Promise<GameState | null> {
  const room = await getRoom(roomId)
  if (!room) return null

  const playerIds = await redis.smembers(`room:${roomId}:players`)

  // Fetch all players
  const playerPipe = redis.pipeline()
  for (const pid of playerIds) {
    playerPipe.hgetall(`room:${roomId}:player:${pid}`)
  }
  const playerResults = await playerPipe.exec()

  const players: Player[] = playerResults
    .filter((p) => p && typeof p === "object")
    .map((p) => {
      const data = p as Record<string, string>
      return {
        id: data.id,
        name: data.name,
        envelopeIndex: parseInt(data.envelopeIndex),
        joinedAt: parseInt(data.joinedAt),
      }
    })

  // Fetch envelopes
  const envelopes: Envelope[] = []
  if (room.envelopeCount > 0) {
    const envPipe = redis.pipeline()
    for (let i = 0; i < room.envelopeCount; i++) {
      envPipe.hgetall(`room:${roomId}:envelope:${i}`)
    }
    const envResults = await envPipe.exec()
    for (const e of envResults) {
      if (e && typeof e === "object") {
        const data = e as Record<string, string>
        envelopes.push({
          index: parseInt(data.index),
          amount: hideAmounts && room.status !== "revealed" ? 0 : parseInt(data.amount),
          decoration: data.decoration,
          code: envelopeCode(parseInt(data.index)),
          status: data.status as Envelope["status"],
          pickedBy: data.pickedBy,
        })
      }
    }
  }

  // Fetch trades
  const tradesRaw = await redis.lrange(`room:${roomId}:trades`, 0, -1)
  const trades: Trade[] = tradesRaw.map((t) => (typeof t === "string" ? JSON.parse(t) : t) as Trade)

  return { room, players, envelopes, trades }
}
