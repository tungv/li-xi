import { NextResponse } from "next/server"
import { removePlayer } from "@/lib/game"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { playerId, targetPlayerId } = await request.json()

    if (!playerId || !targetPlayerId) {
      return NextResponse.json({ error: "Player identity and target required" }, { status: 400 })
    }

    await removePlayer(roomId, playerId, targetPlayerId)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove player"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
