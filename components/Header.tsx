'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Bell, Mail, User, LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface GmailSummary {
  emailsIn: number
  emailsOut: number
  window: string
}

export function Header() {
  const pathname = usePathname()
  const [gmailSummary, setGmailSummary] = useState<GmailSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchGmailSummary = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inbox/summary', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setGmailSummary({
          emailsIn: data.emailsIn || 0,
          emailsOut: data.emailsOut || 0,
          window: data.window || '24h'
        })
      } else {
        console.error('[Header] Failed to fetch Gmail summary:', await res.text())
      }
    } catch (err) {
      console.error('[Header] Error fetching Gmail summary:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGmailSummary()
    // Refresh every 5 minutes
    const interval = setInterval(fetchGmailSummary, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="border-b border-zinc-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-serif text-lg font-medium text-white">
            The Namkhan
          </Link>
          <nav className="flex gap-6">
            <Link
              href="/cockpit"
              className={cn(
                'text-sm transition-colors',
                pathname?.startsWith('/cockpit')
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              Cockpit
            </Link>
            <Link
              href="/finance"
              className={cn(
                'text-sm transition-colors',
                pathname?.startsWith('/finance')
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              Finance
            </Link>
            <Link
              href="/operations"
              className={cn(
                'text-sm transition-colors',
                pathname?.startsWith('/operations')
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              Operations
            </Link>
            <Link
              href="/marketing"
              className={cn(
                'text-sm transition-colors',
                pathname?.startsWith('/marketing')
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              Marketing
            </Link>
            <Link
              href="/guest"
              className={cn(
                'text-sm transition-colors',
                pathname?.startsWith('/guest')
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              Guest
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative p-2 text-zinc-400 hover:text-white transition-colors"
                title="Gmail Summary"
              >
                <Mail className="w-5 h-5" />
                {gmailSummary && (gmailSummary.emailsIn > 0 || gmailSummary.emailsOut > 0) && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-zinc-900 border-zinc-800">
              <div className="p-4">
                <h3 className="text-sm font-medium text-white mb-3">Gmail Summary</h3>
                {loading ? (
                  <p className="text-xs text-zinc-500">Loading...</p>
                ) : gmailSummary ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Last {gmailSummary.window}:</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Emails in:</span>
                      <span className="font-serif italic text-white">
                        {gmailSummary.emailsIn}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Emails out:</span>
                      <span className="font-serif italic text-white">
                        {gmailSummary.emailsOut}
                      </span>
                    </div>
                    <button
                      onClick={fetchGmailSummary}
                      className="w-full mt-3 text-xs text-zinc-500 hover:text-white transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">No data available</p>
                )}
              </div>
              <DropdownMenuItem asChild>
                <Link href="/inbox" className="text-sm">
                  View Inbox →
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button className="p-2 text-zinc-400 hover:text-white transition-colors">
            <Bell className="w-5 h-5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 text-zinc-400 hover:text-white transition-colors">
                <User className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
              <DropdownMenuItem asChild>
                <Link href="/settings" className="text-sm">
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <form action="/api/auth/logout" method="POST">
                  <button type="submit" className="w-full text-left text-sm flex items-center gap-2">
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}