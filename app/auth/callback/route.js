import { GET as callback } from '../../api/auth/callback/route.js';
export const runtime = 'nodejs';
export async function GET(request) { return callback(request); }
