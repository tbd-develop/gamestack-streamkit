import { z } from 'zod'

/**
 * StreamKit configuration, parsed and validated from environment (.env).
 * Required: the GameStack public-API settings. Twitch chat is optional in Phase 1 —
 * if all three Twitch vars are present, the bot is enabled; otherwise it runs API+overlay only.
 */
const schema = z.object({
  // Default to production GameStack so a fresh checkout "just works" with only an API key.
  // Override these locally (e.g. in .env.development) to point at a dev instance.
  GAMESTACK_API_BASE: z.string().url().default('https://gamestack.us/api/public/v1'),
  GAMESTACK_BACKEND_ORIGIN: z.string().url().default('https://gamestack.us'),
  GAMESTACK_API_KEY: z.string().min(1, 'GAMESTACK_API_KEY is required'),

  STREAMKIT_PORT: z.coerce.number().int().positive().default(8420),
  COMMAND_PREFIX: z.string().min(1).default('!'),

  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),
  TWITCH_BOT_TOKEN: z.string().optional(),
  TWITCH_BOT_REFRESH: z.string().optional(),
  TWITCH_CHANNEL: z.string().optional(),

  TWITCH_EVENTSUB_ENABLED: z.string().optional(),
  TWITCH_BROADCASTER_TOKEN: z.string().optional(),
  TWITCH_BROADCASTER_REFRESH: z.string().optional(),
})

export interface TwitchConfig {
  clientId: string
  /** App Client Secret — powers the bot token's auto-refresh. */
  clientSecret: string
  /**
   * Raw access token (any leading "oauth:" is stripped). Needs `user:read:chat` + `user:write:chat`
   * (chat is read/sent over EventSub + Helix now, not IRC).
   */
  botToken: string
  /** Refresh token paired with botToken so it renews instead of expiring after ~4 hours. */
  botRefresh: string
  channel: string
}

/**
 * EventSub auto-now-playing config. `channel.update` needs no scope, but the subscription requires
 * a *broadcaster* user token (your own channel) refreshed via clientId/clientSecret.
 */
export interface EventSubConfig {
  clientId: string
  clientSecret: string
  channel: string
  broadcasterToken: string
  broadcasterRefresh: string
}

export interface Config {
  api: {
    base: string
    backendOrigin: string
    key: string
  }
  server: {
    port: number
    commandPrefix: string
  }
  /** Present only when all Twitch credentials are configured. */
  twitch: TwitchConfig | null
  /** Present only when EventSub is enabled and all broadcaster credentials are configured. */
  eventsub: EventSubConfig | null
}

function stripOauthPrefix(token: string): string {
  return token.startsWith('oauth:') ? token.slice('oauth:'.length) : token
}

/** Parse + validate the environment into a typed Config. Throws a readable error on failure. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid StreamKit configuration:\n${issues}\n\nCheck your .env (see .env.example).`)
  }
  const e = parsed.data

  const twitchVars = [
    e.TWITCH_CLIENT_ID,
    e.TWITCH_CLIENT_SECRET,
    e.TWITCH_BOT_TOKEN,
    e.TWITCH_BOT_REFRESH,
    e.TWITCH_CHANNEL,
  ]
  const anyTwitch = twitchVars.some((v) => v && v.trim().length > 0)
  const allTwitch = twitchVars.every((v) => v && v.trim().length > 0)
  if (anyTwitch && !allTwitch) {
    throw new Error(
      'Partial Twitch config: set ALL of TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_BOT_TOKEN, ' +
        'TWITCH_BOT_REFRESH, TWITCH_CHANNEL to enable the bot, or leave all blank to run API+overlay only.',
    )
  }

  const twitch: TwitchConfig | null = allTwitch
    ? {
        clientId: e.TWITCH_CLIENT_ID!.trim(),
        clientSecret: e.TWITCH_CLIENT_SECRET!.trim(),
        botToken: stripOauthPrefix(e.TWITCH_BOT_TOKEN!.trim()),
        botRefresh: e.TWITCH_BOT_REFRESH!.trim(),
        channel: e.TWITCH_CHANNEL!.trim().replace(/^#/, '').toLowerCase(),
      }
    : null

  // EventSub auto-now-playing (Phase 2). Opt-in via flag; requires Twitch + broadcaster creds.
  const eventsubEnabled = (e.TWITCH_EVENTSUB_ENABLED ?? 'false').trim().toLowerCase() === 'true'
  let eventsub: EventSubConfig | null = null
  if (eventsubEnabled) {
    const missing: string[] = []
    if (!twitch) missing.push('TWITCH_CLIENT_ID/TWITCH_CHANNEL (Twitch must be configured)')
    if (!e.TWITCH_CLIENT_SECRET?.trim()) missing.push('TWITCH_CLIENT_SECRET')
    if (!e.TWITCH_BROADCASTER_TOKEN?.trim()) missing.push('TWITCH_BROADCASTER_TOKEN')
    if (!e.TWITCH_BROADCASTER_REFRESH?.trim()) missing.push('TWITCH_BROADCASTER_REFRESH')
    if (missing.length > 0) {
      throw new Error(
        `TWITCH_EVENTSUB_ENABLED=true but missing: ${missing.join(', ')}. ` +
          'Fill them in or set TWITCH_EVENTSUB_ENABLED=false.',
      )
    }
    eventsub = {
      clientId: twitch!.clientId,
      clientSecret: e.TWITCH_CLIENT_SECRET!.trim(),
      channel: twitch!.channel,
      broadcasterToken: stripOauthPrefix(e.TWITCH_BROADCASTER_TOKEN!.trim()),
      broadcasterRefresh: e.TWITCH_BROADCASTER_REFRESH!.trim(),
    }
  }

  return {
    api: {
      base: e.GAMESTACK_API_BASE.replace(/\/$/, ''),
      backendOrigin: e.GAMESTACK_BACKEND_ORIGIN.replace(/\/$/, ''),
      key: e.GAMESTACK_API_KEY,
    },
    server: {
      port: e.STREAMKIT_PORT,
      commandPrefix: e.COMMAND_PREFIX,
    },
    twitch,
    eventsub,
  }
}
