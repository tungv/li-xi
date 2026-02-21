import { redis } from "./redis"
import { realtime } from "./realtime"
import { generateRoomId } from "./utils"
import { generateEnvelopes } from "./envelopes"
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

  const pipe = redis.pipeline()

  pipe.hset(`room:${roomId}`, {
    id: roomId,
    creatorId,
    creatorName,
    status: "waiting",
    maxPlayers: maxPlayers.toString(),
    envelopeCount: envelopeCount.toString(),
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

  const configStr = await redis.get<string>(`room:${roomId}:config`)
  if (!configStr) throw new Error("Room config not found")
  const prizes: PrizeConfig[] = JSON.parse(configStr)

  const envelopes = generateEnvelopes(prizes)

  const pipe = redis.pipeline()

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

  pipe.hset(`room:${roomId}`, { status: "picking" })

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
  if (playerData.envelopeIndex !== "-1") throw new Error("You already picked an envelope")

  // Check envelope is available
  const envelope = await redis.hgetall(`room:${roomId}:envelope:${envelopeIndex}`)
  if (!envelope) throw new Error("Envelope not found")
  if (envelope.status !== "available") throw new Error("Envelope already taken")

  // Atomically claim the envelope using HSETNX
  const claimed = await redis.hsetnx(
    `room:${roomId}:envelope:${envelopeIndex}`,
    "pickedBy",
    playerId
  )
  if (!claimed) throw new Error("Envelope already taken")

  const pipe = redis.pipeline()
  pipe.hset(`room:${roomId}:envelope:${envelopeIndex}`, { status: "picked", pickedBy: playerId })
  pipe.hset(`room:${roomId}:player:${playerId}`, { envelopeIndex: envelopeIndex.toString() })
  await pipe.exec()

  await realtime.channel(`room-${roomId}`).emit("envelope.picked", {
    envelopeIndex,
    playerId,
    playerName,
  })

  // Check if all players have picked -> transition to trading
  const playerIds = await redis.smembers(`room:${roomId}:players`)
  const playerPipe = redis.pipeline()
  for (const pid of playerIds) {
    playerPipe.hget(`room:${roomId}:player:${pid}`, "envelopeIndex")
  }
  const results = await playerPipe.exec()
  const allPicked = results.every((r) => r !== "-1" && r !== null)

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
