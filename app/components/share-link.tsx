"use client"

import { useState } from "react"

export function ShareLink({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/room/${roomId}`

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 bg-white/80 rounded-xl p-3 border border-red-200">
      <input
        readOnly
        value={url}
        className="flex-1 bg-transparent text-sm text-red-900 outline-none truncate"
      />
      <button
        onClick={handleCopy}
        className="px-4 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shrink-0"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  )
}
