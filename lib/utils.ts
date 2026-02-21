import { nanoid } from "nanoid"
import { cookies } from "next/headers"

export function generateRoomId(): string {
  // 6-char alphanumeric code
  return nanoid(6).toUpperCase()
}

export function generatePlayerId(): string {
  return nanoid(12)
}

export function getRoomUrl(roomId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return `${base}/room/${roomId}`
}

export async function getPlayerFromCookies(): Promise<{ playerId: string; playerName: string } | null> {
  const cookieStore = await cookies()
  const playerId = cookieStore.get("playerId")?.value
  const playerName = cookieStore.get("playerName")?.value
  if (!playerId || !playerName) return null
  return { playerId, playerName }
}
