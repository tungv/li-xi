import { NextResponse } from "next/server"
import { respondTrade } from "@/lib/game"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { playerId, tradeId, accept } = await request.json()

    if (!playerId || !tradeId || accept === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await respondTrade(roomId, tradeId, playerId, accept)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to respond to trade"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
