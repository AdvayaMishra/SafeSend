import type {Request,Response} from 'express';
import crypto from 'node:crypto';
import {HttpError} from './security.js';
let requests=0,errors=0,totalMs=0,maxMs=0;
const recent:number[]=[];
export function recordRequest(status:number,elapsed:number) {
  requests++;errors+=status>=500?1:0;totalMs+=elapsed;maxMs=Math.max(maxMs,elapsed);
  recent.push(status>=500?1:0);if(recent.length>100)recent.shift();
}
export function metrics(req:Request,res:Response) {
  const expected=process.env.OPERATIONS_TOKEN,actual=req.get('x-operations-token');
  if(!expected||!actual||!crypto.timingSafeEqual(crypto.createHash('sha256').update(expected).digest(),crypto.createHash('sha256').update(actual).digest()))
    throw new HttpError(403,'OPERATIONS_AUTH_REQUIRED');
  res.json({uptimeSeconds:Math.floor(process.uptime()),requests,serverErrors:errors,
    averageLatencyMs:requests?Math.round(totalMs/requests):0,maxLatencyMs:Math.round(maxMs),
    windowRequests:recent.length,windowErrors:recent.reduce((n,v)=>n+v,0),scope:'current backend process'});
}
const alert=setInterval(()=>{
  const failures=recent.reduce((n,v)=>n+v,0);
  if(recent.length>=20&&failures/recent.length>=0.2)console.error(JSON.stringify({event:'operational_alert',kind:'elevated_server_error_rate',windowRequests:recent.length,windowErrors:failures}));
},60000);alert.unref();
