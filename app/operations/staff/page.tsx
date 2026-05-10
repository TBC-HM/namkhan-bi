import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface StaffMember {
  id: string
  full_name: string
  position: string
  department: string
  status: string
  hire_date: string
  phone?: string
  emergency_contact?: string
  photo_url?: string
}

export default async function StaffPage() {
  const supabase = createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch staff
  const { data: staff, error } = await supabase
    .from('staff')
    .select('*')
    .order('full_name')

  if (error) {
    console.error('Staff fetch error:', error)
  }

  const activeStaff = staff?.filter((s) => s.status === 'active') || []
  const inactiveStaff = staff?.filter((s) => s.status !== 'active') || []

  // Fetch live data for header pills
  const tz = 'Asia/Vientiane'
  const now = new Date()
  const formattedDate = formatInTimeZone(now, tz, 'd MMM yyyy')
  const formattedTime = formatInTimeZone(now, tz, 'HH:mm')

  let airQuality = '—'
  let temperature = '—'

  try {
    const { data: airData } = await supabase
      .from('live_airquality')
      .select('aqi')
      .order('captured_at', { ascending: false })
      .limit(1)
      .single()
    if (airData?.aqi) {
      airQuality = String(airData.aqi)
    }
  } catch (e) {
    // silent
  }

  try {
    const { data: weatherData } = await supabase
      .from('live_weather')
      .select('temp_c')
      .order('captured_at', { ascending: false })
      .limit(1)
      .single()
    if (weatherData?.temp_c != null) {
      temperature = `${Math.round(weatherData.temp_c)}°C`
    }
  } catch (e) {
    // silent
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light mb-2">Staff Directory</h1>
          <p className="text-zinc-400 text-sm">
            {activeStaff.length} active · {inactiveStaff.length} inactive
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span>{formattedDate}</span>
          <span>·</span>
          <span>{user.email?.split('@')[0] || 'user'}</span>
          <span>·</span>
          <span title="Air Quality Index">AQI {airQuality}</span>
          <span>·</span>
          <span>{temperature}</span>
        </div>
      </div>

      {/* Active Staff */}
      {activeStaff.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-light mb-4 text-zinc-300">Active Staff</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeStaff.map((member) => (
              <StaffCard key={member.id} member={member} />
            ))}
          </div>
        </section>
      )}

      {/* Inactive Staff */}
      {inactiveStaff.length > 0 && (
        <section>
          <h2 className="text-xl font-light mb-4 text-zinc-500">Inactive Staff</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50">
            {inactiveStaff.map((member) => (
              <StaffCard key={member.id} member={member} />
            ))}
          </div>
        </section>
      )}

      {!staff || staff.length === 0 ? (
        <div className="text-center text-zinc-500 py-12">No staff records found.</div>
      ) : null}
    </div>
  )
}

function StaffCard({ member }: { member: StaffMember }) {
  return (
    <Link
      href={`/operations/staff/${member.id}`}
      className="block bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded p-4 transition-colors"
    >
      <div className="flex items-start gap-3">
        {member.photo_url ? (
          <img
            src={member.photo_url}
            alt={member.full_name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-sm">
            {member.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{member.full_name}</h3>
          <p className="text-sm text-zinc-400 truncate">{member.position}</p>
          <p className="text-xs text-zinc-500 mt-1">{member.department}</p>
        </div>
      </div>
      {member.phone && (
        <div className="mt-3 text-xs text-zinc-500 truncate">📞 {member.phone}</div>
      )}
    </Link>
  )
}