/**
 * Build-time public data snapshot (see src/lib/publicSnapshot.tsx).
 *
 * Loads every currently available offer plus active banks and categories from
 * Supabase with the anon key (so RLS applies exactly as for visitors).
 * Set PRERENDER_SNAPSHOT_FIXTURE=path/to/snapshot.json to build from a file
 * instead (tests, offline builds).
 */
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import { OFFER_SELECT } from '../src/lib/supabase/offerSelect'
import { slimForSnapshot, type PublicSnapshot } from '../src/lib/snapshotData'
import { sriLankaDate } from '../src/utils/dateUtils'

const PAGE_SIZE = 250

export async function loadSnapshot(root: string): Promise<PublicSnapshot | null> {
  const fixture = process.env.PRERENDER_SNAPSHOT_FIXTURE
  if (fixture) {
    console.log(`Using snapshot fixture ${fixture}`)
    return JSON.parse(fs.readFileSync(path.resolve(fixture), 'utf-8')) as PublicSnapshot
  }

  const env = loadEnv('production', root, 'VITE_')
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    console.warn('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — prerendering without offer data')
    return null
  }
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  const today = sriLankaDate()

  try {
    const offers: PublicSnapshot['offers'] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client
        .from('offers')
        .select(OFFER_SELECT)
        .eq('status', 'approved')
        .eq('is_active', true)
        .or(`valid_from.is.null,valid_from.lte.${today}`)
        .or(`valid_to.is.null,valid_to.gte.${today}`)
        .order('is_featured', { ascending: false })
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('id')
        .range(offset, offset + PAGE_SIZE - 1)
      if (error) throw error
      offers.push(...((data ?? []) as PublicSnapshot['offers']))
      if (!data || data.length < PAGE_SIZE) break
    }
    const [banks, categories] = await Promise.all([
      client.from('banks').select('*').eq('is_active', true).order('name'),
      client.from('categories').select('*').eq('is_active', true).order('name'),
    ])
    if (banks.error) throw banks.error
    if (categories.error) throw categories.error

    return {
      generatedAt: new Date().toISOString(),
      offers,
      banks: banks.data as PublicSnapshot['banks'],
      categories: categories.data as PublicSnapshot['categories'],
    }
  } catch (error) {
    console.warn(`Unable to load the public snapshot from Supabase: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

/** Write the slimmed snapshot to dist/data/public-<hash>.json and return its URL path. */
export function writeSnapshot(distDir: string, snapshot: PublicSnapshot): string {
  const json = JSON.stringify(slimForSnapshot(snapshot))
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 12)
  const dir = path.join(distDir, 'data')
  fs.mkdirSync(dir, { recursive: true })
  for (const old of fs.readdirSync(dir)) {
    if (/^public-[0-9a-f]+\.json$/.test(old)) fs.rmSync(path.join(dir, old))
  }
  const fileName = `public-${hash}.json`
  fs.writeFileSync(path.join(dir, fileName), json)
  console.log(`✓ Snapshot: ${snapshot.offers.length} offers, ${(json.length / 1024).toFixed(0)} KB → /data/${fileName}`)
  return `/data/${fileName}`
}

/** Read the snapshot prerender.ts wrote (used by the sitemap step). */
export function readWrittenSnapshot(distDir: string): PublicSnapshot | null {
  const dir = path.join(distDir, 'data')
  if (!fs.existsSync(dir)) return null
  const file = fs.readdirSync(dir).find((name) => /^public-[0-9a-f]+\.json$/.test(name))
  return file ? (JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as PublicSnapshot) : null
}
