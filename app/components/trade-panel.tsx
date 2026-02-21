"use client"

import type { Trade, Player, Envelope } from "@/types"

export function TradePanel({
  trades,
  players,
  envelopes,
  currentPlayerId,
  onRespond,
}: {
  trades: Trade[]
  players: Player[]
  envelopes: Envelope[]
  currentPlayerId: string
  onRespond: (tradeId: string, accept: boolean) => void
}) {
  const pendingForMe = trades.filter(
    (t) => t.toPlayerId === currentPlayerId && t.status === "pending"
  )
  const pendingFromMe = trades.filter(
    (t) => t.fromPlayerId === currentPlayerId && t.status === "pending"
  )
  const completed = trades.filter((t) => t.status !== "pending").slice(0, 10)

  function getPlayerName(id: string) {
    return players.find((p) => p.id === id)?.name || "Unknown"
  }

  function getEnvelopeDecoration(index: number) {
    return envelopes.find((e) => e.index === index)?.decoration || "🧧"
  }

  if (trades.length === 0) {
    return (
      <div className="text-center text-sm text-red-400 py-4">
        No trades yet. Offer a trade to another player!
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {pendingForMe.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-red-900 uppercase tracking-wide">
            Incoming Offers
          </h4>
          {pendingForMe.map((trade) => (
            <div
              key={trade.id}
              className="flex items-center justify-between bg-yellow-50 border border-yellow-300 rounded-lg p-3"
            >
              <div className="text-sm text-red-900">
                <span className="font-medium">{getPlayerName(trade.fromPlayerId)}</span>
                {" wants to trade "}
                <span className="text-lg">{getEnvelopeDecoration(trade.fromEnvelopeIndex)}</span>
                {" for your "}
                <span className="text-lg">{getEnvelopeDecoration(trade.toEnvelopeIndex)}</span>
              </div>
              <div className="flex gap-2 ml-3 shrink-0">
                <button
                  onClick={() => onRespond(trade.id, true)}
                  className="px-3 py-1 text-xs font-bold bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Accept
                </button>
                <button
                  onClick={() => onRespond(trade.id, false)}
                  className="px-3 py-1 text-xs font-bold bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingFromMe.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-red-900 uppercase tracking-wide">
            Your Offers
          </h4>
          {pendingFromMe.map((trade) => (
            <div
              key={trade.id}
              className="flex items-center justify-between bg-white/60 border border-red-200 rounded-lg p-3"
            >
              <div className="text-sm text-red-900">
                {"Waiting for "}
                <span className="font-medium">{getPlayerName(trade.toPlayerId)}</span>
                {" to respond..."}
              </div>
              <span className="text-xs text-yellow-600 font-medium">Pending</span>
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-red-900 uppercase tracking-wide">
            Trade History
          </h4>
          {completed.map((trade) => (
            <div
              key={trade.id}
              className="text-xs text-red-700 bg-white/40 rounded-lg px-3 py-2"
            >
              {getPlayerName(trade.fromPlayerId)}
              {" & "}
              {getPlayerName(trade.toPlayerId)}
              {" — "}
              <span
                className={
                  trade.status === "accepted" ? "text-green-600" : "text-gray-500"
                }
              >
                {trade.status === "accepted" ? "Traded!" : "Declined"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
