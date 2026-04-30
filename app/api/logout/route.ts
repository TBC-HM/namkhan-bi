import { NextResponse } from 'next/server';

export async function GET() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://namkhan-bi.vercel.app';
  const res = NextResponse.redirect(new URL('/login', base));
  // clear all known auth cookies — harmless if some don't exist
  res.cookies.delete('namkhan_auth');
  res.cookies.delete('dashboard_auth');
  res.cookies.delete('auth');
  return res;
}
