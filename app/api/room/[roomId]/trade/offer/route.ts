import { NextResponse } from "next/server"
import { offerTrade } from "@/lib/game"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { playerId, playerName, toPlayerId } = await request.json()

    if (!playerId || !playerName || !toPlayerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const tradeId = await offerTrade(roomId, playerId, playerName, toPlayerId)

    return NextResponse.json({ tradeId })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to offer trade"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
