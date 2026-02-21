import { Realtime, type InferRealtimeEvents } from "@upstash/realtime"
import { redis } from "./redis"
import z from "zod/v4"

const schema = {
  player: {
    joined: z.object({
      playerId: z.string(),
      playerName: z.string(),
    }),
    left: z.object({
      playerId: z.string(),
    }),
    removed: z.object({
      playerId: z.string(),
      playerName: z.string(),
    }),
    renamed: z.object({
      playerId: z.string(),
      newName: z.string(),
    }),
  },
  game: {
    started: z.object({
      envelopeCount: z.number(),
      decorations: z.array(z.string()),
    }),
    revealed: z.object({
      envelopes: z.array(
        z.object({
          index: z.number(),
          amount: z.number(),
          decoration: z.string(),
          pickedBy: z.string(),
        })
      ),
    }),
    statusChanged: z.object({
      status: z.string(),
    }),
  },
  envelope: {
    picked: z.object({
      envelopeIndex: z.number(),
      playerId: z.string(),
      playerName: z.string(),
    }),
  },
  trade: {
    offered: z.object({
      tradeId: z.string(),
      fromPlayerId: z.string(),
      fromPlayerName: z.string(),
      toPlayerId: z.string(),
      toPlayerName: z.string(),
      fromEnvelopeIndex: z.number(),
      toEnvelopeIndex: z.number(),
    }),
    responded: z.object({
      tradeId: z.string(),
      accepted: z.boolean(),
      fromPlayerId: z.string(),
      toPlayerId: z.string(),
      fromEnvelopeIndex: z.number(),
      toEnvelopeIndex: z.number(),
    }),
    cancelled: z.object({
      tradeId: z.string(),
      fromPlayerId: z.string(),
      toPlayerId: z.string(),
    }),
  },
}

export const realtime = new Realtime({
  schema,
  redis,
  history: {
    maxLength: 200,
    expireAfterSecs: 14400, // 4 hours
  },
})

export type RealtimeEvents = InferRealtimeEvents<typeof realtime>
