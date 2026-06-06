import type { GameStackClient } from '../api/client.js'
import type { OverlayBus } from '../overlay/bus.js'
import type { Store } from '../state/store.js'
import type { ChatPlatform, ChatUser } from '../chat/ChatSource.js'

export enum Permission {
  Everyone,
  Mod,
  Broadcaster,
}

/**
 * Command availability relative to the current-game state:
 * - 'always': runs regardless of what's being streamed.
 * - 'blockedWhenUntracked': blocked (with a friendly reply) while streaming a game that isn't in
 *   the physical collection. (The 'none' state is handled inside the handler.)
 */
export type Availability = 'always' | 'blockedWhenUntracked'

export interface CommandContext {
  args: string[]
  user: ChatUser
  source: ChatPlatform
  reply: (text: string) => Promise<void>
  api: GameStackClient
  store: Store
  bus: OverlayBus
  /** Configured command prefix (e.g. "!") — so handlers render commands correctly. */
  prefix: string
  /** All registered commands (deduped) — used by !help. */
  commands: Command[]
}

export interface Command {
  name: string
  aliases?: string[]
  permission: Permission
  availability: Availability
  cooldownSeconds: number
  /** Invocation hint without the prefix, e.g. "shelf <name>". Falls back to the name. */
  usage?: string
  run: (ctx: CommandContext) => Promise<void>
}
