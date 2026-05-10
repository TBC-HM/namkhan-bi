'use client'

import { useEffect, useState } from 'react'

type Agent = {
  id: string
  role: string
  display_name: string
  dept: string | null
  hierarchy_level: number | null
  status: string | null
  created_at: string
}

export default function CockpitTeamPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/cockpit/team')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setAgents(data)
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Cockpit Team</h1>
        <div className="text-gray-500">Loading agents...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Cockpit Team</h1>
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Cockpit Team</h1>
      
      {agents.length === 0 ? (
        <div className="text-gray-500">No agents found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 border-b text-left text-sm font-semibold">Role</th>
                <th className="px-4 py-2 border-b text-left text-sm font-semibold">Display Name</th>
                <th className="px-4 py-2 border-b text-left text-sm font-semibold">Dept</th>
                <th className="px-4 py-2 border-b text-left text-sm font-semibold">Level</th>
                <th className="px-4 py-2 border-b text-left text-sm font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b text-sm">{agent.role}</td>
                  <td className="px-4 py-2 border-b text-sm">{agent.display_name}</td>
                  <td className="px-4 py-2 border-b text-sm">{agent.dept || '—'}</td>
                  <td className="px-4 py-2 border-b text-sm">{agent.hierarchy_level ?? '—'}</td>
                  <td className="px-4 py-2 border-b text-sm">{agent.status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}