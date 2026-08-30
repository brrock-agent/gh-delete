import { NextResponse } from 'next/server'; import { random, sign, cookie } from '../../../../lib/auth.mjs';
export const runtime = 'nodejs';
export async function GET(request) { const state = random(); const url = new URL('https://github.com/login/oauth/authorize'); url.search = new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID, redirect_uri: `${process.env.APP_URL}/auth/callback`, state }).toString(); const response = NextResponse.redirect(url); response.cookies.set('gd_oauth_state', sign(state), { ...cookie, maxAge: 600 }); return response; }
