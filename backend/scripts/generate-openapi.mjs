import {writeFileSync} from 'node:fs';
const paths={};
const encrypted={type:'object',required:['encryptedContent','iv','expiresAt'],properties:{
  encryptedContent:{type:'string',description:'Client-side AES-GCM ciphertext, base64. Never plaintext.'},iv:{type:'string',minLength:16,maxLength:16},
  expiresAt:{type:'string',format:'date-time'},accessStart:{type:'string',format:'date-time'},accessEnd:{type:'string',format:'date-time'},
  maxViews:{type:['integer','null'],minimum:1},burnAfterRead:{type:'boolean'},password:{type:'string',maxLength:1024,description:'Optional access password; not the encryption key.'},
  recipientEmail:{type:'string',format:'email'},workspaceId:{type:'string',format:'uuid'}}};
function add(method,path,summary,{auth=false,body,success='200',management=false}={}) {
  const parameters=[...path.matchAll(/\{(\w+)\}/g)].map(m=>({name:m[1],in:'path',required:true,schema:{type:'string'}}));
  paths[path]??={};paths[path][method]={summary,parameters,
    ...(auth?{security:[{Session:[]},...(/^\/api\/(v1\/)?(secrets|audit)(\/|$)/.test(path)?[{ApiKey:[]}]:[]),...(management?[{ManagementToken:[]}]:[])]}:{}),
    ...(body?{requestBody:{required:true,content:{'application/json':{schema:body}}}}:{}),
    responses:{[success]:{description:'Successful operation; see API_DOCUMENTATION.md for returned fields.'},'400':{description:'Invalid input'},'401':{description:'Authentication required'},'403':{description:'Policy or scope denied'},'409':{description:'State conflict'},'410':{description:'Expired/revoked/consumed'},'429':{description:'Temporary rate limit'},'503':{description:'Dependency unavailable'}}};
}
add('post','/api/v1/secrets','Create a client-encrypted secret',{body:encrypted,success:'201'});
add('get','/api/v1/secrets','List accessible secret IDs',{auth:true});
add('get','/api/v1/secrets/{id}','Public safe secret metadata');
add('post','/api/v1/secrets/{id}/access','Consume one view atomically and receive ciphertext',{body:{type:'object',properties:{password:{type:'string'}}}});
add('get','/api/v1/secrets/{id}/dashboard','Authorized metadata and events',{auth:true,management:true});
add('post','/api/v1/secrets/{id}/revoke','Revoke access and delivery tokens',{auth:true,management:true});
add('patch','/api/v1/secrets/{id}/policy','Suspend or resume access',{auth:true,management:true,body:{type:'object',required:['suspended'],properties:{suspended:{type:'boolean'}}}});
for(const [method,path,summary] of [
  ['get','/api/account','Current verified session identity'],['get','/api/workspaces','Accessible memberships'],['post','/api/workspaces','Create workspace'],
  ['get','/api/workspaces/current','Current workspace and role permissions'],['post','/api/workspaces/current/invitations','Create a one-time manual invitation link'],
  ['post','/api/workspaces/invitations/accept','Accept invitation as its verified recipient'],['patch','/api/workspaces/current/members/{id}','Owner changes member role'],
  ['delete','/api/workspaces/current/members/{id}','Owner removes non-owner member'],['get','/api/keys','List key summaries'],['post','/api/keys','Create scoped API key, raw value shown once'],
  ['delete','/api/keys/{id}','Revoke owned key'],['post','/api/keys/{id}/rotate','Atomically rotate owned key'],['get','/api/keys/{id}/usage','Owned key usage'],
  ['get','/api/audit','Authorized per-secret audit records'],['get','/api/audit/verify','Verify hash links and local signed checkpoints'],
  ['get','/api/threats','Authorized sliding-window incidents'],['get','/api/analytics','Authorized event counts and capped event history'],
  ['get','/api/notifications','Persistent account notices'],['post','/api/notifications/{id}/read','Persist read state'],
  ['get','/api/notifications/preferences','Notification preferences'],['patch','/api/notifications/preferences','Set in-app notification preferences'],
])add(method,path,summary,{auth:true});
for(const [method,path,summary] of [
  ['post','/api/v1/secrets/{id}/attachments','Sender uploads legacy encrypted file (multipart file and encryptedKeyBundle)'],
  ['get','/api/v1/secrets/{id}/attachments','List encrypted file metadata with delivery bearer token'],
  ['get','/api/v1/secrets/{id}/attachments/{attachmentId}/download','Download legacy encrypted bytes with delivery bearer token'],
  ['post','/api/v1/secrets/{id}/uploads','Create resumable encrypted upload session'],
  ['get','/api/v1/secrets/{id}/uploads/{session}','Sender resumes from committed chunk hashes'],
  ['put','/api/v1/secrets/{id}/uploads/{session}/chunks/{index}','Sender uploads ciphertext bytes with X-Chunk-SHA256'],
  ['post','/api/v1/secrets/{id}/uploads/{session}/complete','Atomically finalize encrypted attachment metadata'],
  ['delete','/api/v1/secrets/{id}/uploads/{session}','Mark incomplete session aborted'],
  ['get','/api/v1/secrets/{id}/uploads/{session}/chunks/{index}','Recipient downloads encrypted chunk with delivery bearer token']
])add(method,path,summary,{auth:true,management:true});
for(const p of ['/api/health','/api/test-db'])add('get',p,'Dependency/liveness check');
add('get','/api/metrics','Current-process operational counters',{auth:true});
paths['/api/metrics'].get.security=[{OperationsToken:[]}];
const bodies={
  '/api/workspaces':{name:{type:'string',maxLength:100}},
  '/api/workspaces/current/invitations':{email:{type:'string',format:'email'},role:{type:'string',enum:['ADMIN','MEMBER','AUDITOR']}},
  '/api/workspaces/invitations/accept':{token:{type:'string'}},
  '/api/workspaces/current/members/{id}':{role:{type:'string',enum:['ADMIN','MEMBER','AUDITOR']}},
  '/api/keys':{name:{type:'string'},scopes:{type:'array',items:{type:'string',enum:['secrets:create','secrets:read','secrets:revoke','audit:read']}}},
  '/api/notifications/preferences':{threat_alerts:{type:'boolean'},access_notifications:{type:'boolean'},expiration_notices:{type:'boolean'},email_delivery:{type:'boolean',const:false}},
  '/api/v1/secrets/{id}/uploads':{totalChunks:{type:'integer',minimum:1,maximum:26},totalBytes:{type:'integer',minimum:17}},
  '/api/v1/secrets/{id}/uploads/{session}/complete':{encryptedKeyBundle:{type:'string',maxLength:32768}}
};
for(const [path,properties] of Object.entries(bodies))for(const method of ['post','patch'])if(paths[path]?.[method])
  paths[path][method].requestBody={required:true,content:{'application/json':{schema:{type:'object',properties}}}};
