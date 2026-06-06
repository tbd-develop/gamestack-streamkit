import type { Config } from '../config.js'
import type { ChatSource } from './ChatSource.js'
import { TwitchChatSource } from './TwitchChatSource.js'

/** Build the set of enabled chat sources from config. (YouTube joins here in Phase 3.) */
export function buildChatSources(config: Config): ChatSource[] {
  const sources: ChatSource[] = []
  if (config.twitch) sources.push(new TwitchChatSource(config.twitch))
  return sources
}
