"use client"

import type { Envelope, Player, RoomStatus, Trade } from "@/types"

export function PlayerList({
  players,
  envelopes = [],
  trades = [],
  currentPlayerId,
  roomStatus,
  creatorId,
  onOfferTrade,
}: {
  players: Player[]
  envelopes?: Envelope[]
  trades?: Trade[]
  currentPlayerId: string
  roomStatus: RoomStatus
  creatorId: string
  onOfferTrade?: (toPlayerId: string) => void
}) {
  const myPendingOutgoing = trades.find(
    (t) => t.fromPlayerId === currentPlayerId && t.status === "pending"
  )

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-red-900 uppercase tracking-wide">
        Players ({players.length})
      </h3>
      {myPendingOutgoing && roomStatus === "trading" && (
        <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
          Cancel your current offer before making a new one.
        </p>
      )}
      <div className="space-y-1.5">
        {players.map((player) => {
          const isMe = player.id === currentPlayerId
          const isCreator = player.id === creatorId
          const hasPicked = player.envelopeIndex !== -1
          const pickedEnvelope = hasPicked
            ? envelopes.find((e) => e.index === player.envelopeIndex)
            : undefined
          const canTrade =
            roomStatus === "trading" &&
            !isMe &&
            hasPicked &&
            players.find((p) => p.id === currentPlayerId)?.envelopeIndex !== -1 &&
            !myPendingOutgoing

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                isMe ? "bg-yellow-100 border border-yellow-300" : "bg-white/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-sm font-bold text-red-700">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-sm font-medium text-red-900">
                    {player.name}
                    {isMe && " (you)"}
                  </span>
                  {isCreator && (
                    <span className="ml-1 text-xs text-yellow-600">Host</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {roomStatus === "picking" && (
                  hasPicked && pickedEnvelope ? (
                    <span className="flex items-center gap-1">
                      <span className="text-xl leading-none">{pickedEnvelope.decoration}</span>
                      <span className="text-xs font-mono text-red-400">{pickedEnvelope.code}</span>
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      Choosing...
                    </span>
                  )
                )}
                {canTrade && onOfferTrade && (
                  <button
                    onClick={() => onOfferTrade(player.id)}
                    className="text-xs px-3 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium"
                  >
                    Trade
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
