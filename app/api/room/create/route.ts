import { NextResponse } from "next/server"
import { createRoom } from "@/lib/game"
import { getRoomUrl } from "@/lib/utils"
import type { PrizeConfig } from "@/types"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { playerId, playerName, maxPlayers, prizes } = body as {
      playerId: string
      playerName: string
      maxPlayers: number
      prizes: PrizeConfig[]
    }

    if (!playerId || !playerName) {
      return NextResponse.json({ error: "Player identity required" }, { status: 400 })
    }
    if (!prizes || prizes.length === 0) {
      return NextResponse.json({ error: "At least one prize tier required" }, { status: 400 })
    }

    const roomId = await createRoom(playerId, playerName, maxPlayers || 8, prizes)

    return NextResponse.json({ roomId, url: getRoomUrl(roomId) })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create room"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
