import type { FastifyInstance } from 'fastify'
import type { OverlayBus } from '../overlay/bus.js'
import type { Store } from '../state/store.js'
import { logger } from '../logger.js'

/**
 * Registers the GET /ws endpoint that overlay browser sources connect to. On connect, replays the
 * current overlay + game state so a freshly-loaded OBS source immediately shows the right thing.
 */
export function registerOverlaySocket(app: FastifyInstance, bus: OverlayBus, store: Store): void {
  app.get('/ws', { websocket: true }, (socket) => {
    const send = (ev: unknown) => {
      try {
        socket.send(JSON.stringify(ev))
      } catch (err) {
        logger.warn({ err }, 'overlay ws send failed')
      }
    }

    // Replay state for this fresh client.
    send(bus.replayState ?? { type: 'hide' })
    const cg = store.currentGame
    send({ type: 'state', currentGame: cg.status === 'tracked' ? cg.game : null })

    const unsubscribe = bus.addSink(send)
    logger.info({ clients: bus.clientCount }, 'overlay client connected')

    socket.on('close', () => {
      unsubscribe()
      logger.info({ clients: bus.clientCount }, 'overlay client disconnected')
    })
    socket.on('error', (err: Error) => logger.warn({ err: err.message }, 'overlay socket error'))
  })
}
