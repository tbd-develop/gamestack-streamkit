import { RefreshingAuthProvider } from '@twurple/auth'
import { ApiClient } from '@twurple/api'
import { EventSubWsListener } from '@twurple/eventsub-ws'
import type { ChatMessage, ChatSource } from './ChatSource.js'
import type { TwitchConfig } from '../config.js'
import { logger } from '../logger.js'

/**
 * Twitch chat adapter (read + reply) built on EventSub WebSocket — the path Twitch now recommends
 * over legacy IRC. Reads via the `channel.chat.message` subscription and replies via the Helix
 * "Send Chat Message" endpoint (`chat.sendChatMessage`, executed in the bot's user context).
 *
 * Uses a RefreshingAuthProvider so the bot token auto-renews — no more ~4-hour static-token expiry.
 * The bot token needs `user:read:chat` (read) + `user:write:chat` (reply); add `user:bot` and have
 * the broadcaster grant `channel:bot` (or make the bot a mod) when the bot is a separate account.
 *
 * Emits verbose connection diagnostics (socket connect/disconnect, subscription success/FAILURE,
 * revocation) — EventSub failures are otherwise silent.
 */
export class TwitchChatSource implements ChatSource {
  readonly name = 'twitch' as const
  private readonly authProvider: RefreshingAuthProvider
  private readonly apiClient: ApiClient
  private readonly listener: EventSubWsListener
  private handler: ((msg: ChatMessage) => void) | null = null

  constructor(private readonly cfg: TwitchConfig) {
    this.authProvider = new RefreshingAuthProvider({
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
    })
    this.apiClient = new ApiClient({ authProvider: this.authProvider })
    this.listener = new EventSubWsListener({ apiClient: this.apiClient })

    // ── Connection diagnostics (silent by default — this is why a broken chat link shows nothing) ──
    this.listener.onUserSocketConnect((id) =>
      logger.info({ userId: id }, 'Twitch chat: EventSub socket connected'),
    )
    this.listener.onUserSocketDisconnect((id, err) =>
      logger.warn({ userId: id, err: err?.message }, 'Twitch chat: EventSub socket disconnected'),
    )
    this.listener.onSubscriptionCreateSuccess((sub) =>
      logger.info({ sub: sub.id }, 'Twitch chat: channel.chat.message subscription active ✅'),
    )
    this.listener.onSubscriptionCreateFailure((sub, err) =>
      logger.error({ sub: sub.id, err: err.message }, 'Twitch chat: subscription FAILED ❌'),
    )
    this.listener.onRevoke((sub, status) =>
      logger.error({ sub: sub.id, status }, 'Twitch chat: subscription revoked by Twitch'),
    )
  }

  async start(): Promise<void> {
    logger.info({ channel: this.cfg.channel }, 'connecting to Twitch chat (EventSub)…')

    // expiresIn/obtainmentTimestamp = 0 marks the token expired so it refreshes before first use.
    const botUserId = await this.authProvider.addUserForToken({
      accessToken: this.cfg.botToken,
      refreshToken: this.cfg.botRefresh,
      scope: ['user:read:chat', 'user:write:chat', 'user:bot'],
      expiresIn: 0,
      obtainmentTimestamp: 0,
    })

    // Resolve the broadcaster (the channel to read) so we can subscribe and send into it.
    const channelUser = await this.apiClient.users.getUserByName(this.cfg.channel)
    if (!channelUser) {
      throw new Error(
        `Twitch chat: channel "${this.cfg.channel}" not found — check TWITCH_CHANNEL (login name, no '#').`,
      )
    }
    const broadcasterUserId = channelUser.id
    const botUser = await this.apiClient.users.getUserById(botUserId)
    logger.info(
      { botLogin: botUser?.name, botUserId, channel: this.cfg.channel, broadcasterUserId },
      'Twitch chat: bot token resolved',
    )

    this.listener.onChannelChatMessage(broadcasterUserId, botUserId, (event) => {
      if (!this.handler) return
      const message: ChatMessage = {
        source: 'twitch',
        channel: this.cfg.channel,
        text: event.messageText,
        user: {
          id: event.chatterId,
          displayName: event.chatterDisplayName,
          isBroadcaster: event.chatterId === event.broadcasterId,
          isMod: Boolean(event.badges['moderator']) || event.chatterId === event.broadcasterId,
        },
        reply: async (reply: string) => {
          // Send as the bot user (not the broadcaster, who is sendChatMessage's default context).
          await this.apiClient.asUser(botUserId, (ctx) =>
            ctx.chat.sendChatMessage(broadcasterUserId, reply),
          )
        },
      }
      this.handler(message)
    })

    this.listener.start()
    logger.info({ channel: this.cfg.channel, broadcasterUserId }, 'Twitch chat: started')
  }

  async stop(): Promise<void> {
    this.listener.stop()
  }

  onMessage(handler: (msg: ChatMessage) => void): void {
    this.handler = handler
  }
}
