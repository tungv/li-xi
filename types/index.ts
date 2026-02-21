export type RoomStatus = "waiting" | "picking" | "trading" | "revealed"

export interface Room {
  id: string
  creatorId: string
  creatorName: string
  status: RoomStatus
  maxPlayers: number
  envelopeCount: number
  createdAt: number
}

export interface PrizeConfig {
  amount: number
  count: number
}

export interface Player {
  id: string
  name: string
  envelopeIndex: number // -1 = hasn't picked
  joinedAt: number
}

export interface Envelope {
  index: number
  amount: number // 0 until revealed
  decoration: string
  code: string // short identifier e.g. "E01"
  status: "available" | "picked"
  pickedBy: string
}

export interface Trade {
  id: string
  fromPlayerId: string
  fromPlayerName: string
  toPlayerId: string
  toPlayerName: string
  fromEnvelopeIndex: number
  toEnvelopeIndex: number
  status: "pending" | "accepted" | "declined"
  createdAt: number
}

export interface GameState {
  room: Room
  players: Player[]
  envelopes: Envelope[]
  trades: Trade[]
}
