/**
 * Generates a branded 1200×630 Open Graph cover image at public/og-cover.png.
 * Requires: sharp (already a devDependency)
 * Usage: npm run generate:og-cover
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

type SharpLike = (input: Buffer) => {
  png: () => {
    toFile: (outputPath: string) => Promise<unknown>
  }
}

const WIDTH = 1200
const HEIGHT = 630
const BG = '#0F766E'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>

  <!-- Subtle grid pattern -->
  <defs>
    <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>

  <!-- Accent circle top-right -->
  <circle cx="1100" cy="80" r="180" fill="rgba(255,255,255,0.06)"/>
  <!-- Accent circle bottom-left -->
  <circle cx="120" cy="570" r="120" fill="rgba(255,255,255,0.04)"/>

  <!-- Logo mark: stacked card shapes -->
  <rect x="80" y="230" width="64" height="42" rx="6" fill="rgba(255,255,255,0.25)"/>
  <rect x="94" y="218" width="64" height="42" rx="6" fill="rgba(255,255,255,0.45)"/>
  <rect x="108" y="206" width="64" height="42" rx="6" fill="white"/>

  <!-- Main title -->
  <text x="200" y="248"
        font-family="'Segoe UI', Arial, sans-serif"
        font-size="72"
        font-weight="700"
        fill="white"
        letter-spacing="-1">CardPromo LK</text>

  <!-- Tagline -->
  <text x="200" y="310"
        font-family="'Segoe UI', Arial, sans-serif"
        font-size="30"
        font-weight="400"
        fill="rgba(255,255,255,0.80)">Sri Lanka's best credit card offers, all in one place.</text>

  <!-- Bottom divider + URL -->
  <rect x="80" y="390" width="520" height="2" rx="1" fill="rgba(255,255,255,0.20)"/>
  <text x="80" y="440"
        font-family="'Segoe UI', Arial, sans-serif"
        font-size="24"
        font-weight="400"
        fill="rgba(255,255,255,0.55)">cardpromo.lk</text>
</svg>`

async function main() {
  let sharp: SharpLike
  try {
    const sharpModuleName = 'sharp'
    sharp = ((await import(sharpModuleName)) as { default: SharpLike }).default
  } catch {
    console.error('sharp is not installed. Run: npm install --save-dev sharp')
    process.exit(1)
  }

  const outPath = path.resolve(root, 'public/og-cover.png')
  await sharp(Buffer.from(svg)).png().toFile(outPath)
  console.log(`✓ Generated ${outPath}`)
}

main().catch(console.error)
