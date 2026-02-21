import { getRoomState } from "@/lib/game"
import { GameBoard } from "./game-board"
import { RoomClient } from "./room-client"

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  const state = await getRoomState(roomId)

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-900">Room not found</h1>
          <p className="text-red-600">This room may have expired or doesn&apos;t exist.</p>
          <a
            href="/"
            className="inline-block px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    )
  }

  return <RoomClient initialState={state} roomId={roomId} />
}
