import { Permission, type Command } from '../types.js'

/** !overlays <on|off> — mod master switch for all on-screen overlays (chat replies still work). */
export const overlaysCommand: Command = {
  name: 'overlays',
  permission: Permission.Mod,
  availability: 'always',
  cooldownSeconds: 1,
  usage: 'overlays <on|off>',
  async run({ args, bus, reply, prefix }) {
    const arg = (args[0] ?? '').toLowerCase()
    if (arg === 'on' || arg === 'enable') {
      bus.setEnabled(true)
      await reply('Overlays ON.')
    } else if (arg === 'off' || arg === 'disable') {
      bus.setEnabled(false)
      await reply('Overlays OFF — chat replies still work; use it to clear the screen for gameplay.')
    } else {
      await reply(`Usage: ${prefix}overlays on|off (currently ${bus.overlaysEnabled ? 'on' : 'off'}).`)
    }
  },
}
