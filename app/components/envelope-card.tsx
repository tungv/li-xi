"use client"

import { useState } from "react"
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
  const [picking, setPicking] = useState(false)
  const picker = envelope.pickedBy
    ? players.find((p) => p.id === envelope.pickedBy)
    : null
  const isPickedByMe = envelope.pickedBy === currentPlayerId

  async function handlePick() {
    if (!canPick || picking) return
    setPicking(true)
    try {
      await onPick()
    } finally {
      setPicking(false)
    }
  }

  // ── Revealed state ──
  if (isRevealed && envelope.pickedBy) {
    return (
      <div
        className={`relative w-28 h-40 rounded-xl border-3 flex flex-col items-center justify-center gap-1 transition-all duration-500 ${
          isPickedByMe
            ? "bg-gradient-to-b from-yellow-300 to-yellow-500 border-yellow-500 shadow-xl shadow-yellow-300/50 scale-110 -rotate-1"
            : "bg-gradient-to-b from-red-500 to-red-700 border-red-800"
        }`}
      >
        <span className="text-2xl">{envelope.decoration}</span>
        <span className="text-white font-black text-xl drop-shadow">
          {envelope.amount.toLocaleString()}
        </span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          isPickedByMe
            ? "bg-yellow-700/30 text-yellow-900"
            : "bg-black/20 text-white/90"
        }`}>
          {isPickedByMe ? "YOU" : picker?.name || "?"}
        </span>
      </div>
    )
  }

  // ── Revealed but unpicked ──
  if (isRevealed && !envelope.pickedBy) {
    return (
      <div className="relative w-28 h-40 rounded-xl border-2 border-gray-300 bg-gray-100 flex flex-col items-center justify-center gap-2 opacity-50">
        <span className="text-2xl grayscale">{envelope.decoration}</span>
        <span className="text-gray-500 text-sm font-bold">
          {envelope.amount.toLocaleString()}
        </span>
        <span className="text-[10px] text-gray-400">Unclaimed</span>
      </div>
    )
  }

  // ── Picked by me (not revealed) ──
  if (envelope.status === "picked" && isPickedByMe) {
    return (
      <div className="relative w-28 h-40 rounded-xl border-3 border-yellow-400 bg-gradient-to-b from-yellow-300 to-yellow-500 flex flex-col items-center justify-center gap-2 shadow-lg shadow-yellow-300/40">
        <span className="text-3xl">{envelope.decoration}</span>
        <span className="bg-yellow-700/30 text-yellow-900 text-[11px] font-bold px-3 py-1 rounded-full">
          YOUR PICK
        </span>
        <span className="text-yellow-800/60 text-[10px]">? ? ?</span>
      </div>
    )
  }

  // ── Picked by someone else (not revealed) ──
  if (envelope.status === "picked") {
    return (
      <div className="relative w-28 h-40 rounded-xl border-2 border-red-300 bg-gradient-to-b from-red-300 to-red-400 flex flex-col items-center justify-center gap-2 opacity-60">
        <span className="text-2xl">{envelope.decoration}</span>
        <div className="w-7 h-7 rounded-full bg-white/80 flex items-center justify-center text-xs font-bold text-red-700">
          {picker?.name?.charAt(0).toUpperCase() || "?"}
        </div>
        <span className="text-[10px] text-white/80 font-medium truncate max-w-[90%]">
          {picker?.name || "Taken"}
        </span>
      </div>
    )
  }

  // ── Available envelope ──
  return (
    <button
      onClick={handlePick}
      disabled={!canPick || picking}
      className={`relative w-28 h-40 rounded-xl border-3 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
        picking
          ? "bg-gradient-to-b from-yellow-400 to-yellow-500 border-yellow-500 scale-95 animate-pulse"
          : canPick
            ? "bg-gradient-to-b from-red-500 to-red-700 border-yellow-400 hover:scale-110 hover:shadow-xl hover:shadow-red-300/40 hover:-rotate-2 cursor-pointer active:scale-95"
            : "bg-gradient-to-b from-red-500 to-red-700 border-red-800 cursor-default"
      }`}
    >
      <span className={`text-4xl drop-shadow-md transition-transform ${canPick ? "group-hover:scale-110" : ""}`}>
        {envelope.decoration}
      </span>

      {/* Gold corner flourishes */}
      <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-yellow-400/70 rounded-tl" />
      <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-yellow-400/70 rounded-tr" />
      <div className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-yellow-400/70 rounded-bl" />
      <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-yellow-400/70 rounded-br" />

      {/* Label */}
      <div className="absolute bottom-2 left-0 right-0 text-center">
        {picking ? (
          <span className="text-[10px] text-yellow-900 font-bold">Picking...</span>
        ) : canPick ? (
          <span className="text-[10px] text-yellow-300 font-bold animate-pulse">TAP TO PICK</span>
        ) : null}
      </div>
    </button>
  )
}
