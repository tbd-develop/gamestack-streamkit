import type { GameView } from '../api/types.js'

/**
 * The game currently being streamed, as understood by StreamKit.
 * GameStack tracks a *physical* collection, so a digital-only game legitimately isn't in it —
 * that's the first-class `untracked` state, distinct from `none` (nothing set yet).
 */
export type CurrentGame =
  | { status: 'tracked'; game: GameView; categoryName: string }
  | { status: 'untracked'; categoryName: string }
  | { status: 'none' }

/** In-memory app state. (Phase 2 may persist currentGame to state.json.) */
export class Store {
  private _currentGame: CurrentGame = { status: 'none' }

  get currentGame(): CurrentGame {
    return this._currentGame
  }

  setCurrentGame(cg: CurrentGame): void {
    this._currentGame = cg
  }
}
