import { Permission, type Command } from '../types.js'
import { OVERLAY_TTL_MS } from '../../overlay/events.js'

/** !nowplaying / !np — show the current game (if it's a tracked collection game). */
export const nowPlayingCommand: Command = {
  name: 'nowplaying',
  aliases: ['np'],
  permission: Permission.Everyone,
  availability: 'blockedWhenUntracked',
  cooldownSeconds: 8,
  async run({ store, bus, reply }) {
    const cg = store.currentGame
    if (cg.status === 'tracked') {
      bus.enqueue({ type: 'show', overlay: 'now-playing', data: cg.game, ttlMs: OVERLAY_TTL_MS })
      const year = cg.game.releaseYear ? ` (${cg.game.releaseYear})` : ''
      await reply(`Now playing: ${cg.game.title}${year} on ${cg.game.platform}.`)
      return
    }
    // 'untracked' is already blocked upstream; this is the 'none' case.
    await reply('No current game set yet.')
  },
}
