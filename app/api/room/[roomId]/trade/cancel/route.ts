import { NextResponse } from "next/server"
import { cancelTrade } from "@/lib/game"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { playerId, tradeId } = await request.json()

    if (!playerId || !tradeId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await cancelTrade(roomId, tradeId, playerId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel trade"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
