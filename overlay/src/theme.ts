/**
 * Theme loader. The default theme is baked in via assets/theme.css; this adds an *override*
 * stylesheet on top when the OBS browser-source URL carries `?theme=<name>`.
 *
 * Theme files are plain CSS that re-declare a subset of the `--gs-*` tokens on :root. They live in
 * overlay/public/themes/<name>.css and are served at /themes/<name>.css (dev: Vite, prod: Fastify).
 * Because the override loads *after* the baked-in defaults and targets the same :root selector, its
 * declarations win — so a theme only needs to list the tokens it changes.
 *
 * Example OBS URL (note: `?theme=` goes BEFORE the `#` hash):
 *   http://localhost:8420/?theme=retro#/stage
 */

/** Names are restricted to a safe slug so the value can't escape the /themes/ folder. */
function safeName(raw: string): string | null {
  const name = raw.trim().toLowerCase()
  return /^[a-z0-9_-]+$/.test(name) ? name : null
}

/**
 * Reads `?theme=` from the URL and, for anything other than the built-in default, injects a
 * <link> to the matching theme stylesheet. No-op when absent or set to "default".
 */
export function applyThemeFromQuery(): void {
  const requested = new URLSearchParams(location.search).get('theme')
  if (!requested) return

  const name = safeName(requested)
  if (!name || name === 'default') return

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `themes/${name}.css`
  link.dataset.gsTheme = name
  document.head.appendChild(link)
}
