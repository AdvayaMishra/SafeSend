import crypto from 'node:crypto';
import type { Request } from 'express';
import { supabase } from './config/supabase.js';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message = code.replaceAll('_', ' ')) { super(message); }
}
export const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const token = () => crypto.randomBytes(32).toString('base64url');
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const ensure = (condition: unknown, status: number, code: string): asserts condition => {
  if (!condition) throw new HttpError(status,code);
};
export function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new HttpError(503,'DATABASE_UNAVAILABLE');
  return result.data;
}
export type Identity = { id: string; email: string; verified: boolean; apiKey?: boolean };
const identityCache = new WeakMap<Request, Identity | null>();
export async function identity(req: Request, required = false): Promise<Identity | null> {
  if (identityCache.has(req)) {
    const value = identityCache.get(req)!;
    if (!value && required) throw new HttpError(401,'SIGN_IN_REQUIRED');
    return value;
  }
  const bearer = req.get('authorization');
  if (!bearer) {
    identityCache.set(req,null);
    if (required) throw new HttpError(401,'SIGN_IN_REQUIRED');
    return null;
  }
  const jwt = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
  if(jwt.startsWith('ss_')) {
    if(jwt.length>256)throw new HttpError(401,'INVALID_API_KEY');
    const k=check(await supabase.from('api_keys').select('id,user_id,scopes,is_revoked,expires_at,rate_limit_per_minute')
      .eq('key_hash',digest(jwt)).maybeSingle());
    if(!k||k.is_revoked||k.expires_at&&Date.parse(k.expires_at)<=Date.now())throw new HttpError(401,'INVALID_API_KEY');
    const scope=/^\/api\/(v1\/)?audit(\/|$)/.test(req.originalUrl)?'audit:read':
      /^\/api\/(v1\/)?secrets\/?$/.test(req.originalUrl.split('?')[0])&&req.method==='POST'?'secrets:create':
      /\/(uploads|attachments)(\/|$)/.test(req.path)&&['POST','PUT','DELETE'].includes(req.method)?'secrets:create':
      req.path.endsWith('/revoke')||req.path.endsWith('/policy')&&req.method==='PATCH'?'secrets:revoke':'secrets:read';
    if(!req.originalUrl.match(/^\/api\/(v1\/)?(secrets|audit)(\/|$)/)||!k.scopes.includes(scope))throw new HttpError(403,'API_SCOPE_REQUIRED');
    if(!check(await supabase.rpc('take_rate_limit',{p_key:'api:'+k.id,p_limit:k.rate_limit_per_minute,p_seconds:60})))throw new HttpError(429,'API_RATE_LIMITED');
    const p=check(await supabase.from('user_profiles').select('id,email,is_email_verified').eq('id',k.user_id).maybeSingle());
    if(!p)throw new HttpError(401,'INVALID_API_KEY');
    check(await supabase.from('api_keys').update({last_used_at:new Date().toISOString()}).eq('id',k.id));
    check(await supabase.from('api_usage').insert({api_key_id:k.id,route:scope}));
    const user={id:p.id,email:p.email,verified:false,apiKey:true};
    identityCache.set(req,user);return user;
  }
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user || !data.user.email) throw new HttpError(401,'INVALID_SESSION');
  const user = { id:data.user.id, email:data.user.email.toLowerCase(), verified:!!data.user.email_confirmed_at };
  identityCache.set(req,user);
  return user;
}
export async function profile(user: Identity) {
  if(user.apiKey)return;
  // IDs come from verified Supabase sessions. Do not accept profile IDs from clients
  // or relink an old profile just because an email string matches.
  check(await supabase.from('user_profiles').upsert({ id:user.id,email:user.email,
    is_email_verified:user.verified, updated_at:new Date().toISOString() },{onConflict:'id'}));
}
export async function secretRecord(id: unknown) {
  if (!uuid(id)) throw new HttpError(404,'NOT_FOUND');
  const { data,error } = await supabase.from('secrets').select('*').eq('id',id).maybeSingle();
  if (error) throw new HttpError(503,'DATABASE_UNAVAILABLE');
  if (!data) throw new HttpError(404,'NOT_FOUND');
  return data;
}
export async function manage(req: Request, secret: any, write = false) {
  const management = req.get('x-management-token');
  if (!secret.workspace_id && management && secret.management_token_hash && digest(management) === secret.management_token_hash) return;
  const user = await identity(req,true);
  if (secret.created_by_user_id === user!.id && !secret.workspace_id) return;
  if (secret.workspace_id) {
    const member = check(await supabase.from('workspace_members').select('role')
      .eq('workspace_id',secret.workspace_id).eq('user_id',user!.id).maybeSingle());
    if (member && (!write || ['owner','admin'].includes(member.role) || member.role==='member'&&secret.created_by_user_id===user!.id)) return;
  }
  throw new HttpError(403,'FORBIDDEN');
}
export function available(secret: any) {
  if (secret.status !== 'active' || secret.destroyed_at) throw new HttpError(410,'SECRET_DESTROYED');
  if (Date.parse(secret.expires_at) <= Date.now()) throw new HttpError(410,'SECRET_EXPIRED');
  if (secret.is_suspended) throw new HttpError(403,'ACCESS_SUSPENDED');
  if (secret.access_start && Date.parse(secret.access_start) > Date.now()) throw new HttpError(403,'ACCESS_WINDOW_NOT_STARTED');
  if (secret.access_end && Date.parse(secret.access_end) <= Date.now()) throw new HttpError(403,'ACCESS_WINDOW_ENDED');
  if (secret.cooldown_until && Date.parse(secret.cooldown_until) > Date.now()) throw new HttpError(429,'RATE_LIMITED');
  if (secret.max_views !== null && secret.view_count >= secret.max_views) throw new HttpError(410,'MAX_VIEWS_REACHED');
}
export function uploadAvailable(secret:any) {
  if(secret.status!=='active'||secret.destroyed_at)throw new HttpError(410,'SECRET_DESTROYED');
  if(Date.parse(secret.expires_at)<=Date.now())throw new HttpError(410,'SECRET_EXPIRED');
}
