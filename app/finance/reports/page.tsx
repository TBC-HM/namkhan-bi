'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FileText, Clock } from 'lucide-react'

interface CockpitTicket {
  id: string
  title: string
  metadata: {
    property_id?: string
    read_by_user?: string
    report_url?: string
    delivery_date?: string
  }
  created_at: string
}

export default function ReportsPage() {
  const params = useParams()
  const propertyId = params?.property_id as string | undefined
  const [reports, setReports] = useState<CockpitTicket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!propertyId) return

    const supabase = createClient()

    const fetchReports = async () => {
      const { data } = await supabase
        .from('cockpit_tickets')
        .select('*')
        .eq('source', 'agent_delivery')
        .eq('metadata->>property_id', propertyId)
        .order('created_at', { ascending: false })

      setReports(data ?? [])
      setLoading(false)
    }

    fetchReports()

    // Subscribe to changes
    const channel = supabase
      .channel(`reports_${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cockpit_tickets',
          filter: `source=eq.agent_delivery`
        },
        () => {
          fetchReports()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [propertyId])

  const markAsRead = async (ticketId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('cockpit_tickets')
      .update({
        metadata: {
          ...reports.find(r => r.id === ticketId)?.metadata,
          read_by_user: user.id
        }
      })
      .eq('id', ticketId)
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-stone-900"></div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Finance Reports</h1>
        <p className="mt-1 text-sm text-stone-600">Agent deliveries and automated reports</p>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-white p-12">
          <FileText className="h-12 w-12 text-stone-400" />
          <p className="mt-4 text-sm text-stone-600">No reports yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const isUnread = !report.metadata?.read_by_user

            return (
              <button
                key={report.id}
                onClick={() => {
                  if (isUnread) markAsRead(report.id)
                  if (report.metadata?.report_url) {
                    window.open(report.metadata.report_url, '_blank')
                  }
                }}
                className={`
                  group w-full rounded-lg border p-4 text-left transition-all
                  ${
                    isUnread
                      ? 'border-red-200 bg-red-50 hover:border-red-300 hover:bg-red-100'
                      : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 ${isUnread ? 'bg-red-100' : 'bg-stone-100'}`}>
                      <FileText className={`h-5 w-5 ${isUnread ? 'text-red-600' : 'text-stone-600'}`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-stone-900">{report.title}</h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-stone-500">
                        <Clock className="h-3 w-3" />
                        {new Date(report.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                  {isUnread && (
                    <span className="flex h-2 w-2 rounded-full bg-red-600"></span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}