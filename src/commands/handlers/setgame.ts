import { Permission, type Command } from '../types.js'
import { setCurrentGameByName } from '../../state/setCurrentGame.js'

/** !setgame <title> — mod override for the current game (also settable automatically via EventSub). */
export const setGameCommand: Command = {
  name: 'setgame',
  permission: Permission.Mod,
  availability: 'always',
  cooldownSeconds: 3,
  usage: 'setgame <title>',
  async run({ args, api, store, bus, reply }) {
    const query = args.join(' ').trim()
    if (query.length < 2) {
      await reply('Usage: !setgame <title>')
      return
    }

    const cg = await setCurrentGameByName({ api, store, bus }, query)
    if (cg.status === 'tracked') {
      const year = cg.game.releaseYear ? ` (${cg.game.releaseYear})` : ''
      await reply(`Now playing set to ${cg.game.title}${year} on ${cg.game.platform}.`)
    } else {
      await reply(`Set to "${query}" — not in the physical collection, so game commands are paused.`)
    }
  },
}
