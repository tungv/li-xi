"use client"

import { useState } from "react"
import { nanoid } from "nanoid"

export function NameForm({ onSubmit }: { onSubmit: (playerId: string, playerName: string) => void }) {
  const [name, setName] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const playerId = nanoid(12)
    // Store in localStorage
    localStorage.setItem("playerId", playerId)
    localStorage.setItem("playerName", trimmed)
    onSubmit(playerId, trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
      <label className="text-lg font-medium text-red-900">
        Enter your name to play
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name..."
        maxLength={20}
        className="w-64 px-4 py-3 text-lg border-2 border-red-300 rounded-xl focus:border-red-500 focus:outline-none bg-white text-center"
        autoFocus
      />
      <button
        type="submit"
        disabled={!name.trim()}
        className="px-8 py-3 bg-red-600 text-white font-bold text-lg rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg"
      >
        Join the Fun 🧧
      </button>
    </form>
  )
}
