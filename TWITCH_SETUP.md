# Connecting StreamKit to Twitch

This walks you from zero to a working Twitch connection for StreamKit. There are **two** Twitch
pieces and they use different credentials:

| Piece | What it does | Needs |
|---|---|---|
| **Chat bot** | reads `!commands`, replies in chat (over **EventSub**, not IRC) | a **bot-account** token with `user:read:chat` + `user:write:chat` **+ its refresh token** |
| **Auto now-playing** (optional) | sets the current game when you change your Twitch category | a **broadcaster-account** token (your channel) **+ its refresh token** |

Both are issued by **one Twitch application** you register (so they share a Client ID, and the app's
Client Secret powers the auto-refresh on **both** tokens). Do Steps 1–3 for chat; add Step 4 for auto
now-playing.

> **Why EventSub and not IRC?** Twitch's current recommendation for bots is to read chat via the
> EventSub `channel.chat.message` subscription and send replies via the Helix API — not the legacy
> IRC gateway. StreamKit uses a *refreshing* token for the bot, so it no longer dies after ~4 hours
> the way the old static IRC token did.

> You can run StreamKit with **no** Twitch creds at all — the API + overlays + `/control` panel work
> standalone. Twitch just adds the chat bot and auto-detection.

---

## Step 0 — Decide on a bot account (optional but recommended)

The chat bot posts replies as whatever Twitch account you authorize in Step 3.
- **Recommended:** make a **second Twitch account** (e.g. `mycoolbot`) so messages come from the bot,
  not you. Free — just sign up with another email.
- **Simplest:** use your own account; replies come from you.

Either way, in Step 3 you'll log in **as the account you want the bot to speak as**.

If your channel uses follower-only / verified-only chat, make the bot account follow/verify (and
optionally `/mod yourbotname`) so its messages aren't blocked.

---

## Step 1 — Register a Twitch application

1. Go to the **Twitch Developer Console** → <https://dev.twitch.tv/console/apps> → **Register Your Application**.
2. Fill in:
   - **Name:** anything unique, e.g. `GameStack StreamKit`
   - **OAuth Redirect URLs:** `http://localhost:3000` **and** `http://localhost:3030` (add both —
     see the port-conflict note in Step 3; GameStack's frontend already uses 3000)
   - **Category:** *Application Integration* (or *Chat Bot*)
   - **Client Type:** **Confidential**  ← required so you get a Client Secret
3. **Create**, then open the app and copy:
   - **Client ID** → this is `TWITCH_CLIENT_ID`
   - Click **New Secret** → copy the **Client Secret** → this is `TWITCH_CLIENT_SECRET` (now needed for the chat bot too — it powers token refresh)

> **⚠️ "Redirect URLs must use HTTPS protocol" error?**
> Twitch requires HTTPS for redirect URLs **except for `localhost`**, where `http://localhost:3000`
> is allowed (it's the Twitch CLI default, and what Twitch's own docs use). That error is a known
> **console UX quirk**, not a real rejection of localhost — it's triggered by a leftover **blank
> redirect row** or by clicking the inline **Add** button. Fix: type `http://localhost:3000`, make
> sure there are no empty redirect fields, and use the page's **Save** button. It saves fine.
> `localhost` is the only host where `http://` is permitted — any other host must be `https://`.

> Keep the Client Secret private — never put it in an overlay or commit it.

---

## Step 2 — Install & configure the Twitch CLI

The Twitch CLI runs the OAuth login locally and prints tokens. It's the most reliable way to get
**user** tokens with refresh tokens.

**Install (Windows):**
```powershell
# with Scoop:
scoop install twitch-cli
# or download the latest release .exe from https://github.com/twitchdev/twitch-cli/releases
```

**Configure it with your app's credentials:**
```powershell
twitch configure
# paste your Client ID and Client Secret when prompted
```

---

## Step 3 — Get the bot **chat** token

Log into the **bot account** in your browser first (or use a private/incognito window so you control
which account authorizes). Then:

```powershell
twitch token -u -s "user:read:chat user:write:chat user:bot" -p 3030
```

> **Scopes changed:** chat now runs over EventSub, so the bot needs `user:read:chat` (read) +
> `user:write:chat` (reply) instead of the old IRC `chat:read`/`chat:edit`. `user:bot` is included
> so a *separate* bot account can read/post in your channel; if the bot is a different account, also
> `/mod yourbotname` on your channel (or the broadcaster grants `channel:bot`) so replies aren't
> blocked. If the bot **is** your own account, `user:bot` is harmless.

> **⚠️ Port 3000 conflict (important for GameStack).** The Twitch CLI defaults to a callback on
> `http://localhost:3000` — **the same port GameStack's Nuxt frontend uses**. If the frontend (or
> anything else) is on 3000, the OAuth redirect hits *that* instead of the CLI, the browser shows the
> wrong page, and **no token is captured**. Fix: run the CLI on a free port with `-p 3030` (and make
> sure `http://localhost:3030` is registered as a redirect URL in Step 1). Alternatively, stop the
> frontend first and omit `-p`. If a previous attempt is hung, `Ctrl+C` it before retrying.

