import { NextResponse } from "next/server"
import { pickEnvelope } from "@/lib/game"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { playerId, playerName, envelopeIndex } = await request.json()

    if (!playerId || !playerName) {
      return NextResponse.json({ error: "Player identity required" }, { status: 400 })
    }
    if (envelopeIndex === undefined || envelopeIndex < 0) {
      return NextResponse.json({ error: "Valid envelope index required" }, { status: 400 })
    }

    await pickEnvelope(roomId, playerId, playerName, envelopeIndex)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to pick envelope"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
