import { Permission, type Command } from '../types.js'
import { COLLECTION_MAX_ITEMS, COLLECTION_PAGE_MS, COLLECTION_PAGE_SIZE } from '../../overlay/events.js'

/** !showcollection [shelf] — mod: display a shelf grid (defaults to the first public shelf). */
export const showCollectionCommand: Command = {
  name: 'showcollection',
  permission: Permission.Mod,
  availability: 'always',
  cooldownSeconds: 5,
  usage: 'showcollection [shelf]',
  async run({ args, api, bus, reply }) {
    const shelves = await api.listShelves()
    if (shelves.length === 0) {
      await reply('No public shelves to show.')
      return
    }

    const query = args.join(' ').trim().toLowerCase()
    const shelf =
      (query &&
        (shelves.find((s) => s.slug.toLowerCase() === query || s.name.toLowerCase() === query) ??
          shelves.find((s) => s.name.toLowerCase().includes(query)))) ||
      shelves[0]

    const page = await api.getShelf(shelf.slug, { take: COLLECTION_MAX_ITEMS })
    const pageCount = Math.max(1, Math.ceil(page.items.length / COLLECTION_PAGE_SIZE))
    // Mod action → preempt whatever's showing/queued.
    bus.showPriority({
      type: 'show',
      overlay: 'collection',
      data: {
        title: shelf.name,
        description: shelf.description,
        items: page.items,
        pageSize: COLLECTION_PAGE_SIZE,
        pageMs: COLLECTION_PAGE_MS,
      },
      // Total on-screen time covers every page; the overlay advances pages itself.
      ttlMs: pageCount * COLLECTION_PAGE_MS,
    })
    await reply(`Showing ${shelf.name} (${page.totalCount}) across ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}.`)
  },
}
