import { Permission, type Command } from '../types.js'

const usageOf = (c: Command, prefix: string) => `${prefix}${c.usage ?? c.name}`

/** !help — list available commands. Public commands for everyone; mod commands shown to mods. */
export const helpCommand: Command = {
  name: 'help',
  aliases: ['commands'],
  permission: Permission.Everyone,
  availability: 'always',
  cooldownSeconds: 8,
  usage: 'help',
  async run({ commands, user, prefix, reply }) {
    const isMod = user.isMod || user.isBroadcaster

    const everyone = commands
      .filter((c) => c.permission === Permission.Everyone)
      .map((c) => usageOf(c, prefix))

    let msg = `Commands: ${everyone.join(', ')}`

    if (isMod) {
      const mod = commands
        .filter((c) => c.permission !== Permission.Everyone)
        .map((c) => usageOf(c, prefix))
      if (mod.length) msg += ` · Mods: ${mod.join(', ')}`
    }

    await reply(msg)
  },
}
