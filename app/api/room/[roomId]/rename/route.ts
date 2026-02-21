import { NextResponse } from "next/server"
import { renamePlayer } from "@/lib/game"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { playerId, targetPlayerId, newName } = await request.json()

    if (!playerId || !targetPlayerId || !newName) {
      return NextResponse.json({ error: "Player identity, target, and new name required" }, { status: 400 })
    }

    await renamePlayer(roomId, playerId, targetPlayerId, newName)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to rename player"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
