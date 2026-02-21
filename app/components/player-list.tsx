"use client"

import { useState, useTransition } from "react"
import type { Envelope, Player, RoomStatus, Trade } from "@/types"

export function PlayerList({
  players,
  envelopes = [],
  trades = [],
  currentPlayerId,
  roomStatus,
  creatorId,
  onOfferTrade,
  onRemovePlayer,
  onRenamePlayer,
}: {
  players: Player[]
  envelopes?: Envelope[]
  trades?: Trade[]
  currentPlayerId: string
  roomStatus: RoomStatus
  creatorId: string
  onOfferTrade?: (toPlayerId: string) => void
  onRemovePlayer?: (targetPlayerId: string) => void
  onRenamePlayer?: (targetPlayerId: string, newName: string) => void
}) {
  const myPendingOutgoing = trades.find(
    (t) => t.fromPlayerId === currentPlayerId && t.status === "pending"
  )

  const [, startTransition] = useTransition()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameInput, setRenameInput] = useState("")
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const amCreator = currentPlayerId === creatorId
  const canManagePlayers = amCreator && roomStatus === "waiting"

  function startRename(player: Player) {
    setRenamingId(player.id)
    setRenameInput(player.name)
  }

  function submitRename(playerId: string) {
    const trimmed = renameInput.trim()
    if (trimmed && onRenamePlayer) {
      startTransition(() => onRenamePlayer(playerId, trimmed))
    }
    setRenamingId(null)
  }

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

          const isRenaming = renamingId === player.id

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                isMe ? "bg-yellow-100 border border-yellow-300" : "bg-white/60"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-sm font-bold text-red-700 shrink-0">
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  {isRenaming ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={renameInput}
                        onChange={(e) => setRenameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRename(player.id)
                          if (e.key === "Escape") setRenamingId(null)
                        }}
                        maxLength={20}
                        className="text-sm border border-red-300 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-red-400"
                      />
                      <button
                        onClick={() => submitRename(player.id)}
                        className="text-xs px-2 py-0.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-red-900 truncate">
                      {player.name}
                      {isMe && " (you)"}
                    </span>
                  )}
                  {isCreator && (
                    <span className="ml-1 text-xs text-yellow-600">Host</span>
                  )}
                </div>
                {canTrade && onOfferTrade && (
                  <button
                    onClick={() => startTransition(() => onOfferTrade(player.id))}
                    className="text-xs px-3 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium shrink-0"
                  >
                    Trade
                  </button>
                )}
                {canManagePlayers && !isMe && !isRenaming && (
                  <>
                    <button
                      onClick={() => startRename(player)}
                      className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      title="Force rename"
                    >
                      Rename
                    </button>
                    {confirmRemoveId === player.id ? (
                      <>
                        <button
                          onClick={() => {
                            startTransition(() => onRemovePlayer?.(player.id))
                            setConfirmRemoveId(null)
                          }}
                          className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-medium"
                        >
                          Sure?
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmRemoveId(player.id)}
                        className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                        title="Remove from room"
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(roomStatus === "picking" || roomStatus === "trading") && (
                  hasPicked && pickedEnvelope ? (
                    <span className="flex items-center gap-1">
                      <span className="text-xl leading-none">{pickedEnvelope.decoration}</span>
                      <span className="text-xs font-mono text-red-400">{pickedEnvelope.code}</span>
                    </span>
                  ) : roomStatus === "picking" ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      Choosing...
                    </span>
                  ) : null
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
