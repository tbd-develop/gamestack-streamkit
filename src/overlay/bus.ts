import type { OverlayEvent } from './events.js'
import type { GameView } from '../api/types.js'
import { logger } from '../logger.js'

type Sink = (ev: OverlayEvent) => void
type ShowEvent = Extract<OverlayEvent, { type: 'show' }>

/** How many viewer requests can wait on screen at once before extras are dropped. */
const MAX_QUEUE = 3

export type EnqueueResult = 'shown' | 'queued' | 'dropped' | 'suppressed'

/**
 * Fans overlay events out to connected sockets with a one-slot display + a small queue:
 *
 * - **Viewer requests** (`enqueue`) show immediately if the slot is free, else line up behind the
 *   current overlay (bounded by `MAX_QUEUE`); each advances when the prior one's `ttlMs` expires.
 * - **Mod / authoritative actions** (`showPriority`, `hide`) **preempt** — they clear the queue and
 *   the current overlay and take the slot now.
 * - **Master switch** (`setEnabled(false)`) suppresses all on-screen output and clears everything;
 *   chat replies are unaffected. `sendState` (data) always passes through.
 */
export class OverlayBus {
  private readonly sinks = new Set<Sink>()
  private enabled = true
  private current: OverlayEvent = { type: 'hide' }
  private queue: ShowEvent[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  addSink(sink: Sink): () => void {
    this.sinks.add(sink)
    return () => this.sinks.delete(sink)
  }

  get clientCount(): number {
    return this.sinks.size
  }

  get overlaysEnabled(): boolean {
    return this.enabled
  }

  get queueLength(): number {
    return this.queue.length
  }

  /** What a newly-connected client should be shown immediately. */
  get replayState(): OverlayEvent {
    return this.enabled ? this.current : { type: 'hide' }
  }

  /** Viewer request: show now if idle, else queue behind the current overlay. */
  enqueue(ev: ShowEvent): EnqueueResult {
    if (!this.enabled) return 'suppressed'
    if (this.current.type !== 'show') {
      this.display(ev)
      return 'shown'
    }
    if (this.queue.length >= MAX_QUEUE) return 'dropped'
    this.queue.push(ev)
    return 'queued'
  }

  /** Mod / authoritative: clear the queue + current overlay and take the slot now. */
  showPriority(ev: ShowEvent): void {
    this.queue = []
    if (this.enabled) {
      this.display(ev)
    } else {
      this.clearTimer()
      this.current = ev // tracked but suppressed until overlays are re-enabled
    }
  }

  /** Clear the screen and the queue (mod `!hide`). */
  hide(): void {
    this.queue = []
    this.clearTimer()
    this.current = { type: 'hide' }
    if (this.enabled) this.send({ type: 'hide' })
  }

  /** Push current-game state to overlays (data only — never gated, never queued). */
  sendState(currentGame: GameView | null): void {
    this.send({ type: 'state', currentGame })
  }

  /** Master overlay switch. Chat replies are unaffected. */
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return
    this.enabled = enabled
    if (!enabled) {
      this.clearTimer()
      this.queue = []
      this.current = { type: 'hide' }
      this.send({ type: 'hide' })
    }
    // On enable: screen stays clear until the next command/event.
  }

  private display(ev: ShowEvent): void {
    this.clearTimer()
    this.current = ev
    this.send(ev)
    if (ev.ttlMs && ev.ttlMs > 0) {
      this.timer = setTimeout(() => this.advance(), ev.ttlMs)
    }
  }

  /** Current overlay expired → show the next queued request, or go blank. */
  private advance(): void {
    this.timer = null
    const next = this.queue.shift()
    if (next) {
      this.display(next)
    } else {
      this.current = { type: 'hide' }
      this.send({ type: 'hide' })
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private send(ev: OverlayEvent): void {
    for (const sink of this.sinks) {
      try {
        sink(ev)
      } catch (err) {
        logger.warn({ err }, 'overlay sink threw during broadcast')
      }
    }
  }
}
