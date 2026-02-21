import type { PrizeConfig, Envelope } from "@/types"

/** Returns a short, human-readable code for an envelope, e.g. "E01" */
export function envelopeCode(index: number): string {
  return `E${(index + 1).toString().padStart(2, "0")}`
}

export const HORSE_DECORATIONS = [
  "🐴", // Horse Face
  "🎠", // Carousel Horse
  "🏇", // Horse Racing
  "🦄", // Unicorn
  "🐎", // Horse
  "🐲", // Dragon
  "🦓", // Zebra
  "🎪", // Circus Tent (Pegasus theme)
]

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function generateEnvelopes(prizes: PrizeConfig[]): Envelope[] {
  const envelopes: Envelope[] = []
  let index = 0

  for (const prize of prizes) {
    for (let i = 0; i < prize.count; i++) {
      envelopes.push({
        index,
        amount: prize.amount,
        decoration: HORSE_DECORATIONS[index % HORSE_DECORATIONS.length],
        code: envelopeCode(index),
        status: "available",
        pickedBy: "",
      })
      index++
    }
  }

  // Shuffle so amounts are randomized across positions
  const shuffled = shuffleArray(envelopes)

  // Re-assign indices, codes, and decorations after shuffle
  return shuffled.map((env, i) => ({
    ...env,
    index: i,
    code: envelopeCode(i),
    decoration: HORSE_DECORATIONS[i % HORSE_DECORATIONS.length],
  }))
}
