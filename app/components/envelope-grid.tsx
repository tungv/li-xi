"use client"

import type { Envelope, Player } from "@/types"
import { EnvelopeCard } from "./envelope-card"

export function EnvelopeGrid({
  envelopes,
  players,
  currentPlayerId,
  isRevealed,
  canPick,
  onPick,
}: {
  envelopes: Envelope[]
  players: Player[]
  currentPlayerId: string
  isRevealed: boolean
  canPick: boolean
  onPick: (index: number) => void
}) {
  return (
    <div className="flex flex-wrap justify-center gap-4 p-4">
      {envelopes.map((envelope) => (
        <EnvelopeCard
          key={envelope.index}
          envelope={envelope}
          players={players}
          currentPlayerId={currentPlayerId}
          isRevealed={isRevealed}
          canPick={canPick && envelope.status === "available"}
          onPick={() => onPick(envelope.index)}
        />
      ))}
    </div>
  )
}
