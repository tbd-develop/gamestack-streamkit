import { Permission, type Command } from '../types.js'

/** !games — list the owner's public shelves in chat. */
export const gamesCommand: Command = {
  name: 'games',
  permission: Permission.Everyone,
  availability: 'always',
  cooldownSeconds: 10,
  async run({ api, reply, prefix }) {
    const shelves = await api.listShelves()
    if (shelves.length === 0) {
      await reply('No public shelves are set up yet.')
      return
    }
    // Show each shelf's slug — that's the reliable key for !shelf — plus a real example.
    const list = shelves.map((s) => `${s.name} [${s.slug}] (${s.gameCount})`).join(' · ')
    const example = `${prefix}shelf ${shelves[0].slug}`
    await reply(`Shelves: ${list} — e.g. "${example}" to see one.`)
  },
}
