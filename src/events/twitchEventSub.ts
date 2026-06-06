import { RefreshingAuthProvider } from '@twurple/auth'
import { ApiClient } from '@twurple/api'
import { EventSubWsListener } from '@twurple/eventsub-ws'
import type { EventSubConfig } from '../config.js'
import { logger } from '../logger.js'

export interface TwitchEventSub {
  start(): Promise<void>
  stop(): Promise<void>
}

/**
 * Listens for Twitch `channel.update` over an outbound EventSub WebSocket (no public URL/tunnel)
 * and reports the new category name. Seeds the initial category at startup via Helix. Uses a
 * RefreshingAuthProvider so the broadcaster token auto-renews.
 *
 * Emits verbose diagnostics: socket connect/disconnect, subscription success/FAILURE, revocation,
 * and a broadcaster-account sanity check — because EventSub failures are otherwise silent.
 */
export async function createTwitchEventSub(
  cfg: EventSubConfig,
  onCategory: (categoryName: string) => void | Promise<void>,
): Promise<TwitchEventSub> {
  const authProvider = new RefreshingAuthProvider({
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
  })

  // expiresIn/obtainmentTimestamp = 0 marks the token as expired so it refreshes before first use.
  const userId = await authProvider.addUserForToken({
    accessToken: cfg.broadcasterToken,
    refreshToken: cfg.broadcasterRefresh,
    scope: [],
    expiresIn: 0,
    obtainmentTimestamp: 0,
  })

  const apiClient = new ApiClient({ authProvider })
  const listener = new EventSubWsListener({ apiClient })

  // ── Diagnostics (silent by default — this is why a broken subscription shows nothing) ──
  listener.onUserSocketConnect((id) => logger.info({ userId: id }, 'EventSub: socket connected'))
  listener.onUserSocketDisconnect((id, err) =>
    logger.warn({ userId: id, err: err?.message }, 'EventSub: socket disconnected'),
  )
  listener.onSubscriptionCreateSuccess((sub) =>
    logger.info({ sub: sub.id, authUserId: sub.authUserId }, 'EventSub: subscription active ✅'),
  )
  listener.onSubscriptionCreateFailure((sub, err) =>
    logger.error({ sub: sub.id, err: err.message }, 'EventSub: subscription FAILED ❌'),
  )
  listener.onRevoke((sub, status) =>
    logger.error({ sub: sub.id, status }, 'EventSub: subscription revoked by Twitch'),
  )

  return {
    async start() {
      // Confirm the broadcaster token belongs to the account whose category we want to watch.
      try {
        const [tokenUser, channelUser] = await Promise.all([
          apiClient.users.getUserById(userId),
          apiClient.users.getUserByName(cfg.channel),
        ])
        logger.info(
          { tokenLogin: tokenUser?.name, tokenUserId: userId, channel: cfg.channel, channelUserId: channelUser?.id },
          'EventSub: broadcaster token resolved',
        )
        if (channelUser && channelUser.id !== userId) {
          logger.error(
            { tokenLogin: tokenUser?.name, channel: cfg.channel },
            'EventSub: BROADCASTER TOKEN MISMATCH — the token belongs to a different account than ' +
              'TWITCH_CHANNEL, so channel.update for your channel will NEVER fire. Re-generate ' +
              'TWITCH_BROADCASTER_TOKEN/REFRESH while logged in as your channel account.',
          )
        }
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'EventSub: could not validate broadcaster token (token refresh or API call failed) — ' +
            'check TWITCH_CLIENT_SECRET and TWITCH_BROADCASTER_REFRESH',
        )
      }

      listener.onChannelUpdate(userId, (event) => {
        logger.info({ category: event.categoryName }, 'Twitch category changed (EventSub)')
        void onCategory(event.categoryName)
      })
      listener.start()
      logger.info({ channel: cfg.channel, broadcasterUserId: userId }, 'EventSub: started, subscribing to channel.update')

      // Seed the current category at boot.
      try {
        const info = await apiClient.channels.getChannelInfoById(userId)
        if (info?.gameName) {
          logger.info({ category: info.gameName }, 'EventSub: seeding initial Twitch category')
          await onCategory(info.gameName)
        }
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          'EventSub: could not fetch initial channel category',
        )
      }
    },

    async stop() {
      listener.stop()
    },
  }
}
