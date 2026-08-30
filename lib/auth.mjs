import { createHash, createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';

const secret = () => process.env.SESSION_SECRET || process.env.GITHUB_CLIENT_SECRET;
const key = () => createHash('sha256').update(secret()).digest();
const b64 = value => Buffer.from(value).toString('base64url');
const unb64 = value => Buffer.from(value, 'base64url');
export const random = () => randomBytes(24).toString('base64url');
export function sign(value) { return `${value}.${createHmac('sha256', secret()).update(value).digest('base64url')}`; }
export function verify(value) { const [data, signature] = (value || '').split('.'); if (!data || !signature) return null; const expected = createHmac('sha256', secret()).update(data).digest('base64url'); return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? data : null; }
export function seal(data) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv); const body = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]); return `${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(body)}`; }
export function open(value) { try { const [iv, tag, body] = value.split('.').map(unb64); const decipher = createDecipheriv('aes-256-gcm', key(), iv); decipher.setAuthTag(tag); return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')); } catch { return null; } }
export const cookie = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 8 };
