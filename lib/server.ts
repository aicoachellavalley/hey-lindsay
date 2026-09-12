import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { initialFacts, type Fact } from './event-state';
import {attendanceValue,teamValues,deadlineValue,createTinkerersClient,ConnectorError,mcpEndpoint} from './tinkerers-mcp';
import {makeParticipantLookup,participantResult,peopleForNeed} from './participants';
import { runbook } from './runbook';
import { functionTools } from './agent';
import { z } from 'zod';
import {createLiveWebSearch} from './live-web';

export const runtimeEnv = env as unknown as { DB: D1Database; OPENAI_API_KEY?: string; BACKEND_MODEL?: string; AITINKERERS_API_KEY?:string; EXA_API_KEY?:string };
const searchWeb=createLiveWebSearch({getKey:()=>runtimeEnv.EXA_API_KEY,diagnostic:(d:unknown)=>console.info(JSON.stringify(d))});
let privateProfileText:string[]=[]; let privateProfileExpires=0;
const lookupParticipants=makeParticipantLookup(()=>runtimeEnv.AITINKERERS_API_KEY);
export function db() { if(!runtimeEnv.DB) throw new Error('Storage unavailable'); return runtimeEnv.DB; }
export function json(value: unknown, status=200) { return Response.json(value,{status,headers:{'Cache-Control':'no-store'}}); }
export async function authorize(request: Request) {
  const user=await getChatGPTUser();
  if(!user) throw new Response('Sign in required',{status:401});
  if(request.method!=='GET') {
    const origin=request.headers.get('origin');
    if(origin && origin!==new URL(request.url).origin) throw new Response('Invalid origin',{status:403});
    if(!request.headers.get('content-type')?.startsWith('application/json')) throw new Response('JSON required',{status:415});
  }
  return user.userId;
}
export async function body(request:Request,maxBytes=60000) {
  if(Number(request.headers.get('content-length')||0)>maxBytes) throw new Response('Request too large',{status:413});
  const reader=request.body?.getReader(); if(!reader) throw new Response('Body required',{status:400});
  const chunks:Uint8Array[]=[];let bytes=0;
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel();throw new Response('Request too large',{status:413});}chunks.push(value);}
  const merged=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(merged));}catch{throw new Response('Invalid JSON',{status:400});}
}
export function failure(error:unknown) {
  if(error instanceof Response) return json({error:error.status===401?'Please sign in to HEY LINDSAY.':'Request rejected.'},error.status);
  if(error instanceof z.ZodError) return json({error:'The action details were invalid. Please try again.'},400);
  return json({error:'The action could not be completed. No save has been confirmed.'},503);
}
export async function readEntries(userId:string) {
  const rows=await db().prepare('SELECT id,kind,text,subject,due_at,created_at FROM organizer_entries WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100').bind(userId).all();
  const count=await db().prepare('SELECT COUNT(*) AS total FROM organizer_entries WHERE user_id=?').bind(userId).first<{total:number}>();
  return {entries:rows.results,total:count?.total||0,limit:100,coverage:'Latest 100 records; recorded issues are not guaranteed unresolved. Reminders have no notifications.'};
}
export async function readOrganizerUpdates(userId:string) {
  const rows=await db().prepare("SELECT text,created_at FROM organizer_entries WHERE user_id=? AND kind='update' ORDER BY created_at DESC,id DESC LIMIT 5").bind(userId).all();
  return rows.results;
}
export async function facts():Promise<Fact[]> {
  await db().batch(initialFacts.map(f=>db().prepare('INSERT INTO event_facts (key,layer,source,retrieved_at,as_of,value_json) VALUES (?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET layer=excluded.layer,source=excluded.source,retrieved_at=excluded.retrieved_at,as_of=excluded.as_of,value_json=excluded.value_json WHERE excluded.retrieved_at > event_facts.retrieved_at').bind(f.key,f.layer,f.source,f.retrieved_at,f.as_of,JSON.stringify(f.value))));
  const result=await db().prepare('SELECT * FROM event_facts ORDER BY key').all<{key:string;layer:Fact['layer'];source:string;retrieved_at:string;as_of:string|null;value_json:string}>();
  return result.results.map(({value_json,...f})=>({...f,value:JSON.parse(value_json)}));
}
async function storeFact(f:Fact){await db().prepare('INSERT INTO event_facts (key,layer,source,retrieved_at,as_of,value_json) VALUES (?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET layer=excluded.layer,source=excluded.source,retrieved_at=excluded.retrieved_at,as_of=excluded.as_of,value_json=excluded.value_json WHERE excluded.retrieved_at > event_facts.retrieved_at').bind(f.key,f.layer,f.source,f.retrieved_at,f.as_of,JSON.stringify(f.value)).run();}
export async function liveStateResult(scope:string){
  const cached=await facts(),checkedAt=new Date().toISOString();
  const wanted=scope==='all'?['attendance','teams','submissions','deadline']:[scope];
  const liveScopes=wanted.filter(k=>['attendance','teams','submissions','deadline'].includes(k));
  const selected=(items:Fact[])=>items.filter(f=>!f.key.startsWith('_')&&(scope==='all'||f.key===scope||(scope==='catering'&&f.key==='catering_estimates')));
  const result=(connection:string,items:Fact[],fresh:string[]=[],reason:string|null=null)=>({ok:true,connection,checked_at:checkedAt,live_verified:liveScopes.length>0&&liveScopes.every(k=>fresh.includes(k)),reason,facts:selected(items).map(f=>({...f,live_verified:fresh.includes(f.key)})),instruction:'Use each fact’s as_of timestamp. Only facts marked live_verified were retrieved in this request. Any connection other than connected, recent_cache or local_state means the live lookup did not complete: say you cannot reach Tinkerers now, then give the last successful cached value and its actual timestamp. Recent cache means recently checked, not a new fetch. Never turn checked_at into freshness. Preserve the difference between portal cutoff and earlier HQ submission target; local plans and notes are separate.'});
  if(!liveScopes.length)return result('local_state',cached);
  if(!runtimeEnv.AITINKERERS_API_KEY)return result('not_connected',cached,[],'Connector is not configured.');
  const health=cached.find(f=>f.key==='_connector_status')?.value as {retry_at?:number;code?:string}|undefined;
  if(health?.retry_at&&health.retry_at>Date.now())return result(health.code||'unavailable',cached,[],'Connection is waiting before another attempt.');
  if(liveScopes.every(k=>cached.some(f=>f.key===k&&f.source.startsWith(mcpEndpoint)&&Date.now()-Date.parse(f.retrieved_at)<15000)))return result('recent_cache',cached);
  const fresh:Fact[]=[];
  try{
    const client=createTinkerersClient(runtimeEnv.AITINKERERS_API_KEY);await client.initialize();
    const put=async(key:string,value:unknown,tool:string)=>{const now=new Date().toISOString();const fact:Fact={key,value,source:`${mcpEndpoint}#${tool}`,layer:'portal_snapshot',retrieved_at:now,as_of:now};await storeFact(fact);fresh.push(fact);};
    if(liveScopes.includes('attendance'))await put('attendance',attendanceValue(await client.read('rsvp_summary')),'rsvp_summary');
    if(liveScopes.some(k=>k==='teams'||k==='submissions')){const values=teamValues(await client.read('hackathon_team_search'));await put('teams',values.teams,'hackathon_team_search');await put('submissions',values.submissions,'hackathon_team_search');}
    if(liveScopes.includes('deadline'))await put('deadline',deadlineValue(await client.read('global_hackathon_cities_list')),'global_hackathon_cities_list');
    return result('connected',[...cached.filter(f=>!fresh.some(n=>n.key===f.key)),...fresh],fresh.map(f=>f.key));
  }catch(error){
    const code=error instanceof ConnectorError?error.code:'unavailable';const delay=error instanceof ConnectorError&&error.retryMs!==null?error.retryMs:['auth_expired','access_denied'].includes(code)?300000:60000;
    console.info(JSON.stringify({event:'tinkerers_diagnostic',endpoint:mcpEndpoint,error_code:code,http_status:error instanceof ConnectorError?error.status:null,retry_after_ms:delay}));
    await storeFact({key:'_connector_status',layer:'assumption',source:'Connector status; not event truth',as_of:null,retrieved_at:new Date().toISOString(),value:{code,retry_at:Date.now()+delay+250}}).catch(()=>{});
    return result(code,[...cached.filter(f=>!fresh.some(n=>n.key===f.key)),...fresh],fresh.map(f=>f.key),'A live lookup did not complete. Use only successful facts with their timestamps.');
  }
}
export async function context(userId:string,section?:string|null) {
  const time=new Date();
  const headings=runbook.split(/^## /m).slice(1);
  const selected=section===undefined?runbook:section?headings.find(s=>s.split('\n')[0].trim()===section):undefined;
  const data={organizer_updates:await readOrganizerUpdates(userId),web_search:runtimeEnv.EXA_API_KEY?'available_on_request':'not_configured',portal_connection:runtimeEnv.AITINKERERS_API_KEY?'available_on_request':'not_connected',current_time:time.toISOString(),local_time:time.toLocaleString('en-US',{timeZone:'America/Los_Angeles'}),timezone:'America/Los_Angeles',event_date:'2030-09-14',runbook:selected||null,event_state:section===undefined?(await facts()).filter(f=>!f.key.startsWith('_')):[],organizer_entries:section===null?await readEntries(userId):{entries:[],total:0,limit:0,coverage:'Notes not requested'}};
  if(section!==undefined) { // Keep tool payloads small enough for the demo API project's token limits.
    let chars=0; data.organizer_entries.entries=data.organizer_entries.entries.slice(0,12).filter(e=>(chars+=JSON.stringify(e).length)<=1800);
  }
  if(section===null) data.organizer_entries.coverage=`Showing ${data.organizer_entries.entries.length} of ${data.organizer_entries.total} newest-first records; more may exist. Issues are not guaranteed unresolved.`;
  return data;
}
const saveSchema=z.object({kind:z.enum(['note','reminder','issue']),text:z.string().trim().min(1).max(700),subject:z.string().trim().min(1).max(120).nullable(),due_at:z.string().datetime({offset:true}).nullable()}).strict();
export async function executeTool(userId:string,sessionId:string,callId:string,name:string,args:unknown) {
  if(name==='search_live_web'){
    const {query}=z.object({query:z.string().trim().min(3).max(240)}).strict().parse(args);
    if(!runtimeEnv.EXA_API_KEY)return searchWeb(query);
    // This local privacy check never sends entries or profiles to the provider.
    if(Date.now()>privateProfileExpires)privateProfileText=[];
    const entries=await readEntries(userId);
    const privateText=entries.entries.flatMap(e=>[String(e.text||''),String(e.subject||'')]);
    return searchWeb(query,[...privateText,...privateProfileText]);
  }
  if(name==='get_event_participants'){z.object({}).strict().parse(args);const data=await lookupParticipants();privateProfileText=data.participants.flatMap(p=>[p.display_name,p.title||'',p.bio||'']);privateProfileExpires=Date.now()+15*60*1000;return participantResult(data);}
  if(name==='find_people_for_need'){const {query}=z.object({query:z.string().trim().min(1).max(300)}).strict().parse(args);const data=await lookupParticipants();privateProfileText=data.participants.flatMap(p=>[p.display_name,p.title||'',p.bio||'']);privateProfileExpires=Date.now()+15*60*1000;return peopleForNeed(data,query);}
  if(name==='read_live_event_state') {
    const {scope}=z.object({scope:z.enum(['attendance','teams','submissions','deadline','credits','catering','media','all'])}).strict().parse(args);
    return liveStateResult(scope);
  }
  if(name==='read_event_context') {
    const {section}=z.object({section:z.string().nullable()}).strict().parse(args);
    const allowed=functionTools.find(t=>t.name==='read_event_context')?.parameters.properties.section?.enum || [];
    if(!allowed.includes(section)) return {ok:false,error:'Unknown runbook section.'};
    return {ok:true,...await context(userId,section)};
  }
  if(name!=='save_organizer_entry') return {ok:false,error:'Unknown tool.'};
  const entry=saveSchema.parse(args), operationKey=`${userId}:${sessionId}:${callId}`, requestJson=JSON.stringify(entry);
  const id=crypto.randomUUID(), now=new Date().toISOString();
  await db().prepare('INSERT INTO organizer_entries (id,user_id,kind,text,subject,due_at,created_at,operation_key,request_json) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(operation_key) DO NOTHING').bind(id,userId,entry.kind,entry.text,entry.subject,entry.due_at,now,operationKey,requestJson).run();
  const saved=await db().prepare('SELECT id,kind,text,subject,due_at,created_at,request_json FROM organizer_entries WHERE operation_key=? AND user_id=?').bind(operationKey,userId).first();
  if(!saved || saved.request_json!==requestJson) return {ok:false,error:'This action ID was already used with different content. No new entry was saved.'};
  const {request_json:_,...safe}=saved; // eslint-disable-line @typescript-eslint/no-unused-vars
  return {ok:true,entry:safe,notification_scheduled:false};
}
