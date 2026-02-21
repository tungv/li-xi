import { NextResponse } from "next/server"
import { getRoomState } from "@/lib/game"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const state = await getRoomState(roomId)

    if (!state) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    return NextResponse.json(state)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get room state"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
