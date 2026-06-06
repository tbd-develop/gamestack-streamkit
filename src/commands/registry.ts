import { NotFoundError, RateLimitedError, type GameStackClient } from '../api/client.js'
import type { OverlayBus } from '../overlay/bus.js'
import type { Store, CurrentGame } from '../state/store.js'
import type { ChatMessage, ChatUser } from '../chat/ChatSource.js'
import { logger } from '../logger.js'
import { Permission, type Command, type CommandContext } from './types.js'

export interface RegistryDeps {
  prefix: string
  api: GameStackClient
  store: Store
  bus: OverlayBus
}

export class CommandRegistry {
  private readonly commands = new Map<string, Command>()
  private readonly cooldowns = new Map<string, number>() // command name -> last run (epoch ms)
  private readonly cooldownNotified = new Map<string, number>() // command name -> the lastRun we already notified for

  constructor(private readonly deps: RegistryDeps) {}

  register(cmd: Command): void {
    this.commands.set(cmd.name.toLowerCase(), cmd)
    for (const alias of cmd.aliases ?? []) this.commands.set(alias.toLowerCase(), cmd)
  }

  registerAll(cmds: Command[]): void {
    for (const cmd of cmds) this.register(cmd)
  }

  /** Unique registered commands (aliases deduped), in registration order. */
  list(): Command[] {
    return [...new Set(this.commands.values())]
  }

  /** Parse and dispatch a chat message. Unknown commands and unauthorized users are ignored silently. */
  async handle(msg: ChatMessage): Promise<void> {
    const { prefix } = this.deps
    if (!msg.text.startsWith(prefix)) return

    const body = msg.text.slice(prefix.length).trim()
    if (!body) return
    const [nameRaw, ...args] = body.split(/\s+/)
    const cmd = this.commands.get(nameRaw.toLowerCase())
    if (!cmd) return

    if (!hasPermission(cmd.permission, msg.user)) return

    // Gating: block current-game/search commands while streaming an untracked game.
    if (cmd.availability === 'blockedWhenUntracked' && this.deps.store.currentGame.status === 'untracked') {
      await safeReply(msg, untrackedMessage(this.deps.store.currentGame))
      return
    }

    // Cooldown (global per command, keyed by canonical name). On block, reply once per
    // cooldown window so the user knows the command registered, then stay quiet.
    const now = Date.now()
    const last = this.cooldowns.get(cmd.name) ?? 0
    const cooldownMs = cmd.cooldownSeconds * 1000
    if (now - last < cooldownMs) {
      if (this.cooldownNotified.get(cmd.name) !== last) {
        this.cooldownNotified.set(cmd.name, last)
        const remaining = Math.ceil((cooldownMs - (now - last)) / 1000)
        await safeReply(
          msg,
          `@${msg.user.displayName} ${this.deps.prefix}${cmd.name} is cooling down — try again in ${remaining}s.`,
        )
      }
      return
    }
    this.cooldowns.set(cmd.name, now)

    const ctx: CommandContext = {
      args,
      user: msg.user,
      source: msg.source,
      reply: msg.reply,
      api: this.deps.api,
      store: this.deps.store,
      bus: this.deps.bus,
      prefix: this.deps.prefix,
      commands: this.list(),
    }

    try {
      await cmd.run(ctx)
    } catch (err) {
      if (err instanceof RateLimitedError) {
        await safeReply(msg, `One sec — querying GameStack a bit fast. Try again in ${Math.ceil(err.retryAfterMs / 1000)}s.`)
      } else if (err instanceof NotFoundError) {
        logger.debug({ err, cmd: cmd.name }, 'command hit a 404')
      } else {
        logger.error({ err, cmd: cmd.name }, 'command handler threw')
        await safeReply(msg, 'Something went wrong with that one — try again in a moment.')
      }
    }
  }
}

function hasPermission(required: Permission, user: ChatUser): boolean {
  switch (required) {
    case Permission.Everyone:
      return true
    case Permission.Mod:
      return user.isMod || user.isBroadcaster
    case Permission.Broadcaster:
      return user.isBroadcaster
  }
}

function untrackedMessage(cg: CurrentGame): string {
  const name = cg.status === 'untracked' ? cg.categoryName : 'this game'
  return `Currently playing ${name}, which isn't in my physical collection — that command's off right now.`
}

async function safeReply(msg: ChatMessage, text: string): Promise<void> {
  try {
    await msg.reply(text)
  } catch (err) {
    logger.warn({ err }, 'failed to send chat reply')
  }
}