- A browser opens → authorize as the **bot account**.
- The CLI prints a **User Access Token** and a **Refresh Token** — you need **both** now.
- Copy the **User Access Token** → `TWITCH_BOT_TOKEN`
- Copy the **Refresh Token** → `TWITCH_BOT_REFRESH`

That's what the chat bot needs: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BOT_TOKEN`,
`TWITCH_BOT_REFRESH`, `TWITCH_CHANNEL`.

> ✅ **No more 4-hour expiry.** StreamKit now uses a *refreshing* auth provider for the bot, so as
> long as you supply the refresh token (and Client Secret), it renews itself — set it once.

> **Heads-up:** the old `twitchtokengenerator.com` shortcut won't work here. It issues a static
> token tied to *its* Client ID with no refresh token you can use with your app, and EventSub chat
> needs your own app's Client Secret to refresh. Use the Twitch CLI above.

---

## Step 4 — Get the **broadcaster** token for auto now-playing (optional)

This is what lets StreamKit notice when you change your Twitch category. The token must belong to
**your broadcaster account** (the channel you stream on). `channel.update` needs **no scopes**.

Log into your **broadcaster account** in the browser, then:

```powershell
twitch token -u -p 3030
```

> **Don't pass `-s ""`.** `channel.update` needs no scopes, so omit `-s` entirely. In PowerShell an
> empty-string argument to a native exe gets dropped, so `-s ""` makes the CLI read the next flag as
> the scope → `invalid scope requested: '-p'`. Just leave `-s` off.

- Authorize as your **broadcaster account**.
- Copy the **User Access Token** → `TWITCH_BROADCASTER_TOKEN`
- Copy the **Refresh Token** → `TWITCH_BROADCASTER_REFRESH`

StreamKit uses a *refreshing* auth provider here, so this one renews itself automatically — you set
it once.

> If the bot and broadcaster are the **same** account, you'll still generate two tokens (one with
> chat scopes in Step 3, one with no scopes here). That's expected.

---

## Step 5 — Fill in `.env`

