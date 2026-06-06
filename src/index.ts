import { loadConfig } from './config.js'
import { logger, scrubSecrets } from './logger.js'
import { GameStackClient } from './api/client.js'
import { Store } from './state/store.js'
import { OverlayBus } from './overlay/bus.js'
import { setCurrentGameByName } from './state/setCurrentGame.js'
import { createServer } from './server/http.js'
import { buildChatSources } from './chat/index.js'
import { createTwitchEventSub, type TwitchEventSub } from './events/twitchEventSub.js'
import { CommandRegistry } from './commands/registry.js'
import { allCommands } from './commands/handlers/index.js'

async function main(): Promise<void> {
  const config = loadConfig()

  const store = new Store()
  const bus = new OverlayBus()
  const api = new GameStackClient({
    base: config.api.base,
    backendOrigin: config.api.backendOrigin,
    key: config.api.key,
  })
  const deps = { api, store, bus }

  const app = await createServer(deps)
  await app.listen({ port: config.server.port, host: '0.0.0.0' })
  logger.info(
    `StreamKit server on http://localhost:${config.server.port} ` +
      `(overlay WS /ws · control panel /control)`,
  )

  // Boot smoke test against the public API — confirms auth + connectivity before chat/events.
  try {
    const shelves = await api.listShelves()
    logger.info(
      { shelfCount: shelves.length, shelves: shelves.map((s) => s.slug) },
      'GameStack public API reachable',
    )
  } catch (err) {
    logger.error(
      { err: scrubSecrets(err instanceof Error ? err.message : String(err)) },
      'GameStack API smoke test FAILED — check GAMESTACK_API_BASE/KEY and that the backend is running',
    )
  }

  // Command system.
  const registry = new CommandRegistry({ prefix: config.server.commandPrefix, api, store, bus })
  registry.registerAll(allCommands)

  // Chat sources.
  const sources = buildChatSources(config)
  if (sources.length === 0) {
    logger.warn('No chat sources configured (Twitch creds blank) — running API + overlay only.')
  }
  for (const source of sources) {
    source.onMessage((msg) => void registry.handle(msg))
    try {
      await source.start()
    } catch (err) {
      logger.error({ err, source: source.name }, 'failed to start chat source')
    }
  }

  // EventSub auto-now-playing (optional). Failure here must not crash the app.
  let eventsub: TwitchEventSub | null = null
  if (config.eventsub) {
    try {
      eventsub = await createTwitchEventSub(config.eventsub, async (categoryName) => {
        await setCurrentGameByName(deps, categoryName)
      })
      await eventsub.start()
    } catch (err) {
      logger.error({ err }, 'failed to start Twitch EventSub — auto now-playing disabled')
      eventsub = null
    }
  } else {
    logger.warn(
      'Twitch EventSub is OFF — auto now-playing disabled. Set TWITCH_EVENTSUB_ENABLED=true plus ' +
        'TWITCH_CLIENT_SECRET / TWITCH_BROADCASTER_TOKEN / TWITCH_BROADCASTER_REFRESH to enable it.',
    )
  }

  // Graceful shutdown.
  const shutdown = async () => {
    logger.info('shutting down…')
    if (eventsub) await eventsub.stop().catch(() => {})
    await Promise.allSettled(sources.map((s) => s.stop()))
    await app.close().catch(() => {})
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.stack : String(err) }, 'fatal startup error')
  process.exit(1)
})
