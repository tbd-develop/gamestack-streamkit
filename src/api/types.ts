/**
 * Mirror of the GameStack public API response shapes (camelCase JSON).
 * Source of truth: backend/Endpoints/PublicApi/*.cs.
 */

export interface PublicGameDto {
  id: string
  title: string
  platform: string
  copyCount: number
  /**
   * Cover image URL. As returned by the API this is a RELATIVE path
   * (e.g. "/api/games/{id}/image") or null. The client resolves it to an
   * absolute URL against the backend origin before handing it to overlays.
   */
  coverImageUrl: string | null
  description: string | null
  genres: string[]
  releaseYear: number | null
  rating: number | null // 0–100 (IGDB)
  /** IGDB slug for a "find out more" link. Optional — present once the backend exposes it. */
  igdbSlug?: string | null
  /** True once the player has finished the game — overlay greys the cover and shows a check. */
  isCompleted?: boolean
}

export interface PublicShelfDto {
  slug: string
  name: string
  description: string | null
  gameCount: number
}

export interface PublicShelfPage {
  slug: string
  name: string
  description: string | null
  items: PublicGameDto[]
  totalCount: number
  hasMore: boolean
}

/** A game as sent to overlays — identical shape, but coverImageUrl is absolute (or null). */
export type GameView = PublicGameDto
