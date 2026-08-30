import { cookies } from 'next/headers';
import { open } from './auth.mjs';
export async function session() { return open((await cookies()).get('gd_session')?.value); }
