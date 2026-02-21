"use client"

import { useEffect, useState } from "react"
import { NameForm } from "./components/name-form"
import { CreateRoomForm } from "./components/create-room-form"
import { AvatarMenu } from "./components/avatar-menu"

export default function HomePage() {
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string | null>(null)

  useEffect(() => {
    const storedId = localStorage.getItem("playerId")
    const storedName = localStorage.getItem("playerName")
    if (storedId && storedName) {
      setPlayerId(storedId)
      setPlayerName(storedName)
    }
  }, [])

  function handleNameSubmit(newPlayerId: string, newPlayerName: string) {
    setPlayerId(newPlayerId)
    setPlayerName(newPlayerName)
  }

  function handleChangeName(newName: string) {
    localStorage.setItem("playerName", newName)
    setPlayerName(newName)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {playerId && playerName && (
        <AvatarMenu playerName={playerName} onChangeName={handleChangeName} />
      )}
      <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl p-8 max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold text-red-900">🧧</h1>
          <h2 className="text-3xl font-bold text-red-900">Li Xi</h2>
          <p className="text-red-600">
            Red Envelope Game
          </p>
          <p className="text-sm text-red-400">
            Create a room, invite friends, pick envelopes, and trade!
          </p>
        </div>

        {/* Not logged in */}
        {!playerId || !playerName ? (
          <NameForm onSubmit={handleNameSubmit} />
        ) : (
          <div className="space-y-6">
            {/* Welcome */}
            <div className="text-center">
              <p className="text-red-700">
                Welcome, <span className="font-bold">{playerName}</span>!
              </p>
            </div>

            {/* Create room */}
            <div className="border-t border-red-200 pt-6">
              <h3 className="text-lg font-semibold text-red-900 text-center mb-4">
                Create a Room
              </h3>
              <CreateRoomForm playerId={playerId} playerName={playerName} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-red-300 pt-4 border-t border-red-100">
          🐴 🎠 🏇 🐎 🫏 🦄 🐲 🧧 🏮 🎆 🎋 🎊 🐍 🎇 🧨 🪭 🍊 💮 🐉 🌸 🎐 🦁 🪷
        </div>
      </div>
    </div>
  )
}
