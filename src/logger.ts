import pino from 'pino'

const isProd = process.env.NODE_ENV === 'production'

/**
 * Shared pino logger. Pretty-prints in dev; structured JSON in prod.
 * Redacts common secret-bearing keys so an API key / token never lands in the logs.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['key', 'apiKey', 'token', 'botToken', 'accessToken', 'refreshToken', 'clientSecret'],
    censor: '«redacted»',
  },
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
})

/** Redact anything that looks like a GameStack API key (gs_dev_… / gs_live_…) from free text. */
export function scrubSecrets(text: string): string {
  return text.replace(/gs_(?:dev|live)_[A-Za-z0-9._-]+/g, 'gs_***')
}
