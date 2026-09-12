import { authorize, body, context, db, failure, json, runtimeEnv } from '@/lib/server';
import { sessionConfig } from '@/lib/agent';
import { z } from 'zod';
import { safeDiagnostic } from '@/lib/diagnostics';
export async function POST(request:Request) {
  let reservation:string|undefined;
  try {
    const userId=await authorize(request);
    const {sdp}=z.object({sdp:z.string().min(10).max(50000)}).strict().parse(await body(request));
    if(!runtimeEnv.OPENAI_API_KEY) return json({error:'Voice is not configured yet.'},503);
    const now=Date.now(); reservation=crypto.randomUUID();
    // Atomic reservation limits accidental double-taps across concurrent requests.
    const reserved=await db().prepare('INSERT INTO live_sessions (id,user_id,created_at,expires_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM live_sessions WHERE user_id=? AND created_at>?) < 4 AND (SELECT COUNT(*) FROM live_sessions WHERE user_id=? AND expires_at>?) < 2').bind(reservation,userId,now,now+60000,userId,now-60000,userId,now).run();
    if(!reserved.meta.changes) {console.info(JSON.stringify({event:'voice_diagnostic',component:'sites_app',endpoint:'/api/session',http_status:429,error_code:'session_start_throttled',retry_after_ms:60000}));const r=json({error:'Please give the connection a moment, then try again.',retryable:true,retry_after_ms:60000},429);r.headers.set('Retry-After','60');return r;}
    const backend=runtimeEnv.BACKEND_MODEL==='gpt-5.6-terra'?'gpt-5.6-terra':'gpt-5.6-luna';
    const config=sessionConfig(await context(userId),'gleam',backend);
    const response=await fetch('https://api.openai.com/v1/live/sessions',{method:'POST',headers:{Authorization:`Bearer ${runtimeEnv.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({session:config,transport:{type:'webrtc',sdp}}),signal:AbortSignal.timeout(25000)});
    if(!response.ok) {
      const data=await response.json().catch(()=>({})) as {error?:unknown};
      const diagnostic=safeDiagnostic({response:{model:'gpt-live-1'},error:data.error},backend,response.headers,response.status);
      console.info(JSON.stringify({event:'voice_diagnostic',at:new Date().toISOString(),...diagnostic}));
      await db().prepare('UPDATE live_sessions SET expires_at=0 WHERE id=?').bind(reservation).run();
      const r=json({error:diagnostic.rate_limited?'I hit a temporary service limit. Give me a moment and ask me again.':'The voice service is unavailable right now. Your saved notes are still here.',retryable:diagnostic.rate_limited,retry_after_ms:diagnostic.retry_after_ms},response.status===429?429:502);
      if(diagnostic.retry_after_ms!==null)r.headers.set('Retry-After',String(Math.ceil(diagnostic.retry_after_ms/1000)));
      return r;
    }
    const result=await response.json() as {session:{id:string};transport:{sdp:string}};
    if(!result.session?.id||!result.transport?.sdp) throw new Error('Invalid service response');
    await db().prepare('UPDATE live_sessions SET id=?,expires_at=? WHERE id=? AND user_id=?').bind(result.session.id,now+25*60*1000,reservation,userId).run();
    return json({id:result.session.id,sdp:result.transport.sdp,backend_model:backend});
  } catch(error) {if(reservation) await db().prepare('UPDATE live_sessions SET expires_at=0 WHERE id=?').bind(reservation).run().catch(()=>{}); return failure(error);}
}
