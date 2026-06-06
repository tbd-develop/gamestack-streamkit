/**
 * Tiny in-memory TTL cache. Mirrors the API's `Cache-Control: max-age=30`, so repeated
 * commands (e.g. many viewers spamming !games) collapse into one upstream request.
 */
export class TtlCache {
  private readonly store = new Map<string, { value: unknown; expires: number }>()

  constructor(private readonly ttlMs: number = 30_000) {}

  get<T>(key: string): T | undefined {
    const hit = this.store.get(key)
    if (!hit) return undefined
    if (hit.expires <= Date.now()) {
      this.store.delete(key)
      return undefined
    }
    return hit.value as T
  }

  set(key: string, value: unknown): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs })
  }

  /** Get-or-compute: returns the cached value, or runs `fn`, caches, and returns it. */
  async wrap<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== undefined) return cached
    const value = await fn()
    this.set(key, value)
    return value
  }
}
