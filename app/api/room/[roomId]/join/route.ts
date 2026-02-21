import { NextResponse } from "next/server"
import { joinRoom } from "@/lib/game"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { playerId, playerName } = await request.json()

    if (!playerId || !playerName) {
      return NextResponse.json({ error: "Player identity required" }, { status: 400 })
    }

    await joinRoom(roomId, playerId, playerName)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to join room"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
