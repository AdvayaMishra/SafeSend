import "dotenv/config";
import express from "express";
import cors from "cors";
import { supabase } from "./config/supabase.js";
import secretsRouter from "./routes/secrets.js";
import attachmentsRouter from "./routes/attachments.js";
import crypto from 'node:crypto';
import { HttpError,identity,check } from './security.js';
import platformRouter from './routes/platform.js';
import uploadsRouter from './routes/uploads.js';
import {recordRequest,metrics} from './monitoring.js';
import {startLifecycleWorker} from './maintenance.js';
import {readFileSync} from 'node:fs';

const app = express();
app.disable('x-powered-by');
const proxyHops=Number(process.env.TRUST_PROXY_HOPS??0);
if(!Number.isInteger(proxyHops)||proxyHops<0||proxyHops>2)throw new Error('Invalid TRUST_PROXY_HOPS');
if(proxyHops)app.set('trust proxy',proxyHops);
app.use((req,res,next)=>{
  const requestId=crypto.randomUUID();const start=performance.now();
  res.setHeader('X-Request-ID',requestId);
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.on('finish',()=>{const latencyMs=Math.round(performance.now()-start);recordRequest(res.statusCode,latencyMs);
    console.log(JSON.stringify({requestId,method:req.method,route:req.route?.path??'unmatched',status:res.statusCode,latencyMs}));});
  next();
});

const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(value=>value.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  exposedHeaders:['X-Request-ID'],
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new HttpError(403,'ORIGIN_NOT_ALLOWED'));
    }
  }
}));
app.use(express.json({limit:'2mb'}));
app.use(['/api/secrets','/api/v1/secrets'],async(req,_res,next)=>{
  if(req.get('authorization')?.startsWith('Bearer ss_'))await identity(req);
  if(req.method==='POST'&&req.path==='/') {
    const salt=process.env.EVENT_HMAC_KEY;
    if(!salt)throw new HttpError(503,'SECURITY_CONFIGURATION_MISSING');
    const source=crypto.createHmac('sha256',salt).update(req.ip??'unknown').digest('hex');
    if(!check(await supabase.rpc('take_rate_limit',{p_key:'create:'+source,p_limit:100,p_seconds:3600})))throw new HttpError(429,'RATE_LIMITED');
  }
  next();
});
app.use("/api/secrets", secretsRouter); 
app.use("/api/secrets", attachmentsRouter);
app.use('/api/v1/secrets',secretsRouter);
app.use('/api/v1/secrets',attachmentsRouter);
app.use('/api/secrets',uploadsRouter);
app.use('/api/v1/secrets',uploadsRouter);
app.use('/api',platformRouter);
app.use('/api/v1',platformRouter);
app.get('/api/metrics',metrics);
app.get('/api/openapi.json',(_req,res)=>res.json(JSON.parse(readFileSync(new URL('../openapi.json',import.meta.url),'utf8'))));

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "SecureShare backend is running"
  });
});

app.get("/api/test-db", async (_req, res) => {
  try {
    const { error } = await supabase
      .from("secrets")
      .select("id")
      .limit(1);    

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: "Supabase connection successful"
    });
  } catch (error) {
    console.error(JSON.stringify({event:'dependency_check_failed',dependency:'database'}));

    res.status(500).json({
      success: false,
      message: "Supabase connection failed"
    });
  }
});

app.use((error: any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  const status=error instanceof HttpError?error.status:error.type==='entity.too.large'?413:
    error.code==='LIMIT_FILE_SIZE'?413:error instanceof SyntaxError?400:500;
  res.status(status).json({success:false,code:error instanceof HttpError?error.code:'REQUEST_FAILED',
    message:error instanceof HttpError?error.message:'Unable to complete request'});
});

app.listen(Number(PORT), "0.0.0.0", () => {
  startLifecycleWorker();
  console.log(
    `SecureShare backend running on port ${PORT}`
  );
});