paths['/api/v1/secrets/{id}/uploads/{session}/chunks/{index}'].put.requestBody={required:true,content:{'application/octet-stream':{schema:{type:'string',format:'binary'}}}};
paths['/api/v1/secrets/{id}/uploads/{session}/chunks/{index}'].put.parameters.push({name:'X-Chunk-SHA256',in:'header',required:true,schema:{type:'string',pattern:'^[a-f0-9]{64}$'}});
paths['/api/v1/secrets/{id}/attachments'].post.requestBody={required:true,content:{'multipart/form-data':{schema:{type:'object',required:['file','encryptedKeyBundle'],properties:{file:{type:'string',format:'binary'},encryptedKeyBundle:{type:'string'}}}}}};
for(const p of ['/api/v1/secrets/{id}/attachments','/api/v1/secrets/{id}/attachments/{attachmentId}/download','/api/v1/secrets/{id}/uploads/{session}/chunks/{index}'])
  paths[p].get.security=[{DeliveryToken:[]}];
writeFileSync('openapi.json',JSON.stringify({openapi:'3.1.0',info:{title:'SecureShare API',version:'1.0.0',description:'Legacy /api/secrets aliases also remain available. Decryption keys stay client-side. Passkeys and email invitation delivery are not implemented.'},paths,
  components:{securitySchemes:{Session:{type:'http',scheme:'bearer',bearerFormat:'Supabase JWT'},ApiKey:{type:'http',scheme:'bearer',description:'Scoped ss_ API key'},DeliveryToken:{type:'http',scheme:'bearer',description:'Short-lived attachment token issued by successful secret consumption'},ManagementToken:{type:'apiKey',in:'header',name:'X-Management-Token'},OperationsToken:{type:'apiKey',in:'header',name:'X-Operations-Token'}}}},null,2));
console.log('OpenAPI inventory generated.');
