# StreamKit — Design & Development Doc

A local streaming toolkit for the GameStack owner's Twitch (and later YouTube) streams. It listens
for viewer `!commands`, queries the GameStack **public API**, and drives **OBS browser-source
overlays** (e.g. a "now playing" card, a collection/shelf showcase, a search popup).

This is the living spec — the counterpart to the public-API key design (`docs/api-keys-design.md`
in the main GameStack repo). It records *what* StreamKit is, *how* it's built, and *where we are* (see
[Build Status](#build-status)). Keep it updated as the code evolves.

> Planning scratchpad (decisions log, alternatives considered) lives at
> `C:\Users\terry\.claude\plans\hello-cool-i-want-majestic-lecun.md`. This doc is the durable,
> checked-in source of truth.

---

## 1. Runtime & isolation (NON-NEGOTIABLE)

StreamKit is a **standalone local service**, completely separate from the website:

- It does **NOT** run in the same process as `frontend/` or `backend/`. It is **never** imported,
  bundled, proxied, deployed, or auto-started with them. It is not added to `gametrove-simple.sln`,
  to any `docker-compose*.yml`, or to the frontend/backend build.
- It is **started manually by the user only when streaming** (`cd streamkit && npm run dev`) and
  stopped (Ctrl-C) when done. Its lifecycle is fully independent of the website's.
- Its **only** coupling to GameStack is an **outbound HTTP call** to the public API (with an API
  key), exactly as any third-party tool would consume it — no shared database, port, runtime, or
  build. The API base URL is configurable, so it can point at a local `dotnet run` or a deployed
  instance.

Lives in its own top-level folder `streamkit/` with its own `package.json` / `node_modules`.

---

## 2. Confirmed decisions

| Decision | Choice |
|---|---|
| Scope | Twitch first; YouTube later behind a pluggable `ChatSource` interface |
| Chat behaviour | Bot **replies in chat** AND drives overlays |
| Overlay UI | **Vite + Vue 3 + Tailwind** standalone SPA (OBS browser source) |
| "Now playing" source | **Automatic** via Twitch **EventSub `channel.update`** (category change); `!setgame` is a manual override |
| Untracked games | First-class state; **current-game commands + search gate off** with a friendly chat reply; browsing stays available |
| On-stream overlay policy | **Nothing stays on screen over gameplay** — cards auto-dismiss after 15s; the CollectionGrid is a **10s-per-page slideshow** that hides after the last page. Viewers get compact corner cards; the grid is **mod-only**; `!overlays on/off` is a mod master switch. Current-game *state* is kept in the store (for `!nowplaying`/gating) even though the card itself is transient |
| Overlay queue & preemption | One display slot. **Viewer requests queue** (bounded, `MAX_QUEUE=3`) and play in turn — each advances when the prior card's ttl expires; a viewer searching never loses their answer (chat always replies). **Mod actions, `!setgame`, EventSub, and the control panel preempt** — they clear the queue + current overlay and take the slot immediately. `!hide`/`!overlays off` clear everything |

---

## 3. Tech stack

| Concern | Choice |
|---|---|
| Runtime | Node 22 + TypeScript 5 (ESM); native `fetch`, `--env-file` |
| Process | Single Node process: bot + Fastify HTTP/WS server + serves overlay build |
| Twitch chat | `@twurple/auth` + `@twurple/chat` |
| Twitch events | `@twurple/eventsub-ws` (`EventSubWsListener.onChannelUpdate`) |
| Twitch API | `@twurple/api` (resolve broadcaster id, initial category at boot) |
| Web + WS | Fastify v5 + `@fastify/websocket` + `@fastify/static` |
| Overlay UI | Vite + Vue 3 + Tailwind |
| Config | `.env` (via `--env-file`) validated with zod |
| Logging | pino (+ pino-pretty dev), API token scrubbed |
| Dev runner | tsx watch (server) + vite (overlay) via concurrently |
| YouTube (later) | googleapis v3 `liveChatMessages` |

---

## 4. The contract: GameStack public API

Base `http://localhost:5259/api/public/v1`. Auth header `X-Api-Key: <token>` (or `Authorization`).
Rate limit **60/min/key** → `429 + Retry-After`. Responses are **camelCase** JSON,
`Cache-Control: private, max-age=30`.

| Method · Route | Response |
|---|---|
| `GET /shelves` | `PublicShelfDto[]` |
| `GET /shelves/{slug}?skip&take` (take 1–100, def 24) | `{slug,name,description,items:PublicGameDto[],totalCount,hasMore}` |
| `GET /games/{id}` | `PublicGameDto` (404 if outside visible scope) |
| `GET /games/search?q&platform` | `PublicGameDto[]` (q ≥ 2 chars, ≤ 15, fuzzy trigram) |

```ts
PublicShelfDto = { slug: string; name: string; description: string | null; gameCount: number }
PublicGameDto  = {
  id: string; title: string; platform: string; copyCount: number;
  coverImageUrl: string | null;   // RELATIVE, e.g. "/api/games/{id}/image" — resolve vs backend origin
  description: string | null; genres: string[]; releaseYear: number | null; rating: number | null; // 0–100
}
```

**Cover image gotcha:** `coverImageUrl` is a **relative** path and must be resolved against the
**backend origin** (`http://localhost:5259`), NOT the `/api/public/v1` base. The image route is
**anonymous**, so overlay `<img>` tags load it directly with no key. (Source of truth:
`backend/Endpoints/PublicApi/PublicGameQuery.cs`.)

---

## 5. Architecture & data flow

```
Viewer "!shelf retro"  → TwitchChatSource (@twurple) → ChatMessage{text,user{isBroadcaster,isMod}}
  → CommandRegistry: strip prefix → permission check → availability/gating check → cooldown
  → handler → GameStackClient.getShelf("retro")  (cache 30s; 429 → back off + reply)
  → resolve cover URLs (relative → http://localhost:5259/api/games/{id}/image)
  → store.setActiveOverlay + OverlayBus.broadcast({type:'show',overlay:'collection',data})
  → WebSocket /ws → overlay SPA renders CollectionGrid.vue (animated)
  → handler.reply("Showing the Retro shelf — 42 games")  → back into chat
```

- **OBS:** one Browser Source → overlay `#/stage` (dev: Vite `:5173`; prod: Fastify `:STREAMKIT_PORT`),
  transparent bg. A single source shows/swaps/hides overlays from broadcast events.
- **Connect-time replay:** on WS connect the server replays the active overlay + current game so a
  freshly-reloaded OBS source shows the right thing immediately.

### Current game — three-state model

GameStack tracks a *physical* collection, so a digital-only game you stream legitimately isn't in
it. That's a first-class state, not a failure:

```ts
type CurrentGame =
  | { status: 'tracked';   game: PublicGameDto; categoryName: string }  // in the collection
  | { status: 'untracked'; categoryName: string }                       // playing it, not in library
  | { status: 'none' }                                                  // nothing set yet
```

Set three ways, all through the shared `setCurrentGameByName(name, platform?)` service
(search → top fuzzy match → `tracked`, else `untracked` keeping the category name → store →
broadcast):
1. **Auto (primary):** EventSub `channel.update` → `categoryName`.
2. **Manual:** mod-only `!setgame <query>`.
3. Control panel `POST /control/setgame` (Phase 2).

At startup (EventSub on) the current category is fetched once via Helix (`getChannelInfoById`) so
state reflects real play immediately rather than sitting at `none`.

### Command gating (untracked feature)

Each command declares `availability: 'always' | 'blockedWhenUntracked'`. The registry checks it
(after permissions, before cooldown):
- `blockedWhenUntracked` commands are **blocked with a friendly chat explanation only when
  `status === 'untracked'`** (e.g. *"Currently playing Hades II, which isn't in my physical
  collection — that command's off right now"*).
- The `none` state (nothing set yet — normal in Phase 1 before EventSub/`!setgame`) does **not**
  block them; the handler decides what to do (e.g. `!nowplaying` replies "no current game set yet",
  `!game` search just runs). This keeps search usable when we simply don't know what's playing,
  while still gating it off when we *know* it's an off-library game.
- `always` commands (browsing) keep working in every state.

The NowPlaying overlay shows nothing (or a minimal "not in collection" note) while untracked.

---

## 6. Commands

| Command | Perm | Avail. | Cooldown | Action |
|---|---|---|---|---|
| `!help` / `!commands` | Everyone | always | 8s | chat: list available commands (mod cmds shown only to mods) |
| `!games` | Everyone | always | 10s | chat: list shelves with slugs + a `!shelf <slug>` example |
| `!shelf <name>` | Everyone | always | 8s | **chat only**: list a shelf's games (no overlay — mods use `!showcollection`) |
| `!game <query>` | Everyone | blockedWhenUntracked | 8s | `searchGames(q)` → **queued** corner card of top match (auto-hide 15s); chat reply always sent with title, year, platform, rating + an IGDB "find out more" link |
| `!nowplaying` / `!np` | Everyone | blockedWhenUntracked | 8s | current game → NowPlaying corner card (15s) + chat |
| `!setgame <query>` | Mod | always | 3s | `setCurrentGameByName` → flash NowPlaying (15s) + confirm |
| `!showcollection [shelf]` | Mod | always | 5s | **CollectionGrid** slideshow (mod-only) — 18 games/page, advances every 10s, hides after the last page |
| `!hide` | Mod | always | 1s | hide the current overlay |
| `!overlays <on\|off>` | Mod | always | 1s | master switch: suppress/allow all on-screen overlays (chat unaffected) |

`Permission { Everyone, Mod, Broadcaster }` resolved from `@twurple` `userInfo.isBroadcaster/isMod`.
Command prefix configurable (default `!`).

**Cooldowns** are global per command (channel-wide, keyed by canonical name). When a command is on
cooldown the registry replies **once per cooldown window** (e.g. *"@user !shelf is cooling down — try
again in 6s"*) then stays silent for the remainder, so a user always gets confirmation their command
registered without the bot spamming. Shortened in this revision (e.g. `!shelf` 20s → 8s) for snappier
testing/use.

---

## 7. Overlays

One OBS source at `#/stage` renders whichever overlay is active. Shared `GameCard.vue` handles
`coverImageUrl === null`. `useOverlaySocket.ts` manages WS auto-reconnect (OBS reloads sources). The
`OverlayBus` enforces the stream-safe policy: a single display slot with **auto-dismiss
(`OVERLAY_TTL_MS` = 15s)**, a **viewer queue** (`enqueue`, bounded), **mod preemption**
(`showPriority`/`hide`), and the `!overlays` master switch (`setEnabled`). NowPlaying and SearchPopup
share one rich **`GameInfoCard`** (cover, label, platform/year/copies pills, genres, rating bar, short
description).

| Overlay | Size / position | Trigger | Renders |
|---|---|---|---|
| **NowPlaying** | compact, bottom-left, 15s | `!nowplaying`, `!setgame`, EventSub, panel | `GameInfoCard` labelled "Now Playing" |
| **SearchPopup** | compact, bottom-right, 15s | `!game <query>` (viewer, **queued**), panel | `GameInfoCard` labelled `Searched "…"` (top match) |
| **CollectionGrid** | large, centered — **mod-only** | `!showcollection [shelf]`, panel | **slideshow**: 18 games/page, auto-advances every 10s with a `n / N` page indicator, hides after the last page |

```ts
type OverlayEvent =
  | { type:'show'; overlay:'now-playing'; data: GameView; ttlMs?: number }
  | { type:'show'; overlay:'collection';  data: { title:string; items: GameView[] } }
  | { type:'show'; overlay:'search';      data: { query:string; items: GameView[] }; ttlMs?: number }
  | { type:'hide' }
  | { type:'state'; currentGame: GameView | null }   // replayed on connect
```

---

## 8. ChatSource interface (Twitch now, YouTube later)

```ts
interface ChatUser { id; displayName; isBroadcaster; isMod }
interface ChatMessage { source:'twitch'|'youtube'; channel; text; user; reply(text):Promise<void> }
interface ChatSource { name; start(); stop(); onMessage(handler) }
```

- **TwitchChatSource** (Phase 1): `@twurple` StaticAuthProvider(bot token) + ChatClient; `reply =
  client.say(channel,…)`.
- **YouTubeChatSource** (Phase 3): googleapis OAuth + `liveChatMessages.list` polling + quota
  backoff. Hidden behind the same interface; `chat/index.ts` fans every enabled source into one
  registry.

---

## 9. Configuration (`.env`)

```
# GameStack public API
GAMESTACK_API_BASE=http://localhost:5259/api/public/v1
GAMESTACK_BACKEND_ORIGIN=http://localhost:5259      # resolves cover images
GAMESTACK_API_KEY=gs_dev_xxxxxxxxxxxx

# Twitch chat (bot account — read & reply)
TWITCH_CHANNEL=your_channel
TWITCH_BOT_USERNAME=your_bot_account
TWITCH_BOT_OAUTH=oauth:xxxxxxxxxxxx

# Twitch EventSub auto-now-playing (Phase 2; channel.update needs no scope but a *broadcaster* user token)
TWITCH_EVENTSUB_ENABLED=false
TWITCH_CLIENT_ID=xxxxxxxxxxxx
TWITCH_CLIENT_SECRET=xxxxxxxxxxxx
TWITCH_BROADCASTER_TOKEN=xxxxxxxxxxxx
TWITCH_BROADCASTER_REFRESH=xxxxxxxxxxxx

# Server
STREAMKIT_PORT=8420
COMMAND_PREFIX=!

# YouTube (Phase 3)
YOUTUBE_ENABLED=false
```

Notes: mint the API key in the GameStack app; **never render it in an overlay** (it's one-click
revocable and must not appear on stream). EventSub uses `RefreshingAuthProvider` so the broadcaster
token auto-renews (a static user token expires in ~4h and would silently stop EventSub).

---

## 10. Project layout

```
streamkit/
├── package.json  tsconfig.json  .gitignore  .env.example  README.md
├── vite.config.ts  tailwind.config.ts  postcss.config.js
├── src/                         # Node service (bot + server)
│   ├── index.ts  config.ts  logger.ts
│   ├── api/        types.ts  cache.ts  images.ts  client.ts
│   ├── chat/       ChatSource.ts  TwitchChatSource.ts  index.ts
│   ├── events/     twitchEventSub.ts                       (Phase 2)
│   ├── commands/   types.ts  registry.ts  handlers/*.ts
│   ├── state/      store.ts  setCurrentGame.ts
│   ├── overlay/    events.ts  bus.ts
│   └── server/     http.ts  ws.ts
└── overlay/                     # Vite SPA (OBS browser source)
    ├── index.html  control.html (Phase 2)
    └── src/ main.ts  App.vue  useOverlaySocket.ts  useBackendOrigin.ts
        overlays/ NowPlaying.vue  CollectionGrid.vue(P2)  SearchPopup.vue(P2)
        components/ GameCard.vue
        assets/ overlay.css
```

`src/` runs via tsx (dev) / tsc (build). `overlay/` builds via Vite → `overlay-dist/`, served by
Fastify in prod. Dev runs both with `concurrently`.

---

## 11. Build phasing

- **Phase 1 — walking skeleton:** scaffold; config+logger; API client; Twitch chat read+reply;
  command registry + read-only handlers (`!games`, `!shelf`, `!game`, `!nowplaying`); Fastify
  HTTP+WS; NowPlaying overlay; boot-time `listShelves()` smoke test.
- **Phase 2 — state + control + more overlays:** three-state store + `setCurrentGame` service +
  connect replay; mod commands (`!setgame`, `!showcollection`, `!hide`); untracked gating;
  EventSub auto-now-playing; CollectionGrid + SearchPopup; control panel.
- **Phase 3 — YouTube + polish:** YouTubeChatSource; multi-source fan-in; animation/theme polish;
  reconnect/log hardening.

> Phasing note: the three-state model, gating, and EventSub are *designed in* from the start (types
> and interfaces account for them in Phase 1) but the active wiring lands in Phase 2.

---

## 12. Verification (end-to-end)

1. Backend running (`cd backend && dotnet run`, :5259) with a public API key minted into
   `streamkit/.env`.
2. `cd streamkit && npm install && npm run dev` (bot + overlay Vite server).
3. **Smoke test:** boot logs the result of `listShelves()` — confirms auth + connectivity before chat.
4. **Overlay:** open the overlay `#/stage` in a browser; a triggered event renders NowPlaying with
   cover art loaded from `:5259/api/games/{id}/image`.
5. **Chat:** in the channel, `!game zelda` → SearchPopup + chat reply; `!shelf <slug>` → grid.
6. **Permissions/cooldown/429:** non-mod `!setgame` rejected; repeated `!games` within cooldown
   ignored; a 429 is handled gracefully.
7. **EventSub + untracked (Phase 2):** switch Twitch category to a collection game → NowPlaying
   updates, gated commands work; switch to a digital-only game → `untracked`, gated commands give
   the friendly reply while `!games`/`!shelf` still work; switch back → re-enabled.
8. **OBS:** Browser Source at the overlay URL, transparent bg, composites over game capture.

---

## Build Status

Legend: ☐ todo · ◐ in progress · ☑ done

### Phase 1 — COMPLETE ✅
- ☑ Design doc (`docs/streamkit-design.md`)
- ☑ Scaffold `streamkit/` (package.json, tsconfig, configs, .env.example, README, .gitignore)
- ☑ `config.ts` + `logger.ts`
- ☑ API client (`api/{types,cache,images,client}.ts`)
- ☑ Chat (`chat/{ChatSource,TwitchChatSource,index}.ts`)
- ☑ Commands (`commands/{types,registry}` + read-only handlers `games/shelf/game/nowplaying`)
- ☑ Server + bus (`server/{http,ws}`, `overlay/{events,bus}`)
- ☑ NowPlaying overlay SPA (`overlay/…`)
- ☑ `index.ts` wiring + boot `listShelves()` smoke test + dev `/debug/show?q=` route
- ☑ `npm install` + `tsc --noEmit` clean + `vite build` clean + server boots (/health, overlay served)

Verified locally: server type-checks, overlay builds, the process boots and serves `/health` +
the overlay, WS endpoint registers. End-to-end with live data still needs the backend running +
a real API key in `.env` (and Twitch creds for chat) — see [Verification](#12-verification-end-to-end).

### Phase 2 — COMPLETE ✅
- ☑ `setCurrentGameByName` shared service (`state/setCurrentGame.ts`) — tracked/untracked + broadcast
- ☑ Mod commands: `!setgame`, `!showcollection [shelf]`, `!hide`
- ☑ Updated handlers: `!shelf` now drives CollectionGrid, `!game` drives SearchPopup
- ☑ Untracked gating live end-to-end (registry already enforced it; EventSub/`!setgame` now produce the state)
- ☑ EventSub auto-now-playing (`events/twitchEventSub.ts`) — RefreshingAuthProvider +
  `EventSubWsListener.onChannelUpdate` → `setCurrentGameByName`; seeds initial category via Helix;
  optional via `TWITCH_EVENTSUB_ENABLED`, guarded so a bad token can't crash the app
- ☑ CollectionGrid + SearchPopup overlays; App.vue renders all three with positioning + transitions
- ☑ Control panel at `GET /control` (+ `POST /control/{setgame,search,showcollection,hide}`)
- ☑ Config extended (`EventSubConfig`); `@twurple/eventsub-ws` added
- ☑ Verified: `tsc --noEmit` clean · `vite build` clean (26 modules) · server boots · `/control` +
  `/control/hide` + WS confirmed working

Impl deviations from the original plan (intentional, simpler):
- Control panel is a **self-contained HTML page served by Fastify** (`server/control.ts`), not a
  second Vite `control.html` entry — always available on the server port, no extra build wiring.
- `!games` stays **chat-only** (it's a shelf *directory*); the CollectionGrid is driven by
  `!shelf` / `!showcollection`.
- The dev `/debug/show` route moved into `server/control.ts` alongside the control routes.

### Phase 3 — not started
YouTubeChatSource · multi-source fan-in · animation/theme polish · reconnect/log hardening.

---

## Changelog
- _(init)_ — Doc created; Phase 1 build starting.
- Phase 1 implemented: scaffold, config/logger, API client, Twitch chat (read+reply), command
  registry + `games/shelf/game/nowplaying`, Fastify HTTP+WS, overlay bus, NowPlaying overlay SPA,
  `index.ts` wiring + boot smoke test + dev `/debug/show` route. Verified: typecheck + overlay
  build + server boot all clean.
- Refined gating during impl: `availability` is `'always' | 'blockedWhenUntracked'` (blocks only on
  the explicit `untracked` state, not `none`), so search stays usable when current game is unknown.
- Phase 2 implemented: `setCurrentGameByName` service, mod commands (`!setgame`/`!showcollection`/
  `!hide`), `!shelf`→CollectionGrid + `!game`→SearchPopup, EventSub auto-now-playing
  (RefreshingAuthProvider + channel.update + Helix seed), CollectionGrid + SearchPopup overlays,
  and a Fastify-served control panel. Typecheck + build + boot all clean.
- Added `!help` / `!commands`: lists available commands, built dynamically from the registry
  (`list()`), shows mod commands only to mods, and renders with the configured prefix. Commands now
  carry an optional `usage` hint; `CommandContext` exposes `prefix` + `commands`.
- `!games` now shows each shelf's **slug** plus a real `!shelf <slug>` example.
- **Stream-safe overlay policy:** viewer commands produce only compact, auto-dismissing corner cards
  (or chat); `!shelf` is now chat-only and `!game` shows a single corner card. The big CollectionGrid
  is mod-only (`!showcollection`). Added `!overlays on/off` master switch (+ control-panel buttons +
  `POST /control/overlays`). The `OverlayBus` gained persistent-vs-transient layering (transient
  cards revert to the persistent now-playing on expiry) and master enable/disable.
- **Reversed the persistence:** per preference, **no overlay stays on screen** — every overlay now
  auto-dismisses after `OVERLAY_TTL_MS` (15s), including now-playing and the collection grid. The
  `OverlayBus` was simplified back to a single transient model (auto-hide + master switch); the
  persistent/restore layering is gone. Current-game *state* still persists in the store for
  `!nowplaying` and gating. 15s is a single shared constant in `overlay/events.ts`.
- **Overlay queue + mod preemption:** the `OverlayBus` went from last-write-wins to a single slot
  with a bounded **viewer queue** (`enqueue`) and **mod/authoritative preemption** (`showPriority`,
  `hide`, `sendState`). Viewer cards (`!game`, `!nowplaying`) queue and play in turn; mod actions,
  `!setgame`, EventSub, and the control panel clear the queue and show now. Call sites updated.
- **Rich `!game` reply + IGDB link:** chat now answers with title, year, platform, rating, and a
  "find out more" IGDB link (`api/igdb.ts` — direct `igdb.com/games/{slug}` via the new public-API
  `igdbSlug` field, with a title-search fallback). The answer is sent even when the card is queued.
- **Richer info card:** NowPlaying + SearchPopup now share `GameInfoCard.vue` — adds a short
  description line alongside platform/year/copies/genres/rating. Backend `PublicGameDto` gained
  `IgdbSlug` (catalog data, LINQ-only projection).
- **Cooldown feedback + shorter cooldowns:** a command on cooldown was silently dropped (confusing —
  "did my command even send?"). The registry now replies **once per cooldown window** with the
  remaining time, then stays quiet. Viewer cooldowns shortened (`!games` 30→10s, `!shelf` 20→8s,
  `!game`/`!nowplaying`/`!help` 15→8s). Model unchanged (global per command, mods not exempted).
- **CollectionGrid is now a slideshow:** instead of showing one page and vanishing, it pages through
  the shelf (`COLLECTION_PAGE_SIZE` = 18 games/page) advancing every `COLLECTION_PAGE_MS` (10s),
  with a `n / N` page indicator, and hides after the last page. The server fetches up to
  `COLLECTION_MAX_ITEMS` (100), sends the full set + page size/interval, and sets the overlay `ttlMs`
  to `pages × 10s`; the overlay component does the client-side paging (so the bus stays simple).
