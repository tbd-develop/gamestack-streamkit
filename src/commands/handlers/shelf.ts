import { Permission, type Command } from '../types.js'

/** !shelf <name|slug> — show the games on one public shelf in chat. */
export const shelfCommand: Command = {
  name: 'shelf',
  permission: Permission.Everyone,
  availability: 'always',
  cooldownSeconds: 8,
  usage: 'shelf <name>',
  async run({ api, args, reply }) {
    const query = args.join(' ').trim()
    if (!query) {
      await reply('Usage: !shelf <name> — try !games to see the list.')
      return
    }

    const shelves = await api.listShelves()
    const q = query.toLowerCase()
    const match =
      shelves.find((s) => s.slug.toLowerCase() === q || s.name.toLowerCase() === q) ??
      shelves.find((s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q))

    if (!match) {
      await reply(`No shelf matching "${query}". Try !games.`)
      return
    }

    // Viewer command → chat only (no screen-covering grid). Mods use !showcollection for the overlay.
    const page = await api.getShelf(match.slug, { take: 24 })
    const shown = page.items.slice(0, 8).map((g) => g.title)
    const more = page.totalCount > shown.length ? `, +${page.totalCount - shown.length} more` : ''
    await reply(`${match.name} (${page.totalCount}): ${shown.join(', ')}${more}`)
  },
}
