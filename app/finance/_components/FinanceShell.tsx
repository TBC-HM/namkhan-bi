'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { 
  LayoutDashboard, 
  FileText, 
  TrendingUp, 
  Receipt, 
  Database,
  PieChart,
  CreditCard,
  Upload,
  Link as LinkIcon,
  DollarSign,
  Users,
  Brain,
  Settings
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const subnav = [
  { href: '', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard', label: 'Dashboard', icon: PieChart },
  { href: '/reports', label: 'Reports', icon: FileText, badge: true },
  { href: '/pnl', label: 'P&L', icon: TrendingUp },
  { href: '/ledger', label: 'AR Ledger', icon: Receipt },
  { href: '/transactions', label: 'Transactions', icon: Database },
  { href: '/pos-transactions', label: 'POS', icon: CreditCard },
  { href: '/budget', label: 'Budget', icon: Upload },
  { href: '/mapping', label: 'Mapping', icon: LinkIcon },
  { href: '/supplier-mapping', label: 'Suppliers', icon: DollarSign },
  { href: '/poster', label: 'Poster', icon: Users },
  { href: '/agents', label: 'Agents', icon: Brain },
  { href: '/cockpit', label: 'Cockpit', icon: Settings },
]

export default function FinanceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useParams()
  const propertyId = params?.property_id as string | undefined
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!propertyId) return

    const supabase = createClient()

    const fetchUnreadCount = async () => {
      const { data } = await supabase
        .from('cockpit_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'agent_delivery')
        .eq('metadata->>property_id', propertyId)
        .is('metadata->>read_by_user', null)

      setUnreadCount(data?.length ?? 0)
    }

    fetchUnreadCount()

    // Subscribe to changes
    const channel = supabase
      .channel(`finance_reports_${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cockpit_tickets',
          filter: `source=eq.agent_delivery`
        },
        () => {
          fetchUnreadCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [propertyId])

  const baseHref = propertyId ? `/h/${propertyId}/finance` : '/finance'

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Horizontal nav */}
      <nav className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center space-x-1 overflow-x-auto scrollbar-hide">
            {subnav.map((item) => {
              const href = `${baseHref}${item.href}`
              const isActive =
                item.href === ''
                  ? pathname === baseHref
                  : pathname === href || pathname.startsWith(href + '/')
              const Icon = item.icon
              const showBadge = item.badge && unreadCount > 0

              return (
                <Link
                  key={item.label}
                  href={href}
                  className={`
                    group relative flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors
                    ${
                      isActive
                        ? 'bg-stone-100 text-stone-900'
                        : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {showBadge && (
                    <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main>{children}</main>
    </div>
  )
}