import type { FastifyInstance } from 'fastify'
import type { GameStackClient } from '../api/client.js'
import type { Store } from '../state/store.js'
import type { OverlayBus } from '../overlay/bus.js'
import { setCurrentGameByName } from '../state/setCurrentGame.js'
import {
  COLLECTION_MAX_ITEMS,
  COLLECTION_PAGE_MS,
  COLLECTION_PAGE_SIZE,
  OVERLAY_TTL_MS,
} from '../overlay/events.js'

export interface ServerDeps {
  api: GameStackClient
  store: Store
  bus: OverlayBus
}

/**
 * Broadcaster control panel + a couple of dev helpers. Lets you drive overlays and set the current
 * game from a local web page (http://localhost:PORT/control) without needing chat.
 */
export function registerControlRoutes(app: FastifyInstance, deps: ServerDeps): void {
  app.get('/control', async (_req, reply) => {
    return reply.type('text/html').send(CONTROL_HTML)
  })

  app.post('/control/setgame', async (req, reply) => {
    const query = String((req.body as Record<string, unknown> | undefined)?.query ?? '').trim()
    if (query.length < 2) return reply.code(400).send({ error: 'query too short' })
    const cg = await setCurrentGameByName(deps, query)
    return reply.send(
      cg.status === 'tracked' ? { status: 'tracked', title: cg.game.title, platform: cg.game.platform } : { status: cg.status },
    )
  })

  app.post('/control/showcollection', async (req, reply) => {
    const shelfQuery = String((req.body as Record<string, unknown> | undefined)?.shelf ?? '')
      .trim()
      .toLowerCase()
    const shelves = await deps.api.listShelves()
    if (shelves.length === 0) return reply.send({ ok: false, note: 'no public shelves' })
    const shelf =
      (shelfQuery &&
        (shelves.find((s) => s.slug.toLowerCase() === shelfQuery || s.name.toLowerCase() === shelfQuery) ??
          shelves.find((s) => s.name.toLowerCase().includes(shelfQuery)))) ||
      shelves[0]
    const page = await deps.api.getShelf(shelf.slug, { take: COLLECTION_MAX_ITEMS })
    const pageCount = Math.max(1, Math.ceil(page.items.length / COLLECTION_PAGE_SIZE))
    deps.bus.showPriority({
      type: 'show',
      overlay: 'collection',
      data: {
        title: shelf.name,
        description: shelf.description,
        items: page.items,
        pageSize: COLLECTION_PAGE_SIZE,
        pageMs: COLLECTION_PAGE_MS,
      },
      ttlMs: pageCount * COLLECTION_PAGE_MS,
    })
    return reply.send({ ok: true, shelf: shelf.name, count: page.totalCount, pages: pageCount })
  })

  app.post('/control/search', async (req, reply) => {
    const q = String((req.body as Record<string, unknown> | undefined)?.q ?? '').trim()
    if (q.length < 2) return reply.code(400).send({ error: 'query too short' })
    const results = await deps.api.searchGames(q)
    if (results.length === 0) return reply.send({ ok: false, note: `no match for "${q}"` })
    deps.bus.showPriority({ type: 'show', overlay: 'search', data: { query: q, items: results.slice(0, 5) }, ttlMs: OVERLAY_TTL_MS })
    return reply.send({ ok: true, top: results[0].title })
  })

  app.post('/control/hide', async (_req, reply) => {
    deps.bus.hide()
    return reply.send({ ok: true })
  })

  app.post('/control/overlays', async (req, reply) => {
    const enabled = (req.body as Record<string, unknown> | undefined)?.enabled !== false
    deps.bus.setEnabled(enabled)
    return reply.send({ ok: true, overlaysEnabled: deps.bus.overlaysEnabled })
  })

  // Dev helper (GET, browser-friendly): http://localhost:PORT/debug/show?q=zelda
  app.get('/debug/show', async (req, reply) => {
    const q = String((req.query as Record<string, unknown>)?.q ?? '').trim()
    if (q.length < 2) return reply.code(400).send({ error: 'pass ?q=<title> (2+ chars)' })
    const results = await deps.api.searchGames(q)
    if (results.length === 0) return reply.send({ shown: null, note: `no match for "${q}"` })
    deps.bus.showPriority({ type: 'show', overlay: 'search', data: { query: q, items: results.slice(0, 5) }, ttlMs: OVERLAY_TTL_MS })
    return reply.send({ shown: results[0].title })
  })
}

const CONTROL_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>StreamKit Control</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #0b0e14; color: #f2f4fb;
         display: grid; place-items: center; min-height: 100vh; }
  .panel { width: min(440px, 92vw); padding: 28px; background: #12151f; border: 1px solid #232a3a;
           border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
  h1 { font-size: 18px; margin: 0 0 18px; }
  .row { display: flex; gap: 8px; margin-bottom: 12px; }
  input { flex: 1; padding: 10px 12px; border-radius: 9px; border: 1px solid #2c3447; background: #0e1119;
          color: #f2f4fb; font-size: 14px; }
  button { padding: 10px 14px; border-radius: 9px; border: 0; background: #7c5cff; color: #fff;
           font-weight: 600; font-size: 14px; cursor: pointer; }
  button.ghost { background: #232a3a; }
  button:hover { filter: brightness(1.08); }
  .full { width: 100%; }
  #out { margin-top: 16px; font-size: 13px; color: #9aa3b2; min-height: 18px; }
</style>
</head>
<body>
  <div class="panel">
    <h1>🎮 StreamKit Control</h1>

    <div class="row">
      <input id="setgame" placeholder="Set current game (title)…" />
      <button onclick="post('/control/setgame', { query: val('setgame') })">Set</button>
    </div>

    <div class="row">
      <input id="search" placeholder="Search popup (title)…" />
      <button onclick="post('/control/search', { q: val('search') })">Search</button>
    </div>

    <div class="row">
      <input id="shelf" placeholder="Shelf name (blank = first)…" />
      <button onclick="post('/control/showcollection', { shelf: val('shelf') })">Show</button>
    </div>

    <button class="ghost full" onclick="post('/control/hide', {})">Hide overlay</button>

    <div class="row" style="margin-top:14px">
      <button class="ghost" style="flex:1" onclick="post('/control/overlays', { enabled: false })">⛔ Overlays OFF</button>
      <button style="flex:1" onclick="post('/control/overlays', { enabled: true })">✅ Overlays ON</button>
    </div>

    <div id="out"></div>
  </div>

<script>
  const val = (id) => document.getElementById(id).value;
  async function post(url, body) {
    const out = document.getElementById('out');
    out.textContent = '…';
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body) });
      out.textContent = res.status + ' · ' + (await res.text());
    } catch (e) { out.textContent = 'error: ' + e.message; }
  }
</script>
</body>
</html>`
