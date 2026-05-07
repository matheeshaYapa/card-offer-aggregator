/**
 * Generates PWA icon PNGs (192×192 and 512×512) from public/icons/icon.svg.
 * Requires: npm install --save-dev sharp
 * Usage: npm run generate:icons
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

type SharpLike = (input: Buffer) => {
  resize: (width: number, height: number) => {
    png: () => {
      toFile: (outputPath: string) => Promise<unknown>
    }
  }
}

async function main() {
  let sharp: SharpLike
  try {
    const sharpModuleName = 'sharp'
    sharp = ((await import(sharpModuleName)) as { default: SharpLike }).default
  } catch {
    console.error('Please install sharp first: npm install --save-dev sharp')
    process.exit(1)
  }

  const svgPath = path.resolve(root, 'public/icons/icon.svg')
  const svgBuffer = fs.readFileSync(svgPath)
  const iconsDir = path.resolve(root, 'public/icons')

  for (const size of [192, 512]) {
    const outPath = path.join(iconsDir, `icon-${size}.png`)
    await sharp(svgBuffer).resize(size, size).png().toFile(outPath)
    console.log(`✓ Generated ${outPath}`)
  }
}

main().catch(console.error)
