/**
 * Abstraction over a live-chat platform. Twitch is implemented first (Phase 1); YouTube is a
 * later adapter (Phase 3). The rest of the app only depends on this interface.
 */
export type ChatPlatform = 'twitch' | 'youtube'

export interface ChatUser {
  id: string
  displayName: string
  isBroadcaster: boolean
  isMod: boolean
}

export interface ChatMessage {
  source: ChatPlatform
  channel: string
  text: string
  user: ChatUser
  /** Reply into the originating chat. */
  reply: (text: string) => Promise<void>
}

export interface ChatSource {
  readonly name: ChatPlatform
  start(): Promise<void>
  stop(): Promise<void>
  onMessage(handler: (msg: ChatMessage) => void): void
}
