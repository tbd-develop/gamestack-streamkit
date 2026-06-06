import { TtlCache } from './cache.js'
import { withAbsoluteCover } from './images.js'
import type { PublicGameDto, PublicShelfDto, PublicShelfPage } from './types.js'

export interface GameStackClientOptions {
  base: string
  backendOrigin: string
  key: string
  timeoutMs?: number
}

/** Thrown when the API returns 429. Carries how long to back off. */
export class RateLimitedError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`Rate limited; retry after ~${Math.ceil(retryAfterMs / 1000)}s`)
    this.name = 'RateLimitedError'
  }
}

/** Thrown on 404 (e.g. unknown shelf slug or out-of-scope game) so callers can react specifically. */
export class NotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`Not found: ${path}`)
    this.name = 'NotFoundError'
  }
}

/**
 * Read-only client for the GameStack public API. Handles auth, a 30s cache (matching the API's
 * max-age=30), 429 back-off, and resolving relative cover URLs to absolute ones.
 */
export class GameStackClient {
  private readonly cache = new TtlCache(30_000)
  private cooldownUntil = 0

  constructor(private readonly opts: GameStackClientOptions) {}

  get isCoolingDown(): boolean {
    return Date.now() < this.cooldownUntil
  }

  get cooldownRemainingMs(): number {
    return Math.max(0, this.cooldownUntil - Date.now())
  }

  private async get<T>(path: string): Promise<T> {
    if (this.isCoolingDown) throw new RateLimitedError(this.cooldownRemainingMs)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? 5000)
    try {
      const res = await fetch(`${this.opts.base}${path}`, {
        headers: { 'X-Api-Key': this.opts.key, Accept: 'application/json' },
        signal: controller.signal,
      })

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after')) || 30
        this.cooldownUntil = Date.now() + retryAfter * 1000
        throw new RateLimitedError(retryAfter * 1000)
      }
      if (res.status === 404) throw new NotFoundError(path)
      if (!res.ok) throw new Error(`GameStack API responded ${res.status} for ${path}`)

      return (await res.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }

  /** List the owner's public shelves. */
  listShelves(): Promise<PublicShelfDto[]> {
    return this.cache.wrap('shelves', () => this.get<PublicShelfDto[]>('/shelves'))
  }

  /** Games on one public shelf (paginated). Cover URLs resolved to absolute. */
  async getShelf(slug: string, opts: { skip?: number; take?: number } = {}): Promise<PublicShelfPage> {
    const skip = opts.skip ?? 0
    const take = opts.take ?? 24
    const page = await this.cache.wrap(`shelf:${slug}:${skip}:${take}`, () =>
      this.get<PublicShelfPage>(`/shelves/${encodeURIComponent(slug)}?skip=${skip}&take=${take}`),
    )
    return { ...page, items: page.items.map((g) => withAbsoluteCover(g, this.opts.backendOrigin)) }
  }

  /** A single game by id. Cover URL resolved to absolute. Throws NotFoundError if out of scope. */
  async getGame(id: string): Promise<PublicGameDto> {
    const game = await this.cache.wrap(`game:${id}`, () =>
      this.get<PublicGameDto>(`/games/${encodeURIComponent(id)}`),
    )
    return withAbsoluteCover(game, this.opts.backendOrigin)
  }

  /** Fuzzy search by title (optional platform filter). Returns [] for queries under 2 chars. */
  async searchGames(q: string, platform?: string): Promise<PublicGameDto[]> {
    const term = q.trim()
    if (term.length < 2) return []
    const params = new URLSearchParams({ q: term })
    if (platform?.trim()) params.set('platform', platform.trim())
    const results = await this.cache.wrap(`search:${params.toString()}`, () =>
      this.get<PublicGameDto[]>(`/games/search?${params.toString()}`),
    )
    return results.map((g) => withAbsoluteCover(g, this.opts.backendOrigin))
  }
}
