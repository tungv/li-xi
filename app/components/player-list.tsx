"use client"

import type { Player, RoomStatus } from "@/types"

export function PlayerList({
  players,
  currentPlayerId,
  roomStatus,
  creatorId,
  onOfferTrade,
}: {
  players: Player[]
  currentPlayerId: string
  roomStatus: RoomStatus
  creatorId: string
  onOfferTrade?: (toPlayerId: string) => void
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-red-900 uppercase tracking-wide">
        Players ({players.length})
      </h3>
      <div className="space-y-1.5">
        {players.map((player) => {
          const isMe = player.id === currentPlayerId
          const isCreator = player.id === creatorId
          const hasPicked = player.envelopeIndex !== -1
          const canTrade =
            roomStatus === "trading" &&
            !isMe &&
            hasPicked &&
            players.find((p) => p.id === currentPlayerId)?.envelopeIndex !== -1

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
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      hasPicked
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {hasPicked ? "Picked" : "Choosing..."}
                  </span>
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
