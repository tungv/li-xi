import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./components/providers"

export const metadata: Metadata = {
  title: "Li Xi - Red Envelope Game",
  description: "A real-time multiplayer red envelope game. Create a room, pick envelopes, trade, and reveal prizes!",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-red-50 to-red-100">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
