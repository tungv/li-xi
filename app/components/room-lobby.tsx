"use client"

import type { Player } from "@/types"
import { ShareLink } from "./share-link"
import { PlayerList } from "./player-list"

export function RoomLobby({
  roomId,
  players,
  currentPlayerId,
  creatorId,
  onStart,
  onRemovePlayer,
  onRenamePlayer,
  loading,
}: {
  roomId: string
  players: Player[]
  currentPlayerId: string
  creatorId: string
  onStart: () => void
  onRemovePlayer?: (targetPlayerId: string) => void
  onRenamePlayer?: (targetPlayerId: string, newName: string) => void
  loading: boolean
}) {
  const isCreator = currentPlayerId === creatorId

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-red-900">Waiting for players...</h2>
        <p className="text-sm text-red-700 mt-1">
          Share the link below to invite friends
        </p>
      </div>

      <ShareLink roomId={roomId} />

      <PlayerList
        players={players}
        currentPlayerId={currentPlayerId}
        roomStatus="waiting"
        creatorId={creatorId}
        onRemovePlayer={onRemovePlayer}
        onRenamePlayer={onRenamePlayer}
      />

      {isCreator && (
        <div className="text-center">
          <button
            onClick={onStart}
            disabled={loading || players.length < 2}
            className="px-8 py-3 bg-green-600 text-white font-bold text-lg rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            {loading
              ? "Starting..."
              : players.length < 2
                ? "Need at least 2 players"
                : "Start Game! 🎉"}
          </button>
        </div>
      )}

      {!isCreator && (
        <div className="text-center text-sm text-red-600">
          Waiting for the host to start the game...
        </div>
      )}
    </div>
  )
}
