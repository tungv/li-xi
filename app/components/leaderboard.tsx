"use client"

import type { Player, Envelope } from "@/types"

const MEDALS = ["🥇", "🥈", "🥉"]

export function Leaderboard({
  players,
  envelopes,
  currentPlayerId,
}: {
  players: Player[]
  envelopes: Envelope[]
  currentPlayerId: string
}) {
  // Map players to their envelope amount
  const rankings = players
    .map((player) => {
      const envelope = envelopes.find((e) => e.pickedBy === player.id)
      return {
        ...player,
        amount: envelope?.amount || 0,
        decoration: envelope?.decoration || "🧧",
      }
    })
    .sort((a, b) => b.amount - a.amount)

  return (
    <div className="w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center text-red-900 mb-6">
        🎉 Results 🎉
      </h2>
      <div className="space-y-3">
        {rankings.map((player, i) => {
          const isMe = player.id === currentPlayerId
          return (
            <div
              key={player.id}
              className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                i === 0
                  ? "bg-gradient-to-r from-yellow-300 to-yellow-400 border-2 border-yellow-500 shadow-lg"
                  : i === 1
                    ? "bg-gradient-to-r from-gray-200 to-gray-300 border border-gray-400"
                    : i === 2
                      ? "bg-gradient-to-r from-orange-200 to-orange-300 border border-orange-400"
                      : "bg-white/70 border border-red-200"
              } ${isMe ? "ring-2 ring-red-400 ring-offset-1" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl w-10 text-center">
                  {i < 3 ? MEDALS[i] : `#${i + 1}`}
                </span>
                <div>
                  <div className="font-semibold text-red-900">
                    {player.name}
                    {isMe && (
                      <span className="text-xs text-red-500 ml-1">(you)</span>
                    )}
                  </div>
                  <div className="text-xs text-red-700/70">
                    {player.decoration}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg text-red-900">
                  {player.amount.toLocaleString()}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
