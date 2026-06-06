import type { PublicGameDto } from './types.js'

/**
 * A "find out more" IGDB URL for a game. Uses the direct game page when the API provides an
 * `igdbSlug`; otherwise falls back to an IGDB title search so the link always works.
 */
export function igdbUrl(game: Pick<PublicGameDto, 'igdbSlug' | 'title'>): string {
  if (game.igdbSlug) return `https://www.igdb.com/games/${game.igdbSlug}`
  return `https://www.igdb.com/search?q=${encodeURIComponent(game.title)}`
}
