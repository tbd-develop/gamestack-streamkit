import type { PublicGameDto } from './types.js'

/**
 * Resolve the API's relative cover path (e.g. "/api/games/{id}/image") to an absolute URL
 * against the backend origin. Returns null unchanged. Already-absolute URLs pass through.
 * The image route is anonymous, so overlay <img> tags can load the result without a key.
 */
export function resolveCoverUrl(path: string | null, backendOrigin: string): string | null {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${backendOrigin}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Return a copy of the game with its coverImageUrl resolved to an absolute URL. */
export function withAbsoluteCover(game: PublicGameDto, backendOrigin: string): PublicGameDto {
  return { ...game, coverImageUrl: resolveCoverUrl(game.coverImageUrl, backendOrigin) }
}