In `streamkit/.env` (copy from `.env.example` if you haven't):

```ini
# Chat bot (Step 1–3)
TWITCH_CLIENT_ID=your_app_client_id
TWITCH_CLIENT_SECRET=your_app_client_secret
TWITCH_BOT_TOKEN=user_access_token_from_step_3
TWITCH_BOT_REFRESH=refresh_token_from_step_3
TWITCH_CHANNEL=your_channel_name        # the channel to read, lowercase, no '#'

# Auto now-playing (Step 1 + Step 4) — leave disabled if you skipped Step 4
TWITCH_EVENTSUB_ENABLED=true
TWITCH_BROADCASTER_TOKEN=user_access_token_from_step_4
TWITCH_BROADCASTER_REFRESH=refresh_token_from_step_4
```

Notes:
- `TWITCH_CHANNEL` is your **stream channel** (where the bot reads), not the bot's name.
- A leading `oauth:` on a token is stripped automatically, so either form is fine.
- All five chat vars are required **together** — leave them all blank to run without chat.
- `TWITCH_CLIENT_SECRET` is now shared by chat and EventSub (both refresh their tokens with it).
- If `TWITCH_EVENTSUB_ENABLED=true`, all the EventSub vars must be present or startup will tell you
  exactly which are missing.

---

## Step 6 — Run & verify

```powershell
cd streamkit
npm run dev
```

Watch the startup logs:
- **Chat connected:** you should see `Twitch chat: EventSub socket connected`, then
  `channel.chat.message subscription active ✅` and `Twitch chat: started { channel: '…' }`.
  - In your channel's chat, type `!games` → the bot replies. 🎉
- **EventSub (if enabled):** you should see `Twitch EventSub listening for channel.update` and
  `seeding initial Twitch category …`.
  - Change your stream category (Twitch dashboard → Edit Stream Info) to a game **in your collection**
    → the NowPlaying card appears on the overlay within a second or two.
  - Change to a digital-only game you **don't** own physically → it flips to *untracked*: `!nowplaying`
    and `!game` reply with the "not in my physical collection" message, while `!games`/`!shelf` still work.

You don't need to be live on Twitch for any of this — chat and category changes work even while
offline.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Bot never connects, auth/refresh error on start | Token + refresh don't match, `TWITCH_CLIENT_SECRET` is wrong, or `TWITCH_CLIENT_ID` doesn't match the app the token was issued for. Re-mint via Step 3. |
| `subscription FAILED ❌` in logs | Bot token is missing `user:read:chat`, or a separate bot account lacks permission to read the channel (add `user:bot` and `/mod yourbot`). Re-mint with the Step 3 scopes. |
| Bot connects but never replies | Bot can't post — missing `user:write:chat`, or the channel is follower/verified-only and the bot isn't eligible. Re-mint with both scopes; consider `/mod yourbot`. |
| `twitch token` redirects to localhost but **no token appears** | Port 3000 is taken (GameStack's frontend uses it), so the redirect hits the wrong app. Run with `-p 3030` and register `http://localhost:3030` (Step 3), or stop the frontend first. |
| `twitch token` fails with redirect mismatch | The redirect URL the CLI uses (`http://localhost:<port>`) must be registered in the app (Step 1). If using `-p 3030`, add `http://localhost:3030`. |
| Console says "Redirect URLs must use HTTPS protocol" | UX quirk, not a real block — `http://localhost:3000` is allowed. Remove blank redirect rows and use the page's **Save** button (see the callout in Step 1). |
| Both tokens end up on the same account | Log out / use a private window before `twitch token` so you authorize the intended account. |
| Startup error listing missing `TWITCH_*` vars | `TWITCH_EVENTSUB_ENABLED=true` but a broadcaster var is blank — fill them or set it to `false`. |
| Category change doesn't update the overlay | EventSub not enabled, broadcaster token is for the wrong account, or the new category fuzzy-matches nothing (shows as *untracked* — that's correct behavior for off-library games). Check the logs for `current game → tracked/untracked`. |
| Bot stops replying after a few hours | Used to be the static-token expiry — no longer applies; the bot token now auto-refreshes. If it still happens, the refresh failed: check `TWITCH_BOT_REFRESH` + `TWITCH_CLIENT_SECRET`. |

---

## What each credential maps to in code

- `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BOT_TOKEN`, `TWITCH_BOT_REFRESH`, `TWITCH_CHANNEL`
  → `TwitchChatSource` via `RefreshingAuthProvider` + `EventSubWsListener` (`channel.chat.message`),
  replies via `ApiClient.chat.sendChatMessage` ([src/chat/TwitchChatSource.ts](src/chat/TwitchChatSource.ts))
- `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BROADCASTER_TOKEN`, `TWITCH_BROADCASTER_REFRESH`
  → `createTwitchEventSub` via `RefreshingAuthProvider` + `EventSubWsListener`
  ([src/events/twitchEventSub.ts](src/events/twitchEventSub.ts))
- Validation/shape lives in [src/config.ts](src/config.ts).
