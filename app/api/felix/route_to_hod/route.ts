import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * POST /api/felix/route_to_hod
 * 
 * Felix calls this to route a ticket to the appropriate Head of Department.
 * 
 * Body: {
 *   ticket_id: string
 *   department: 'SALES' | 'OPERATIONS' | 'FINANCE' | 'IT' | 'MARKETING' | 'FRONT_OFFICE' | 'GUEST'
 *   reasoning?: string
 * }
 * 
 * Returns: { success: true, hod_id?: string, hod_name?: string } | { error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()
    const { ticket_id, department, reasoning } = body

    if (!ticket_id || !department) {
      return NextResponse.json(
        { error: 'ticket_id and department required' },
        { status: 400 }
      )
    }

    // Fetch HoD for the department
    const { data: hodData, error: hodError } = await supabase
      .from('staff')
      .select('id, full_name')
      .eq('department', department)
      .eq('role', 'HOD')
      .eq('is_active', true)
      .single()

    if (hodError || !hodData) {
      return NextResponse.json(
        { error: `No active HoD found for ${department}` },
        { status: 404 }
      )
    }

    // Update ticket assignment
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        assigned_to: hodData.id,
        status: 'assigned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket_id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to assign ticket', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      hod_id: hodData.id,
      hod_name: hodData.full_name,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
