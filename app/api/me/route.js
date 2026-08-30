import { NextResponse } from 'next/server'; import { session } from '../../../lib/session.mjs';
export async function GET() { const s = await session(); return NextResponse.json(s ? { user: s.user, csrf: s.csrf } : { user: null }); }
