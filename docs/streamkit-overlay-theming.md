# Overlay Theming

The StreamKit OBS overlays (the *Now Playing* card, the collection slideshow, the search
popup) are fully themeable. Every colour, font, border, shadow and radius is a **CSS custom
property** (a "token"). A theme is just a small `.css` file that re-declares the tokens you
want to change — no code, no rebuild.

The look that ships out of the box is the **Default** theme
([`overlay/src/assets/theme.css`](../overlay/src/assets/theme.css)). It defines every
token. Your theme only needs the handful you want different.

---

## Quick start

1. Copy the template to a new file named after your theme:

   ```bash
   cd overlay/public/themes
   cp _template.css mytheme.css
   ```

2. Edit `mytheme.css` — change the tokens you care about, delete the rest.

3. Point the OBS browser source at your theme by adding `?theme=mytheme` to the URL.
   **The `?theme=` must come _before_ the `#`:**

   ```
   http://localhost:5173/?theme=mytheme#/stage      (dev — Vite)
   http://localhost:8420/?theme=mytheme#/stage      (prod — served by the bot)
   ```

That's it. Reload the browser source and the overlay re-skins. Leaving `?theme=` off (or
using `?theme=default`) gives the built-in Default theme.

Theme names must be a simple slug (`a–z`, `0–9`, `-`, `_`). The file at
`public/themes/<name>.css` is loaded *after* the defaults, so anything it declares wins — and
anything it omits falls back to Default.

> **In dev**, Vite serves `public/` instantly — just reload. **In prod** the theme files are
> bundled into `overlay-dist/` by `npm run build`, so rebuild after adding a new theme file.

---

## How it works

- The Default theme declares all tokens on `:root` and is baked into the bundle, so the
  overlay is always themed even with no `?theme=`.
- When the URL has `?theme=<name>`, the loader
  ([`overlay/src/theme.ts`](../overlay/src/theme.ts)) injects
  `<link rel="stylesheet" href="themes/<name>.css">`. Because it loads after the defaults and
  targets the same `:root`, its values override — so a theme is a *partial* override, never a
  full copy.
- Accents are stored as **space-separated RGB triplets** (`124 92 255`, not `#7c5cff`). Tints
  like borders and pills are derived with `rgb(var(--gs-accent-rgb) / 0.35)`, so changing the
  two accent triplets re-tints the entire overlay in two lines. See `synthwave.css`.

---

## Token reference

### Typography

| Token        | Default                                       | Controls |
|--------------|-----------------------------------------------|----------|
| `--gs-font`  | `'Inter', system-ui, -apple-system, sans-serif` | Font family for all overlay text |

To use a custom web font, put an `@import` as the **first line** of your theme file, then set
`--gs-font`:

```css
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;800&display=swap');
:root {
  --gs-font: 'Orbitron', sans-serif;
}
```

### Accents (drive everything else)

| Token              | Default        | Controls |
|--------------------|----------------|----------|
| `--gs-accent-rgb`  | `124 92 255`   | Primary accent — panel border, platform pill, cover-fallback glyph, rating fill start |
| `--gs-accent2-rgb` | `34 211 238`   | Secondary accent — section labels ("Now Playing"), rating fill end |

Format is `R G B`, **space-separated, no commas, no `rgb()`**.

### Text

| Token               | Default   | Controls |
|---------------------|-----------|----------|
| `--gs-text`         | `#f2f4fb` | Titles and primary body text |
| `--gs-text-muted`   | `#aab2c0` | Game descriptions |
| `--gs-text-dim`     | `#9aa3b2` | Genre chips, captions, small print |
| `--gs-text-rating`  | `#d7dce6` | The rating number |
| `--gs-accent-soft`  | `#c9bcff` | Light accent text — page counter, platform pill text |
| `--gs-eyebrow`      | `rgb(var(--gs-accent2-rgb))` | The uppercase section label |

### Panel (the card / grid surface)

| Token               | Default | Controls |
|---------------------|---------|----------|
| `--gs-panel-bg`     | dark blue-grey gradient | Panel background — accepts any CSS `background` (flat colour, gradient, etc.) |
| `--gs-panel-border` | `rgb(var(--gs-accent-rgb) / 0.35)` | Panel border colour |
| `--gs-panel-radius` | `20px`  | Panel corner radius |
| `--gs-panel-shadow` | layered drop shadow + inset | Panel `box-shadow` |
| `--gs-panel-blur`   | `8px`   | Backdrop blur behind the panel (glassmorphism) |

### Pills & chips

| Token                     | Default | Controls |
|---------------------------|---------|----------|
| `--gs-pill-bg`            | `rgba(255,255,255,0.06)` | Year / copy-count pill background |
| `--gs-pill-border`        | `rgba(255,255,255,0.08)` | …and its border |
| `--gs-chip-bg`            | `rgba(255,255,255,0.04)` | Genre chip background |
| `--gs-accent-pill-bg`     | `rgb(var(--gs-accent-rgb) / 0.18)` | Platform pill background |
| `--gs-accent-pill-border` | `rgb(var(--gs-accent-rgb) / 0.4)`  | Platform pill border |

### Game covers

| Token                 | Default | Controls |
|-----------------------|---------|----------|
| `--gs-cover-bg`       | `#11151f` | Letterbox behind cover art |
| `--gs-cover-fallback` | `rgb(var(--gs-accent-rgb) / 0.55)` | First-letter glyph when a game has no cover |

### Rating bar

| Token                | Default | Controls |
|----------------------|---------|----------|
| `--gs-rating-track`  | `rgba(255,255,255,0.08)` | Empty part of the rating bar |
| `--gs-rating-fill`   | accent → accent2 gradient | Filled part of the rating bar |

---

## Examples

Three working themes ship in `overlay/public/themes/`:

- **`synthwave.css`** — the minimal case. Changes only the two accent triplets; the whole
  overlay re-tints. Load with `?theme=synthwave`.
- **`daylight.css`** — a full re-skin: light frosted panel, dark text, a custom web font.
  Load with `?theme=daylight`.
- **`gamestack.css`** — the on-brand theme, lifted straight from [gamestack.us](https://gamestack.us):
  warm paper-white panel, near-black text, and the site's indigo → violet accent gradient. Load with
  `?theme=gamestack`.

Open them side by side with `_template.css` to see the spread from "two lines" to "everything".

---

## Tips

- **Transparency stays transparent.** Don't set a background on `html`/`body` — only the panel.
  OBS needs the page background transparent, and the overlays rely on it.
- **Test in a browser first.** Open the `?theme=` URL in any Chromium browser before wiring it
  into OBS — it renders identically and reloads faster.
- **Keep contrast readable over gameplay.** Overlays float over your game feed; the default
  panel is semi-opaque with blur for exactly this reason. If you raise opacity, check it's
  still legible over a busy scene.
- **Web fonts need network access.** OBS's browser source can usually reach Google Fonts, but
  if a font fails to load it falls back to the next family in `--gs-font`.
