import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePropertyAccess } from '@/lib/tenancy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ok:false,error:'missing_id'},{status:400});
  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc('fn_seo_delete_keyword', {p_id: parseInt(id)});
  if (error) return NextResponse.json({ok:false,error:error.message},{status:500});
  return NextResponse.json({ok:true});
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({})) as {keyword?:string;location_name?:string;location_code?:number;property_id?:number};
  const { keyword, location_name, location_code, property_id } = body;
  if (!keyword?.trim() || !location_name || !location_code || property_id == null) {
    return NextResponse.json({ok:false,error:'missing_fields'},{status:400});
  }
  // ADR-281 L22 + ADR-300: no default property, fail-closed access check
  try {
    await requirePropertyAccess(req, property_id);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ok:false,error:'access check failed'},{status:403});
  }
  const sb = getSupabaseAdmin();
  const { data: newId, error } = await sb.rpc('fn_seo_add_keyword',{
    p_keyword: keyword.trim().toLowerCase(),
    p_property_id: property_id,
    p_location_name: location_name,
    p_location_code: location_code,
  });
  if (error) return NextResponse.json({ok:false,error:error.message},{status:500});
  return NextResponse.json({ok:true,id:newId});
}