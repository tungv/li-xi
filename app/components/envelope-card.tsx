"use client"

import type { Envelope, Player } from "@/types"

export function EnvelopeCard({
  envelope,
  players,
  currentPlayerId,
  isRevealed,
  canPick,
  onPick,
}: {
  envelope: Envelope
  players: Player[]
  currentPlayerId: string
  isRevealed: boolean
  canPick: boolean
  onPick: () => void
}) {
  const picker = envelope.pickedBy
    ? players.find((p) => p.id === envelope.pickedBy)
    : null
  const isPickedByMe = envelope.pickedBy === currentPlayerId
  const isAvailable = envelope.status === "available"

  if (isRevealed && envelope.pickedBy) {
    // Revealed state - show amount
    return (
      <div
        className={`relative w-28 h-36 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all duration-500 ${
          isPickedByMe
            ? "bg-gradient-to-b from-yellow-400 to-yellow-500 border-yellow-600 shadow-lg shadow-yellow-200 scale-105"
            : "bg-gradient-to-b from-red-500 to-red-600 border-red-700"
        }`}
      >
        <span className="text-2xl">{envelope.decoration}</span>
        <span className="text-white font-bold text-lg">
          {envelope.amount.toLocaleString()}
        </span>
        {picker && (
          <span className="text-xs text-white/80 truncate max-w-[90%]">
            {isPickedByMe ? "You" : picker.name}
          </span>
        )}
      </div>
    )
  }

  if (envelope.status === "picked") {
    // Picked but not revealed
    return (
      <div
        className={`relative w-28 h-36 rounded-xl border-2 flex flex-col items-center justify-center gap-2 ${
          isPickedByMe
            ? "bg-gradient-to-b from-yellow-400 to-yellow-500 border-yellow-600 shadow-lg shadow-yellow-200"
            : "bg-gradient-to-b from-red-400 to-red-500 border-red-600 opacity-80"
        }`}
      >
        <span className="text-3xl">{envelope.decoration}</span>
        <span className="text-xs font-medium text-white/90">
          {isPickedByMe ? "Yours!" : picker?.name || "Taken"}
        </span>
      </div>
    )
  }

  // Available envelope
  return (
    <button
      onClick={onPick}
      disabled={!canPick}
      className={`relative w-28 h-36 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
        canPick
          ? "bg-gradient-to-b from-red-500 to-red-700 border-yellow-500 hover:scale-110 hover:shadow-xl hover:shadow-red-200 cursor-pointer active:scale-95"
          : "bg-gradient-to-b from-red-500 to-red-700 border-red-600 opacity-60 cursor-default"
      }`}
    >
      <span className="text-4xl drop-shadow-md">{envelope.decoration}</span>
      <div className="absolute bottom-2 left-0 right-0 text-center">
        <span className="text-[10px] text-yellow-300/80 font-medium">
          {canPick ? "Tap to pick" : ""}
        </span>
      </div>
      {/* Decorative gold corner flourishes */}
      <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-yellow-400/60 rounded-tl" />
      <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-yellow-400/60 rounded-tr" />
      <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-yellow-400/60 rounded-bl" />
      <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-yellow-400/60 rounded-br" />
    </button>
  )
}
