"use client"

import { useState, useCallback } from "react"
import { useRealtime } from "@/lib/realtime-client"
import type { GameState, Player, Envelope, Trade, RoomStatus } from "@/types"
import { RoomLobby } from "@/app/components/room-lobby"
import { EnvelopeGrid } from "@/app/components/envelope-grid"
import { PlayerList } from "@/app/components/player-list"
import { TradePanel } from "@/app/components/trade-panel"
import { Leaderboard } from "@/app/components/leaderboard"

export function GameBoard({
  initialState,
  playerId,
  playerName,
  roomId,
}: {
  initialState: GameState
  playerId: string
  playerName: string
  roomId: string
}) {
  const [room, setRoom] = useState(initialState.room)
  const [players, setPlayers] = useState<Player[]>(initialState.players)
  const [envelopes, setEnvelopes] = useState<Envelope[]>(initialState.envelopes)
  const [trades, setTrades] = useState<Trade[]>(initialState.trades)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Subscribe to realtime events for this room
  useRealtime({
    channels: [`room-${roomId}`],
    events: [
      "player.joined",
      "player.left",
      "game.started",
      "game.statusChanged",
      "game.revealed",
      "envelope.picked",
      "trade.offered",
      "trade.responded",
    ],
    onData: (payload) => {
      const { event, data } = payload

      switch (event) {
        case "player.joined": {
          const d = data as { playerId: string; playerName: string }
          setPlayers((prev) => {
            if (prev.find((p) => p.id === d.playerId)) return prev
            return [
              ...prev,
              {
                id: d.playerId,
                name: d.playerName,
                envelopeIndex: -1,
                joinedAt: Date.now(),
              },
            ]
          })
          break
        }

        case "game.started": {
          const d = data as { envelopeCount: number; decorations: string[] }
          setRoom((prev) => ({ ...prev, status: "picking" as RoomStatus, envelopeCount: d.envelopeCount }))
          setEnvelopes(
            d.decorations.map((dec, i) => ({
              index: i,
              amount: 0,
              decoration: dec,
              status: "available" as const,
              pickedBy: "",
            }))
          )
          break
        }

        case "game.statusChanged": {
          const d = data as { status: string }
          setRoom((prev) => ({ ...prev, status: d.status as RoomStatus }))
          break
        }

        case "envelope.picked": {
          const d = data as {
            envelopeIndex: number
            playerId: string
            playerName: string
          }
          setEnvelopes((prev) =>
            prev.map((e) =>
              e.index === d.envelopeIndex
                ? { ...e, status: "picked" as const, pickedBy: d.playerId }
                : e
            )
          )
          setPlayers((prev) =>
            prev.map((p) =>
              p.id === d.playerId
                ? { ...p, envelopeIndex: d.envelopeIndex }
                : p
            )
          )
          break
        }

        case "trade.offered": {
          const d = data as {
            tradeId: string
            fromPlayerId: string
            fromPlayerName: string
            toPlayerId: string
            toPlayerName: string
            fromEnvelopeIndex: number
            toEnvelopeIndex: number
          }
          setTrades((prev) => [
            {
              id: d.tradeId,
              fromPlayerId: d.fromPlayerId,
              fromPlayerName: d.fromPlayerName,
              toPlayerId: d.toPlayerId,
              toPlayerName: d.toPlayerName,
              fromEnvelopeIndex: d.fromEnvelopeIndex,
              toEnvelopeIndex: d.toEnvelopeIndex,
              status: "pending" as const,
              createdAt: Date.now(),
            },
            ...prev,
          ])
          break
        }

        case "trade.responded": {
          const d = data as {
            tradeId: string
            accepted: boolean
            fromPlayerId: string
            toPlayerId: string
            fromEnvelopeIndex: number
            toEnvelopeIndex: number
          }
          setTrades((prev) =>
            prev.map((t) =>
              t.id === d.tradeId
                ? { ...t, status: d.accepted ? ("accepted" as const) : ("declined" as const) }
                : t
            )
          )
          if (d.accepted) {
            // Swap envelope ownership in local state
            setEnvelopes((prev) =>
              prev.map((e) => {
                if (e.pickedBy === d.fromPlayerId) return { ...e, pickedBy: d.toPlayerId }
                if (e.pickedBy === d.toPlayerId) return { ...e, pickedBy: d.fromPlayerId }
                return e
              })
            )
            setPlayers((prev) =>
              prev.map((p) => {
                if (p.id === d.fromPlayerId) {
                  const otherEnv = prev.find((pp) => pp.id === d.toPlayerId)?.envelopeIndex ?? p.envelopeIndex
                  return { ...p, envelopeIndex: otherEnv }
                }
                if (p.id === d.toPlayerId) {
                  const otherEnv = prev.find((pp) => pp.id === d.fromPlayerId)?.envelopeIndex ?? p.envelopeIndex
                  return { ...p, envelopeIndex: otherEnv }
                }
                return p
              })
            )
          }
          break
        }

        case "game.revealed": {
          const d = data as {
            envelopes: Array<{
              index: number
              amount: number
              decoration: string
              pickedBy: string
            }>
          }
          setRoom((prev) => ({ ...prev, status: "revealed" as RoomStatus }))
          setEnvelopes((prev) =>
            prev.map((e) => {
              const revealed = d.envelopes.find((r) => r.index === e.index)
              if (!revealed) return e
              return {
                ...e,
                amount: revealed.amount,
                pickedBy: revealed.pickedBy,
              }
            })
          )
          break
        }
      }
    },
  })

  const apiCall = useCallback(
    async (url: string, body: Record<string, unknown>) => {
      setError("")
      setLoading(true)
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, playerName, ...body }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        return data
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
        throw err
      } finally {
        setLoading(false)
      }
    },
    [playerId, playerName]
  )

  async function handleStart() {
    await apiCall(`/api/room/${roomId}/start`, {})
  }

  async function handlePick(envelopeIndex: number) {
    await apiCall(`/api/room/${roomId}/pick`, { envelopeIndex })
  }

  async function handleOfferTrade(toPlayerId: string) {
    await apiCall(`/api/room/${roomId}/trade/offer`, { toPlayerId })
  }

  async function handleRespondTrade(tradeId: string, accept: boolean) {
    await apiCall(`/api/room/${roomId}/trade/respond`, { tradeId, accept })
  }

  async function handleReveal() {
    await apiCall(`/api/room/${roomId}/reveal`, {})
  }

  const currentPlayer = players.find((p) => p.id === playerId)
  const hasPicked = currentPlayer ? currentPlayer.envelopeIndex !== -1 : false
  const isCreator = room.creatorId === playerId

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Room header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-red-900">🧧 Li Xi</h1>
        <p className="text-sm text-red-600 mt-1">
          Room: {roomId} | {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
        </p>
      </div>

      {error && (
        <div className="text-center text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Phase: Waiting */}
      {room.status === "waiting" && (
        <RoomLobby
          roomId={roomId}
          players={players}
          currentPlayerId={playerId}
          creatorId={room.creatorId}
          onStart={handleStart}
          loading={loading}
        />
      )}

      {/* Phase: Picking */}
      {room.status === "picking" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-red-900">
              {hasPicked
                ? "Waiting for others to pick..."
                : "Pick an envelope!"}
            </h2>
          </div>
          <EnvelopeGrid
            envelopes={envelopes}
            players={players}
            currentPlayerId={playerId}
            isRevealed={false}
            canPick={!hasPicked}
            onPick={handlePick}
          />
          <PlayerList
            players={players}
            currentPlayerId={playerId}
            roomStatus="picking"
            creatorId={room.creatorId}
          />
        </div>
      )}

      {/* Phase: Trading */}
      {room.status === "trading" && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold text-red-900">Trading Phase</h2>
            <p className="text-sm text-red-600">
              Offer trades before the big reveal!
            </p>
          </div>
          <EnvelopeGrid
            envelopes={envelopes}
            players={players}
            currentPlayerId={playerId}
            isRevealed={false}
            canPick={false}
            onPick={() => {}}
          />
          <div className="grid gap-6 md:grid-cols-2">
            <PlayerList
              players={players}
              currentPlayerId={playerId}
              roomStatus="trading"
              creatorId={room.creatorId}
              onOfferTrade={handleOfferTrade}
            />
            <TradePanel
              trades={trades}
              players={players}
              envelopes={envelopes}
              currentPlayerId={playerId}
              onRespond={handleRespondTrade}
            />
          </div>
          {isCreator && (
            <div className="text-center">
              <button
                onClick={handleReveal}
                disabled={loading}
                className="px-8 py-3 bg-yellow-500 text-white font-bold text-lg rounded-xl hover:bg-yellow-600 disabled:opacity-50 transition-colors shadow-lg"
              >
                {loading ? "Revealing..." : "Reveal All Envelopes! 🎊"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Phase: Revealed */}
      {room.status === "revealed" && (
        <div className="space-y-6">
          <EnvelopeGrid
            envelopes={envelopes}
            players={players}
            currentPlayerId={playerId}
            isRevealed={true}
            canPick={false}
            onPick={() => {}}
          />
          <Leaderboard
            players={players}
            envelopes={envelopes}
            currentPlayerId={playerId}
          />
        </div>
      )}
    </div>
  )
}
