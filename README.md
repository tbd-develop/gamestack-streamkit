# GameStack StreamKit

A **standalone local** streaming toolkit for GameStack. It connects to Twitch chat, listens for
viewer `!commands`, queries the GameStack **public API**, and drives **OBS browser-source overlays**
(a "now playing" card, collection/shelf showcases, search popups).

> **This is NOT part of the website.** It runs as its own process, started manually only when you
> stream, and talks to GameStack purely over HTTP via an API key. It does not share a database,
> port, or runtime with the GameStack `frontend/` or `backend/`. See
> [`docs/streamkit-design.md`](docs/streamkit-design.md).

---

## Prerequisites

- **Node.js ≥ 22** (`node --version`).
- **The GameStack backend running** and reachable (default `http://localhost:5259`). StreamKit talks
  to it over HTTP — start it with `cd backend && dotnet run`.
- **A GameStack API key.** Mint one in the app at **Settings → API keys**. It authenticates
  StreamKit against the read-only public API. **Never show this key on stream** — it's one-click
  revocable in the app.
- **OBS** (or any browser) to display the overlay.
- *(Optional)* **Twitch credentials** — only needed for the chat bot and auto now-playing. StreamKit
  runs fully without them; you drive the overlays from the control panel instead.

---

## Quick start

```bash
cd streamkit
npm install
cp .env.example .env        # then fill in GAMESTACK_API_KEY (Twitch creds optional)
npm run dev
```

That's enough to get overlays working. On boot StreamKit does a `listShelves()` smoke test against
the API and logs the result, so you can confirm connectivity before wiring up Twitch or OBS.

---

## Running StreamKit

StreamKit has two parts: the **bot/server** (`http://localhost:8420` — API client, overlay
WebSocket, control panel) and the **overlay SPA** (the page OBS displays). There are two ways to run
them:

### Dev (live reload)

```bash
npm run dev
```

Runs both together:
- **bot + server** → `http://localhost:8420`
- **overlay dev server** (Vite) → `http://localhost:5173`

Use this while configuring or developing — both restart on file changes.

### Prod (single process)

```bash
npm run build      # bundles the overlay into overlay-dist/
npm start          # bot/server serves the built overlay from :8420
```

Here the bot process serves everything on `8420` — there's no separate `5173`.

### What success looks like

Watch the startup logs for:
- `StreamKit server on http://localhost:8420 (overlay WS /ws · control panel /control)`
- `GameStack public API reachable { shelfCount: N, shelves: [...] }` — the smoke test passed.
  - If you see `GameStack API smoke test FAILED`, check `GAMESTACK_API_BASE` / `GAMESTACK_API_KEY`
    and that the **backend is running**.
- Without Twitch creds: `No chat sources configured … running API + overlay only.` (expected).

### The two URLs to remember

| Purpose | URL (prod) |
|---|---|
| **Overlay** — paste into **OBS** as a Browser Source | `http://localhost:8420/#/stage` |
| **Manage** — open in a **browser** to drive the overlay | `http://localhost:8420/control` |

> During `npm run dev`, the overlay is at `http://localhost:5173/#/stage`; the manage URL stays on
> `8420`. Details for each below.

---

## Using the overlay in OBS

**👉 Put this link in OBS** — add a **Browser Source** and paste this as its URL:

```
http://localhost:8420/#/stage
```

> Use `http://localhost:5173/#/stage` instead **only** while running `npm run dev` (the Vite dev
> server). After `npm run build` + `npm start`, use the `:8420` link above — that's the one for
> normal streaming.

Set the Browser Source to your canvas size with a **transparent background**.

> **The overlay is event-driven — it starts empty.** Nothing shows until something triggers an
> overlay (a chat command, the control panel, or the debug endpoint below). That's by design: it
> floats invisibly over your gameplay until called. **Every overlay also auto-dismisses after 15
> seconds**, so nothing lingers over the action.

