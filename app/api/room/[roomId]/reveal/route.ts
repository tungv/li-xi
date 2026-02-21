import { NextResponse } from "next/server"
import { revealEnvelopes } from "@/lib/game"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { playerId } = await request.json()

    if (!playerId) {
      return NextResponse.json({ error: "Player identity required" }, { status: 400 })
    }

    await revealEnvelopes(roomId, playerId)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reveal envelopes"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
