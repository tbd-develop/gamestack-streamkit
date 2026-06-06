import type { Command } from '../types.js'
import { gamesCommand } from './games.js'
import { shelfCommand } from './shelf.js'
import { gameCommand } from './game.js'
import { nowPlayingCommand } from './nowplaying.js'
import { setGameCommand } from './setgame.js'
import { showCollectionCommand } from './showcollection.js'
import { hideCommand } from './hide.js'
import { overlaysCommand } from './overlays.js'
import { helpCommand } from './help.js'

/** All commands (Phase 1 read-only + Phase 2 mod controls + help). */
export const allCommands: Command[] = [
  helpCommand,
  gamesCommand,
  shelfCommand,
  gameCommand,
  nowPlayingCommand,
  setGameCommand,
  showCollectionCommand,
  hideCommand,
  overlaysCommand,
]

/** @deprecated kept for compatibility — use {@link allCommands}. */
export const phase1Commands = allCommands
