import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import MiniBarGraph from './_components/MiniBarGraph'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface TeamMember {
  id: string
  email: string
  name?: string
  role?: string
  department?: string
  avatar_url?: string
}

export default async function TeamPage() {
  const supabase = await createClient()

  const { data: members, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, department, avatar_url')
    .order('name')

  if (error) {
    console.error('Error fetching team:', error)
  }

  const teamMembers: TeamMember[] = members || []

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-light tracking-tight mb-2">Team</h1>
          <p className="text-zinc-400 text-sm">
            {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((member) => (
            <Card
              key={member.id}
              className="bg-zinc-900 border-zinc-800 p-6 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.name || member.email}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-lg font-medium">
                      {(member.name || member.email)[0].toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white truncate">
                    {member.name || member.email.split('@')[0]}
                  </h3>
                  <p className="text-sm text-zinc-400 truncate">
                    {member.email}
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {member.role && (
                      <Badge
                        variant="outline"
                        className="text-xs border-zinc-700 text-zinc-300"
                      >
                        {member.role}
                      </Badge>
                    )}
                    {member.department && (
                      <Badge
                        variant="outline"
                        className="text-xs border-zinc-700 text-zinc-300"
                      >
                        {member.department}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800">
                <MiniBarGraph />
              </div>
            </Card>
          ))}
        </div>

        {teamMembers.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            No team members found
          </div>
        )}
      </div>
    </div>
  )
}