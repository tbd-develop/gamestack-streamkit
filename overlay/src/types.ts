// Overlay-side copy of the wire contract. Kept local so the overlay bundle stays decoupled
// from the Node service. Must stay in sync with src/overlay/events.ts + src/api/types.ts.

export interface GameView {
  id: string
  title: string
  platform: string
  copyCount: number
  coverImageUrl: string | null
  description: string | null
  genres: string[]
  releaseYear: number | null
  rating: number | null // 0–100
  igdbSlug?: string | null
}

export type OverlayEvent =
  | { type: 'show'; overlay: 'now-playing'; data: GameView; ttlMs?: number }
  | {
      type: 'show'
      overlay: 'collection'
      data: {
        title: string
        description?: string | null
        items: GameView[]
        pageSize?: number
        pageMs?: number
      }
      ttlMs?: number
    }
  | { type: 'show'; overlay: 'search'; data: { query: string; items: GameView[] }; ttlMs?: number }
  | { type: 'hide' }
  | { type: 'state'; currentGame: GameView | null }

export type ShowEvent = Extract<OverlayEvent, { type: 'show' }>
