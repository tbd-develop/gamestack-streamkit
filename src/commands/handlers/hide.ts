import { Permission, type Command } from '../types.js'

/** !hide — mod: hide whatever overlay is currently showing. */
export const hideCommand: Command = {
  name: 'hide',
  permission: Permission.Mod,
  availability: 'always',
  cooldownSeconds: 1,
  async run({ bus, reply }) {
    bus.hide()
    await reply('Overlay hidden.')
  },
}
