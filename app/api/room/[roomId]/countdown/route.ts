import { NextResponse } from "next/server"
import { startCountdown, cancelCountdown } from "@/lib/game"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { playerId, action, countdown } = await request.json()

    if (!playerId) {
      return NextResponse.json({ error: "Player identity required" }, { status: 400 })
    }

    if (action === "start") {
      await startCountdown(roomId, playerId, countdown ?? 3)
    } else if (action === "cancel") {
      await cancelCountdown(roomId, playerId)
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
