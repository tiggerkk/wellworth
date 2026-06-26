// Generate the WellWorth app icon set from an SVG built here in code.
//
// This is the single source of truth for the app/PWA icon. To redesign the icon, edit the
// colors/geometry below and re-run `npm run gen:icons`. Outputs overwrite the committed files in
// public/ at the exact paths/sizes the manifest (vite.config.ts) and index.html reference.
//
//   pwa-192x192.png, pwa-512x512.png  — standard PWA icons (also reused by the onboarding header)
//   pwa-maskable-512.png              — maskable variant, ring kept inside the ~80% safe zone
//   apple-touch-icon.png (180x180)    — iOS home-screen icon
//   favicon.ico (16/32/48)            — browser tab
//
// Requires devDeps: sharp (SVG -> PNG raster) and png-to-ico (PNG -> .ico).

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const ACCENT = '#5ba3f5' // ring colour — matches --color-accent in src/index.css
const BG = '#161b28' // canvas — matches --color-bg / manifest background_color

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// A thick ring on the dark canvas, drawn in a 100x100 viewBox. `inset` shrinks the ring for the
// maskable safe zone (larger inset = more padding). Geometry mirrors src/components/RingMark.tsx.
function ringSvg(inset = 0) {
  const r = 30 - inset
  const strokeWidth = 16 - inset * 0.4
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${BG}"/>
  <circle cx="50" cy="50" r="${r}" fill="none" stroke="${ACCENT}" stroke-width="${strokeWidth}"/>
</svg>`
}

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()

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
