"use client"

import { useEffect, useState } from "react"
import { GameBoard } from "./game-board"
import { NameForm } from "@/app/components/name-form"
import type { GameState } from "@/types"

export function RoomClient({
  initialState,
  roomId,
}: {
  initialState: GameState
  roomId: string
}) {
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const [state, setState] = useState(initialState)
  const [error, setError] = useState("")

  // Load identity from localStorage on mount
  useEffect(() => {
    const storedId = localStorage.getItem("playerId")
    const storedName = localStorage.getItem("playerName")
    if (storedId && storedName) {
      setPlayerId(storedId)
      setPlayerName(storedName)
    }
  }, [])

  // Auto-join when we have identity
  useEffect(() => {
    if (!playerId || !playerName || joined) return

    async function joinAndRefresh() {
      try {
        await fetch(`/api/room/${roomId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, playerName }),
        })

        // Refresh state after joining
        const res = await fetch(`/api/room/${roomId}/state`)
        if (res.ok) {
          const freshState = await res.json()
          setState(freshState)
        }

        setJoined(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to join room")
      }
    }

    joinAndRefresh()
  }, [playerId, playerName, roomId, joined])

  function handleNameSubmit(newPlayerId: string, newPlayerName: string) {
    setPlayerId(newPlayerId)
    setPlayerName(newPlayerName)
  }

  // No identity yet - show name form
  if (!playerId || !playerName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl p-8 max-w-sm w-full space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-red-900">🧧 Li Xi</h1>
            <p className="text-sm text-red-600 mt-2">
              Enter your name to join room {roomId}
            </p>
          </div>
          <NameForm onSubmit={handleNameSubmit} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">{error}</div>
      </div>
    )
  }

  if (!joined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">Joining room...</div>
      </div>
    )
  }

  return (
    <GameBoard
      initialState={state}
      playerId={playerId}
      playerName={playerName}
      roomId={roomId}
    />
  )
}
