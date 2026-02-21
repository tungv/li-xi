"use client"

import { useState, useCallback } from "react"
import { useRealtime } from "@/lib/realtime-client"
import type { GameState, Player, Envelope, Trade, RoomStatus } from "@/types"
import { envelopeCode } from "@/lib/envelopes"
import { RoomLobby } from "@/app/components/room-lobby"
import { EnvelopeGrid } from "@/app/components/envelope-grid"
import { PlayerList } from "@/app/components/player-list"
import { TradePanel } from "@/app/components/trade-panel"
import { Leaderboard } from "@/app/components/leaderboard"

// ── Phase Indicator (dot stepper) ──────────────────────────────
const PHASES = ["waiting", "picking", "trading", "revealed"] as const
const PHASE_LABELS = { waiting: "Lobby", picking: "Picking", trading: "Trading", revealed: "Revealed" }

function PhaseIndicator({ status }: { status: RoomStatus }) {
  const currentIdx = PHASES.indexOf(status)
  return (
    <div className="flex items-center justify-center gap-1">
      {PHASES.map((phase, i) => (
        <div key={phase} className="flex items-center gap-1">
          <div className="flex flex-col items-center">
            <div
              className={`w-3 h-3 rounded-full transition-all ${
                i < currentIdx
                  ? "bg-green-500"
                  : i === currentIdx
                    ? "bg-red-600 ring-2 ring-red-300 ring-offset-1"
                    : "bg-gray-300"
              }`}
            />
            <span
              className={`text-[10px] mt-0.5 ${
                i === currentIdx ? "text-red-700 font-bold" : "text-gray-400"
              }`}
            >
              {PHASE_LABELS[phase]}
            </span>
          </div>
          {i < PHASES.length - 1 && (
            <div
              className={`w-8 h-0.5 mb-3 ${
                i < currentIdx ? "bg-green-400" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Picking Progress Bar ───────────────────────────────────────

function PickingProgress({ players }: { players: Player[] }) {
  const picked = players.filter((p) => p.envelopeIndex !== -1).length
  const total = players.length
  const pct = total > 0 ? (picked / total) * 100 : 0

  return (
    <div className="bg-white/80 rounded-xl p-3 border border-red-100">
      <div className="flex justify-between text-xs text-red-700 mb-1.5 font-medium">
        <span>Players picked</span>
        <span>
          {picked} / {total}
        </span>
      </div>
      <div className="h-2.5 bg-red-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-red-500 to-yellow-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {picked === total && (
        <p className="text-xs text-green-600 mt-1.5 text-center font-semibold">
          All players picked! Moving to trading...
        </p>
      )}
    </div>
  )
}

// ── Main Game Board ────────────────────────────────────────────

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
              code: envelopeCode(i),
              status: "available" as const,
              pickedBy: "",
            }))
          )
          break
        }

        case "game.statusChanged": {
          const d = data as { status: string }
          setRoom((prev) => ({ ...prev, status: d.status as RoomStatus }))
          // If reset to waiting, clear envelopes, trades, and player picks
          if (d.status === "waiting") {
            setEnvelopes([])
            setTrades([])
            setPlayers((prev) =>
              prev.map((p) => ({ ...p, envelopeIndex: -1 }))
            )
          }
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

  async function handleReset() {
    await apiCall(`/api/room/${roomId}/reset`, {})
  }

  const currentPlayer = players.find((p) => p.id === playerId)
  const hasPicked = currentPlayer ? currentPlayer.envelopeIndex !== -1 : false
  const isCreator = room.creatorId === playerId

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Room header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-red-900">🧧 Lì Xì</h1>
        <p className="text-xs text-red-400 font-mono">Room {roomId}</p>
        <PhaseIndicator status={room.status} />
        {isCreator && room.status !== "waiting" && (
          <button
            onClick={handleReset}
            disabled={loading}
            className="mt-1 px-4 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:text-red-700 disabled:opacity-50 transition-colors"
          >
            Reset to Lobby
          </button>
        )}
      </div>

      {/* Error banner (dismissible) */}
      {error && (
        <div className="flex items-center justify-between text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="ml-2 text-red-400 hover:text-red-600 font-bold"
          >
            ×
          </button>
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
        <div className="space-y-4">
          {/* Instruction banner */}
          {!hasPicked ? (
            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-3 text-center animate-pulse">
              <p className="text-yellow-800 font-bold text-sm">
                👆 Tap a red envelope to pick it!
              </p>
              <p className="text-yellow-600 text-xs mt-0.5">
                You can only pick one — choose wisely!
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-300 rounded-xl p-3 text-center">
              <p className="text-green-800 font-bold text-sm">
                ✓ You picked your envelope!
              </p>
              <p className="text-green-600 text-xs mt-0.5">
                Waiting for other players to pick theirs...
              </p>
            </div>
          )}

          <PickingProgress players={players} />

          <EnvelopeGrid
            envelopes={envelopes}
            players={players}
            currentPlayerId={playerId}
            isRevealed={false}
            canPick={!hasPicked && !loading}
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
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <p className="text-blue-800 font-bold text-sm">
              🔄 Trading Phase
            </p>
            <p className="text-blue-600 text-xs mt-0.5">
              {isCreator
                ? "Players can trade envelopes. Press Reveal when ready!"
                : "Offer trades to other players before the host reveals!"}
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
          <div className="grid gap-4 md:grid-cols-2">
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
            <div className="text-center pt-2">
              <button
                onClick={handleReveal}
                disabled={loading}
                className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold text-lg rounded-xl hover:from-yellow-600 hover:to-yellow-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              >
                {loading ? "Revealing..." : "Reveal All Envelopes! 🎊"}
              </button>
            </div>
          )}
          {!isCreator && (
            <div className="text-center">
              <p className="text-xs text-gray-400">
                Waiting for {room.creatorName} to reveal the envelopes...
              </p>
            </div>
          )}
        </div>
      )}

      {/* Phase: Revealed */}
      {room.status === "revealed" && (
        <div className="space-y-5">
          <div className="bg-gradient-to-r from-yellow-50 to-red-50 border border-yellow-200 rounded-xl p-3 text-center">
            <p className="text-red-800 font-bold text-sm">
              🎊 Envelopes Revealed!
            </p>
          </div>
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
          <div className="text-center pt-2 space-y-3">
            {isCreator && (
              <button
                onClick={handleReset}
                disabled={loading}
                className="px-6 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                Play Again in This Room
              </button>
            )}
            <div>
              <a
                href="/"
                className="px-6 py-2.5 inline-block text-sm font-bold text-white bg-gradient-to-r from-red-600 to-red-700 rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl"
              >
                Create New Room 🧧
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
