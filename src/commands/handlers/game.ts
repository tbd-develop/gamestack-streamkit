import { Permission, type Command } from '../types.js'
import { OVERLAY_TTL_MS } from '../../overlay/events.js'
import { igdbUrl } from '../../api/igdb.js'

/** !game <title> — fuzzy-search the collection, show the top match on the overlay + reply. */
export const gameCommand: Command = {
  name: 'game',
  permission: Permission.Everyone,
  availability: 'blockedWhenUntracked',
  cooldownSeconds: 8,
  usage: 'game <title>',
  async run({ api, args, reply, bus }) {
    const query = args.join(' ').trim()
    if (query.length < 2) {
      await reply('Usage: !game <title> (at least 2 letters).')
      return
    }

    const results = await api.searchGames(query)
    if (results.length === 0) {
      await reply(`No game found matching "${query}".`)
      return
    }

    // Queue the card on screen (waits behind anything currently showing). Chat always gets the
    // answer below regardless of whether/when the card displays.
    bus.enqueue({
      type: 'show',
      overlay: 'search',
      data: { query, items: results.slice(0, 1) },
      ttlMs: OVERLAY_TTL_MS,
    })

    const top = results[0]
    const year = top.releaseYear ? ` (${top.releaseYear})` : ''
    const rating = top.rating != null ? ` · rated ${Math.round(top.rating)}/100` : ''
    const copies = `${top.copyCount} ${top.copyCount === 1 ? 'copy' : 'copies'}`
    await reply(
      `${top.title}${year} — ${top.platform}${rating} · ${copies} in the collection · more: ${igdbUrl(top)}`,
    )
  },
}
