"use client"

import { useState, useRef, useEffect } from "react"

export function AvatarMenu({
  playerName,
  onChangeName,
}: {
  playerName: string
  onChangeName: (newName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(playerName)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const initial = playerName.charAt(0).toUpperCase()

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setEditing(false)
        setName(playerName)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open, playerName])

  // Auto-focus input when editing
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 20) return
    onChangeName(trimmed)
    setEditing(false)
    setOpen(false)
  }

  return (
    <div className="fixed top-4 right-4 z-40" ref={menuRef}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-10 h-10 rounded-full bg-red-200 flex items-center justify-center text-sm font-bold text-red-700 hover:bg-red-300 transition-colors shadow-md border-2 border-white"
        title={playerName}
      >
        {initial}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-red-100 overflow-hidden">
          {!editing ? (
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center text-sm font-bold text-red-700 shrink-0">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-900 truncate">{playerName}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditing(true)
                  setName(playerName)
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                ✏️ Change name
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-3 space-y-2">
              <label className="text-xs font-medium text-red-700">New name</label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:border-red-500 focus:outline-none"
                placeholder="Enter new name..."
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!name.trim() || name.trim() === playerName}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setName(playerName)
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
