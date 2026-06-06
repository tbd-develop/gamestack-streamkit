import type { GameView } from '../api/types.js'

/** Every overlay auto-dismisses after this long, so nothing stays on screen over gameplay. */
export const OVERLAY_TTL_MS = 15_000

/** CollectionGrid is a slideshow: this many games per page, advancing every COLLECTION_PAGE_MS. */
export const COLLECTION_PAGE_SIZE = 18
export const COLLECTION_PAGE_MS = 10_000
/** Upper bound on games pulled for a collection slideshow (API max per request). */
export const COLLECTION_MAX_ITEMS = 100

/**
 * Events broadcast over the WebSocket to overlay browser sources.
 * `ttlMs` (on show events) tells the bus to auto-broadcast a `hide` after that delay.
 */
export type OverlayEvent =
  | { type: 'show'; overlay: 'now-playing'; data: GameView; ttlMs?: number }
  | {
      type: 'show'
      overlay: 'collection'
      data: {
        title: string
        description?: string | null
        items: GameView[]
        /** Slideshow page size; the overlay pages through `items` this many at a time. */
        pageSize?: number
        /** How long each page is shown before advancing. */
        pageMs?: number
      }
      ttlMs?: number
    }
  | { type: 'show'; overlay: 'search'; data: { query: string; items: GameView[] }; ttlMs?: number }
  | { type: 'hide' }
  | { type: 'state'; currentGame: GameView | null }
