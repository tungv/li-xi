"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { PrizeConfig } from "@/types"

export function CreateRoomForm({
  playerId,
  playerName,
}: {
  playerId: string
  playerName: string
}) {
  const router = useRouter()
  const [maxPlayers, setMaxPlayers] = useState(6)
  const [prizes, setPrizes] = useState<PrizeConfig[]>([
    { amount: 50000, count: 2 },
    { amount: 20000, count: 4 },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function addTier() {
    setPrizes([...prizes, { amount: 10000, count: 1 }])
  }

  function removeTier(index: number) {
    setPrizes(prizes.filter((_, i) => i !== index))
  }

  function updateTier(index: number, field: keyof PrizeConfig, value: number) {
    const updated = [...prizes]
    updated[index] = { ...updated[index], [field]: value }
    setPrizes(updated)
  }

  const totalEnvelopes = prizes.reduce((sum, p) => sum + p.count, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (totalEnvelopes < 2) {
      setError("Need at least 2 envelopes")
      return
    }
    if (totalEnvelopes > 20) {
      setError("Maximum 20 envelopes")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, playerName, maxPlayers, prizes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/room/${data.roomId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto space-y-6">
      <div>
        <label className="block text-sm font-semibold text-red-900 mb-2">
          Max Players
        </label>
        <select
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          className="w-full px-4 py-2 border-2 border-red-200 rounded-lg bg-white text-red-900"
        >
          {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>
              {n} players
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-red-900 mb-2">
          Prize Tiers
        </label>
        <div className="space-y-3">
          {prizes.map((prize, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <input
                  type="number"
                  value={prize.amount || ""}
                  onChange={(e) => updateTier(i, "amount", Number(e.target.value))}
                  min={1000}
                  step={1000}
                  className="w-full px-3 py-2 border-2 border-red-200 rounded-lg bg-white text-red-900"
                  placeholder="Amount"
                />
                <p className="mt-0.5 px-1 text-xs text-red-500 tabular-nums">
                  {prize.amount.toLocaleString()}
                </p>
              </div>
              <span className="text-red-700 font-medium shrink-0">x</span>
              <input
                type="number"
                value={prize.count}
                onChange={(e) => updateTier(i, "count", Number(e.target.value))}
                min={1}
                max={10}
                className="w-16 shrink-0 px-3 py-2 border-2 border-red-200 rounded-lg bg-white text-red-900"
              />
              {prizes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTier(i)}
                  className="shrink-0 p-2 text-red-400 hover:text-red-600"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addTier}
          className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
        >
          + Add tier
        </button>
      </div>

      <div className="text-center text-sm text-red-700">
        Total: {totalEnvelopes} envelopes
      </div>

      {error && (
        <div className="text-center text-sm text-red-600 bg-red-50 p-2 rounded-lg">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-red-600 text-white font-bold text-lg rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors shadow-lg"
      >
        {loading ? "Creating..." : "Create Room 🧧"}
      </button>
    </form>
  )
}
