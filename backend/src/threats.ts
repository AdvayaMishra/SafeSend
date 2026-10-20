import crypto from 'node:crypto';
import type { Request } from 'express';
import { supabase } from './config/supabase.js';
import { check,HttpError } from './security.js';
export async function observe(req:Request,secretId:string,event:string) {
  const salt=process.env.EVENT_HMAC_KEY;
  if(!salt) throw new HttpError(503,'SECURITY_CONFIGURATION_MISSING');
  // Network address is only a weak grouping signal, never an account identity.
  const source='hmac:'+crypto.createHmac('sha256',salt).update(req.ip??'unknown').digest('hex');
  const allowed=check(await supabase.rpc('observe_security_event',{p_secret:secretId,p_source:source,p_event:event}));
  if(!allowed) throw new HttpError(429,'SOURCE_COOLDOWN');
}
