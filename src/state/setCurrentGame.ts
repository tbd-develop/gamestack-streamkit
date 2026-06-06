import type { GameStackClient } from '../api/client.js'
import type { OverlayBus } from '../overlay/bus.js'
import { OVERLAY_TTL_MS } from '../overlay/events.js'
import type { CurrentGame, Store } from './store.js'
import { logger } from '../logger.js'

export interface CurrentGameDeps {
  api: GameStackClient
  store: Store
  bus: OverlayBus
}

/**
 * Set the "currently playing" game from a category/title name. Single source of truth used by
 * `!setgame`, the control panel, and Twitch EventSub.
 *
 * - Match found  → `tracked`: store it, flash the NowPlaying card (auto-dismisses after 15s).
 * - No match     → `untracked`: remember the name (so gated commands can explain), hide the card.
 *
 * The store keeps the current game regardless of the card's visibility — `!nowplaying` and command
 * gating use the stored state, not what's on screen.
 */
export async function setCurrentGameByName(
  deps: CurrentGameDeps,
  name: string,
  platform?: string,
): Promise<CurrentGame> {
  const term = name?.trim() ?? ''
  if (term.length < 2) {
    const cg: CurrentGame = { status: 'none' }
    deps.store.setCurrentGame(cg)
    deps.bus.sendState(null)
    return cg
  }

  let results
  try {
    results = await deps.api.searchGames(term, platform)
  } catch (err) {
    logger.warn({ err, term }, 'setCurrentGame search failed; leaving state unchanged')
    return deps.store.currentGame
  }

  const top = results[0]
  if (top) {
    const cg: CurrentGame = { status: 'tracked', game: top, categoryName: term }
    deps.store.setCurrentGame(cg)
    // Authoritative state change → preempt whatever's on screen / queued.
    deps.bus.showPriority({ type: 'show', overlay: 'now-playing', data: top, ttlMs: OVERLAY_TTL_MS })
    deps.bus.sendState(top)
    logger.info({ category: term, matched: top.title }, 'current game → tracked')
    return cg
  }

  const cg: CurrentGame = { status: 'untracked', categoryName: term }
  deps.store.setCurrentGame(cg)
  deps.bus.hide()
  deps.bus.sendState(null)
  logger.info({ category: term }, 'current game → untracked (not in collection)')
  return cg
}
