import type { PrizeConfig, Envelope } from "@/types"

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
        status: "available",
        pickedBy: "",
      })
      index++
    }
  }

  // Shuffle so amounts are randomized across positions
  const shuffled = shuffleArray(envelopes)

  // Re-assign indices and decorations after shuffle
  return shuffled.map((env, i) => ({
    ...env,
    index: i,
    decoration: HORSE_DECORATIONS[i % HORSE_DECORATIONS.length],
  }))
}
