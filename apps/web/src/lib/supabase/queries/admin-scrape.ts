import { supabase } from '../client'
import type { ScrapeRun, ScrapeSource } from '@/types'

export async function getScrapeSourcesAdmin(): Promise<ScrapeSource[]> {
  const { data, error } = await supabase
    .from('scrape_sources')
    .select('*')
    .order('name')
  if (error) throw error
  return (data ?? []) as ScrapeSource[]
}

export async function getScrapeRunsAdmin(limit = 50): Promise<ScrapeRun[]> {
  const { data, error } = await supabase
    .from('scrape_runs')
    .select('*, scrape_source:scrape_sources(id, name, source_url)')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as ScrapeRun[]
}

export async function triggerManualRunNote(): Promise<string> {
  // GitHub Actions workflows are triggered externally. This returns an
  // instruction string so the UI can guide the admin.
  return 'To trigger a scrape run, go to GitHub Actions → "Run Promotion Scrapers" → Run workflow.'
}