To trigger overlays you have three options — you only need one:
1. **Control panel** (no Twitch needed) — see below.
2. **Twitch chat commands** — see [Twitch bot](#twitch-bot).
3. **Debug endpoint** (quick browser test): open `http://localhost:8420/debug/show?q=zelda` and the
   search popup appears on the stage for the top match.

### Theming

The overlays ship with a **Default** theme but are fully re-skinnable — font, panel colour, border,
shadows, accents and more. Drop a CSS file in `overlay/public/themes/` and select it by adding
`?theme=<name>` to the browser-source URL (before the `#`):

```
http://localhost:8420/?theme=synthwave#/stage
```

Two example themes (`synthwave`, `daylight`) are included. Full token reference and a step-by-step
guide: **[docs/streamkit-overlay-theming.md](docs/streamkit-overlay-theming.md)**.

---

## Managing the overlay (control panel)

**👉 Connect to this URL to manage the overlay** — open it in any browser (not OBS):

```
http://localhost:8420/control
```

This is a local web page to drive overlays **without chat** — ideal for testing, for running solo,
or as a broadcaster dashboard. From it you can set the current game, fire a search popup, show a
collection slideshow, hide the current overlay, and flip the master **Overlays ON/OFF** switch. Each
action drives the same overlay your OBS browser source is showing, in real time.

> Same `8420` address in both dev and prod — the bot process always serves the control panel there,
> even when the overlay itself is on `5173` during `npm run dev`.

---

## Twitch bot

Twitch is **optional**. Leave the `TWITCH_*` vars blank and StreamKit runs the API client + overlay
server + control panel only (no chat). Fill them in to enable the chat bot, and optionally auto
now-playing.

**Setup is its own guide:** **[TWITCH_SETUP.md](TWITCH_SETUP.md)** walks you from zero — registering
a Twitch app, getting the bot's chat token and (optionally) the broadcaster token for auto
now-playing, filling in `.env`, and verifying it works. The short version:

- Chat runs over **EventSub** (not legacy IRC) using a **refreshing** token, so it no longer dies
  after ~4 hours.
- The chat bot needs all of `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BOT_TOKEN`,
  `TWITCH_BOT_REFRESH`, `TWITCH_CHANNEL` (set together, or all blank).
- Auto now-playing (set the current game from your Twitch category) is opt-in via
  `TWITCH_EVENTSUB_ENABLED=true` plus the broadcaster token vars.

All config is via `.env` — see [`.env.example`](.env.example) for the annotated list.

---

## Commands

| Command | Who | What |
|---|---|---|
| `!help` / `!commands` | everyone | list available commands (chat) |
| `!games` | everyone | list your shelves with slugs (chat) |
| `!shelf <name>` | everyone | list a shelf's games (chat only) |
| `!game <title>` | everyone | search; shows a **small auto-dismissing corner card** of the top match |
| `!nowplaying` / `!np` | everyone | show the current game's card |
| `!setgame <title>` | mods | set the current game manually |
| `!showcollection [shelf]` | mods | **collection slideshow** (mod-only) — pages through the shelf, 10s/page |
| `!hide` | mods | hide the current overlay |
| `!overlays <on\|off>` | mods | master switch — suppress/allow all on-screen overlays |

**Stream-safe by design:** **every overlay auto-dismisses after 15 seconds** — nothing stays on
screen over your gameplay. Viewer commands only ever produce a small corner card (or a chat reply);
the big screen-covering grid is mod-only; and `!overlays off` instantly clears the screen during
intense moments (chat replies keep working).

`!help` only shows mod commands to mods. The current game can also be set **automatically** from
your Twitch category via EventSub — see the [Twitch setup guide](TWITCH_SETUP.md). YouTube support
is a later phase — see the design doc.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | bot/server + overlay dev server (watch) |
| `npm run build` | build the overlay SPA → `overlay-dist/` |
| `npm start` | run the bot/server (serves the built overlay) |
| `npm run typecheck` | type-check the server code |
