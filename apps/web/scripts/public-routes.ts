import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import { sriLankaDate } from '../src/utils/dateUtils'

export async function loadPublicRouteSlugs(root: string) {
  const env = loadEnv('production', root, 'VITE_')
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key } = env
  if (!url || !key) return null

  const client = createClient(url, key)
  const today = sriLankaDate()
  const pageSize = 250
  const slugPages = async (table: 'banks' | 'categories' | 'offers') => {
    const slugs: string[] = []
    for (let offset = 0; ; offset += pageSize) {
      const query = client.from(table).select('slug').eq('is_active', true)
      if (table === 'offers') {
        query.eq('status', 'approved')
          .or(`valid_from.is.null,valid_from.lte.${today}`)
          .or(`valid_to.is.null,valid_to.gte.${today}`)
      }
      const { data, error } = await query.order('slug').range(offset, offset + pageSize - 1)
      if (error) {
        console.warn(`Unable to load ${table} route slugs from Supabase: ${error.message}`)
        return null
      }
      slugs.push(...data.map(({ slug }) => slug as string))
      if (data.length < pageSize) return slugs
    }
  }

  const [banks, categories, offers] = await Promise.all([
    slugPages('banks'),
    slugPages('categories'),
    slugPages('offers'),
  ])
  return { banks, categories, offers }
}
