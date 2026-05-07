import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, ArrowLeft, ExternalLink } from 'lucide-react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import { getScrapeRunsAdmin } from '@/lib/supabase/queries/admin-scrape'
import { formatDate } from '@/utils/dateUtils'
import type { ScrapeRun } from '@/types'

function getDuration(run: ScrapeRun): string {
  if (!run.ended_at) return 'Still running…'
  const ms = new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

export default function AdminScrapeRunsPage() {
  const [runs, setRuns] = useState<ScrapeRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedError, setExpandedError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRuns(await getScrapeRunsAdmin(100))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="p-6">
      <AdminPageHeader
        title="Scrape Runs"
        subtitle="History of scraper executions"
        action={
          <div className="flex items-center gap-2">
            <Link to="/admin/scraped-candidates" className="admin-btn-ghost text-xs flex items-center gap-1.5">
              <ArrowLeft size={13} /> Back to Candidates
            </Link>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="admin-btn-ghost flex items-center gap-1.5 text-xs"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      {error && <div className="admin-error mb-4">{error}</div>}

      {/* How to trigger */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-sm text-blue-800">
        <strong>Triggering a scrape run:</strong> Go to your GitHub repository →
        Actions → "Run Promotion Scrapers" → Run workflow manually.
        Or wait for the scheduled daily cron (18:30 UTC).
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted text-center py-16">
            No scrape runs yet. Run the Python scraper to see history here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  <th className="admin-th">Source</th>
                  <th className="admin-th">Status</th>
                  <th className="admin-th">Started</th>
                  <th className="admin-th">Duration</th>
                  <th className="admin-th">Candidates Found</th>
                  <th className="admin-th">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="admin-td">
                      {run.scrape_source ? (
                        <div>
                          <p className="font-medium text-content">{run.scrape_source.name}</p>
                          <a
                            href={run.scrape_source.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted hover:text-primary flex items-center gap-0.5 mt-0.5"
                          >
                            <ExternalLink size={10} />
                            {run.scrape_source.source_url.replace(/^https?:\/\//, '').slice(0, 40)}…
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted italic">Unknown source</span>
                      )}
                    </td>
                    <td className="admin-td">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="admin-td text-muted text-xs whitespace-nowrap">
                      {formatDate(run.started_at)}
                    </td>
                    <td className="admin-td text-muted text-xs">
                      {getDuration(run)}
                    </td>
                    <td className="admin-td">
                      {run.offers_found > 0 ? (
                        <span className="text-emerald-600 font-semibold">{run.offers_found}</span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td className="admin-td text-xs max-w-[200px]">
                      {run.error_message ? (
                        <div>
                          <button
                            onClick={() => setExpandedError(expandedError === run.id ? null : run.id)}
                            className="text-red-600 hover:underline text-xs"
                          >
                            {expandedError === run.id ? 'Hide' : 'Show error'}
                          </button>
                          {expandedError === run.id && (
                            <pre className="mt-1 text-[10px] text-red-600 bg-red-50 rounded p-2 overflow-auto max-h-20 whitespace-pre-wrap">
                              {run.error_message}
                            </pre>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
