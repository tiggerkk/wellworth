// Generate the WellWorth app icon set from the shared brand-mark geometry.
//
// The seal's geometry lives in src/lib/brand-mark.js — the SAME source the on-screen BrandMark
// component uses, so the icons and the in-app logo can't drift. To redesign the mark, edit that
// file (and the ACCENT/BG colours below if needed), then re-run `npm run gen:icons`. Outputs
// overwrite the committed files in public/ at the exact paths/sizes the manifest (vite.config.ts)
// and index.html reference.
//
//   pwa-192x192.png, pwa-512x512.png  — standard PWA icons (also reused by the onboarding header)
//   pwa-maskable-512.png              — maskable variant, seal kept inside the ~80% safe zone
//   apple-touch-icon.png (180x180)    — iOS home-screen icon
//   favicon.ico (16/32/48)            — browser tab
//
// Requires devDeps: sharp (SVG -> PNG raster) and png-to-ico (PNG -> .ico).

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import {
  BRAND_MARK_VIEWBOX,
  BRAND_MARK_BORDER,
  BRAND_MARK_FIGURE,
  BRAND_MARK_DOT,
} from '../src/lib/brand-mark.js'

const ACCENT = '#1B59FF' // mark colour — Neon Hyper-Blue - higher contrast than --color-accent = #3874f6 in src/index.css
const BG = '#161b28' // canvas — matches --color-bg / manifest background_color

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// Render the shared brand-mark geometry (src/lib/brand-mark.js — same source the on-screen
// BrandMark uses) as a standalone SVG string. `inset` shrinks the artwork toward the centre for the
// maskable safe zone (larger inset = more padding). Colours are the literal ACCENT/BG since a
// standalone SVG has no `currentColor` to inherit.
function ringSvg(inset = 0) {
  const scale = (100 - inset * 2) / 100 // inset=10 -> 0.8, centred about (50,50)
  const b = BRAND_MARK_BORDER
  const d = BRAND_MARK_DOT
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK_VIEWBOX}" fill="none" aria-hidden="true">
      <g transform="translate(50 50) scale(${scale}) translate(-50 -50)" fill="${ACCENT}" stroke="${ACCENT}">
        <rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${b.rx}" fill="none" stroke-width="${b.strokeWidth}" />
        <path d="${BRAND_MARK_FIGURE}" />
        <circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" />
      </g>
    </svg>`
}

// Flatten onto the dark canvas so there's no transparency — important for the maskable icon, which
// Android crops into arbitrary shapes (circle/squircle) and expects a solid full-bleed background.
const png = (svg, size) =>
  sharp(Buffer.from(svg)).resize(size, size).flatten({ background: BG }).png().toBuffer()

async function main() {
  const standard = ringSvg(0)
  const maskable = ringSvg(10) // extra padding so the ring survives circular/rounded masking

  const targets = [
    ['pwa-192x192.png', standard, 192],
    ['pwa-512x512.png', standard, 512],
    ['pwa-maskable-512.png', maskable, 512],
    ['apple-touch-icon.png', standard, 180],
  ]
  for (const [name, svg, size] of targets) {
    await writeFile(join(publicDir, name), await png(svg, size))
    console.log(`wrote public/${name}`)
  }

  const ico = await pngToIco(await Promise.all([16, 32, 48].map((s) => png(standard, s))))
  await writeFile(join(publicDir, 'favicon.ico'), ico)
  console.log('wrote public/favicon.ico')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
