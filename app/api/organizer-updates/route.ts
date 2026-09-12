import { authorize, body, db, failure, json, readOrganizerUpdates, runtimeEnv } from '@/lib/server';
import { runbook } from '@/lib/runbook';
import { cleanMessage, extractionFormat, extractionInstructions, previewInput, updateDraft, updateText } from '@/lib/organizer-update';
import { z } from 'zod';
const busy = new Map<string,number>();
export async function POST(request:Request) {
  try {
    const user=await authorize(request), input=await body(request,24000);
    if(input.action==='preview') {
      const data=previewInput.parse(input.data);
      let source:string,message:string;
      try{source=cleanMessage(data.source);message=cleanMessage(data.message);}catch{return json({error:'Remove credentials from the message before reviewing it.'},400);}
      if(!runtimeEnv.OPENAI_API_KEY)return json({error:'Message review is unavailable right now. Your text is still here.'},503);
      if((busy.get(user)||0)>Date.now())return json({error:'Please wait a moment before reviewing another message.'},429);
      busy.set(user,Date.now()+20000);
      try {
        const prior=await readOrganizerUpdates(user);
        const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${runtimeEnv.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',store:false,instructions:extractionInstructions,input:JSON.stringify({source,message_date:data.message_date,message,runbook:runbook.slice(0,26000),recent_updates:prior}),text:{format:extractionFormat},reasoning:{effort:'none'},max_output_tokens:1400}),signal:AbortSignal.timeout(25000)});
        if(!response.ok){const retry=response.headers.get('Retry-After');const result=json({error:response.status===429?'Message review hit a temporary limit. Wait a moment, then try again. Your text is still here.':'Message review is unavailable right now. Your text is still here.'},response.status===429?429:503);if(retry)result.headers.set('Retry-After',retry);return result;}
        const result=await response.json() as {status?:string;output?:Array<{type:string;content?:Array<{type:string;text?:string}>}>};
        if(result.status!=='completed')return json({error:'The review did not finish. Try again; your text is still here.'},503);
        const text=result.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text||'').join('')||'';
        const parsed=z.object({updates:z.array(z.object({fact:z.string().max(480),conflict:z.string().max(180)})).max(3)}).parse(JSON.parse(text));
        if(!parsed.updates.length)return json({error:'No clear event updates found. Paste the relevant decision or instruction and try again.'},422);
        const draft=updateDraft.parse({source,message_date:data.message_date,updates:parsed.updates});
        updateText(draft); // Reject credentials in generated summaries too.
        return json({draft});
      } finally { if((busy.get(user)||0)<Date.now())busy.delete(user); }
    }
    if(input.action==='save') {
      const {request_id,draft}=z.object({request_id:z.string().uuid(),draft:updateDraft}).strict().parse(input.data);
      let text:string;try{text=updateText(draft);}catch{return json({error:'Remove credentials before saving.'},400);}
      const operation=`${user}:organizer-update:${request_id}`, value=JSON.stringify({text}), id=crypto.randomUUID(), now=new Date().toISOString();
      await db().prepare('INSERT INTO organizer_entries (id,user_id,kind,text,subject,due_at,created_at,operation_key,request_json) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(operation_key) DO NOTHING').bind(id,user,'update',text,'Organizer message',null,now,operation,value).run();
      const saved=await db().prepare('SELECT id,text,created_at,request_json FROM organizer_entries WHERE operation_key=? AND user_id=?').bind(operation,user).first<{id:string;text:string;created_at:string;request_json:string}>();
      if(!saved||saved.request_json!==value)return json({error:'This save was already used for a different summary. Review the message again.'},409);
      return json({ok:true,entry:{id:saved.id,text:saved.text,created_at:saved.created_at}});
    }
    return json({error:'Unknown action.'},400);
  }catch(error){return failure(error);}
}
