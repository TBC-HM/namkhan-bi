import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'

// Icons
import { 
  Calendar, 
  Users, 
  Wind, 
  Thermometer,
  AlertCircle,
  User,
  ChevronRight
} from 'lucide-react'

interface StaffMember {
  staff_id: string
  full_name: string
  position: string | null
  department: string | null
  status: string
  hire_date: string | null
  profile_photo_url: string | null
}

interface HeaderPillsProps {
  date: string
  userCount: number
  airQuality: string
  temperature: string
}

function HeaderPills({ date, userCount, airQuality, temperature }: HeaderPillsProps) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-600">
      <div className="flex items-center gap-1.5">
        <Calendar className="w-4 h-4" />
        <span>{date}</span>
      </div>
      <div className="w-px h-4 bg-slate-300" />
      <div className="flex items-center gap-1.5">
        <Users className="w-4 h-4" />
        <span>{userCount}</span>
      </div>
      <div className="w-px h-4 bg-slate-300" />
      <div className="flex items-center gap-1.5">
        <Wind className="w-4 h-4" />
        <span>{airQuality}</span>
      </div>
      <div className="w-px h-4 bg-slate-300" />
      <div className="flex items-center gap-1.5">
        <Thermometer className="w-4 h-4" />
        <span>{temperature}</span>
      </div>
    </div>
  )
}

function StaffTable({ staff }: { staff: StaffMember[] }) {
  if (staff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <AlertCircle className="w-12 h-12 mb-3" />
        <p className="text-sm">No staff members found</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
              Name
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
              Position
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
              Department
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
              Status
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
              Hire Date
            </th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {staff.map((member) => (
            <tr
              key={member.staff_id}
              className="hover:bg-slate-50 transition-colors"
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {member.profile_photo_url ? (
                      <img
                        src={member.profile_photo_url}
                        alt={member.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <span className="font-medium text-slate-900">
                    {member.full_name}
                  </span>
                </div>
              </td>
              <td className="py-3 px-4 text-slate-600">
                {member.position || '—'}
              </td>
              <td className="py-3 px-4 text-slate-600">
                {member.department || '—'}
              </td>
              <td className="py-3 px-4">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    member.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : member.status === 'inactive'
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {member.status}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-600">
                {member.hire_date
                  ? new Date(member.hire_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })
                  : '—'}
              </td>
              <td className="py-3 px-4">
                <Link
                  href={`/operations/staff/${member.staff_id}`}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

async function StaffContent() {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data: staff, error } = await supabase
    .from('staff')
    .select('staff_id, full_name, position, department, status, hire_date, profile_photo_url')
    .order('full_name', { ascending: true })

  if (error) {
    console.error('Error fetching staff:', error)
    return (
      <div className="flex flex-col items-center justify-center py-16 text-red-500">
        <AlertCircle className="w-12 h-12 mb-3" />
        <p className="text-sm">Failed to load staff data</p>
      </div>
    )
  }

  return <StaffTable staff={staff || []} />
}

export default async function StaffPage() {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Mock data for header pills
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  const { count } = await supabase
    .from('staff')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Staff</h1>
            <p className="text-sm text-slate-500 mt-1">
              Team roster and employee directory
            </p>
          </div>
          <HeaderPills
            date={today}
            userCount={count || 0}
            airQuality="Good"
            temperature="28°C"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
            </div>
          }
        >
          <StaffContent />
        </Suspense>
      </div>
    </div>
  )
}