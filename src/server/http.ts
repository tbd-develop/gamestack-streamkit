import Fastify, { type FastifyInstance } from 'fastify'
import websocket from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { registerOverlaySocket } from './ws.js'
import { registerControlRoutes, type ServerDeps } from './control.js'
import { logger } from '../logger.js'

/**
 * Builds the Fastify server: the overlay WebSocket, the control panel + dev routes, a health check,
 * and (in prod) serving the built overlay SPA from overlay-dist/. In dev the overlay is served by Vite.
 */
export async function createServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(websocket)
  registerOverlaySocket(app, deps.bus, deps.store)
  registerControlRoutes(app, deps)

  app.get('/health', async () => ({ ok: true, overlayClients: deps.bus.clientCount }))

  const overlayDist = fileURLToPath(new URL('../../overlay-dist', import.meta.url))
  if (existsSync(overlayDist)) {
    await app.register(fastifyStatic, { root: overlayDist })
    logger.info('serving built overlay from overlay-dist/')
  } else {
    logger.info('overlay-dist/ not built — in dev, open the Vite overlay at http://localhost:5173/#/stage')
  }

  return app
}
