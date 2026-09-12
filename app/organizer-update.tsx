'use client';
import {useRef,useState} from 'react';
import {MailPlus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription,SheetTrigger} from '@/components/ui/sheet';
type Draft={source:string;message_date:string;updates:Array<{fact:string;conflict:string}>};
export default function OrganizerUpdate({onSaved}:{onSaved:(entry:{text:string})=>void}) {
  const [open,setOpen]=useState(false),[source,setSource]=useState(''),[message,setMessage]=useState('');
  const [messageDate,setDate]=useState(()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Los_Angeles'}));
  const [draft,setDraft]=useState<Draft|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
  const saveId=useRef('');
  async function request(action:string,data:unknown) {
    const r=await fetch('/api/organizer-updates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data})});
    const result=await r.json() as {error?:string;draft:Draft;entry:{text:string}};if(!r.ok)throw new Error(result.error||'That did not finish. Your text is still here.');return result;
  }
  async function review(e:React.FormEvent) {e.preventDefault();setBusy(true);setError('');try{const result=await request('preview',{source,message_date:messageDate,message});saveId.current=crypto.randomUUID();setDraft(result.draft);}catch(e){setError(e instanceof Error?e.message:'Could not review this message.');}finally{setBusy(false);}}
  async function save() {setBusy(true);setError('');try{const result=await request('save',{request_id:saveId.current,draft});setDone(true);setMessage('');setDraft(null);try{onSaved(result.entry);}catch{/* The durable save succeeded even if an active voice session ended. */}}catch(e){setError(e instanceof Error?e.message:'Could not save. Please try again.');}finally{setBusy(false);}}
  function reset(){setDone(false);setSource('');setDraft(null);setError('');}
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger className="update-trigger"><MailPlus size={18}/> Update Lindsay</SheetTrigger>
    <SheetContent className="update-sheet"><SheetHeader><SheetTitle>Keep Lindsay in the loop.</SheetTitle><SheetDescription>Paste an organizer email or chat message. Review the useful details before saving.</SheetDescription></SheetHeader>
    <div className="update-body">
      {done?<div className="update-success" role="status"><h2>Lindsay’s up to date.</h2><p>Your confirmed summary is saved privately and available in conversation. Any flagged conflicts still need a decision.</p><Button onClick={reset}>Add another message</Button><button className="update-back" onClick={()=>setOpen(false)}>Done</button></div>:draft?<div>
        <p className="update-source">{draft.source} · {draft.message_date}</p><h2>Check what she’ll remember.</h2>
        {draft.updates.map((item,i)=><div className="update-review" key={i}><label htmlFor={`fact-${i}`}>Update {i+1}</label><textarea id={`fact-${i}`} rows={3} maxLength={480} value={item.fact} disabled={busy} onChange={e=>setDraft({...draft,updates:draft.updates.map((u,n)=>n===i?{...u,fact:e.target.value}:u)})}/>{item.conflict&&<p className="update-conflict"><strong>Needs a decision:</strong> {item.conflict}</p>}</div>)}
        <p className="update-help">Saving keeps the source and message date. Conflicts are flagged, never silently resolved.</p>
        <Button disabled={busy||draft.updates.some(u=>!u.fact.trim())} onClick={save}>{busy?'Saving…':'Confirm & save'}</Button><button className="update-back" disabled={busy} onClick={()=>{setDraft(null);setError('');}}>Back to message</button>
      </div>:<form onSubmit={review}>
        <label htmlFor="update-source">Who is this from?</label><input id="update-source" placeholder="e.g. AI Tinkerers HQ — organizer email" required maxLength={100} value={source} disabled={busy} onChange={e=>setSource(e.target.value)}/>
        <label htmlFor="update-date">Message date</label><input id="update-date" type="date" required value={messageDate} disabled={busy} onChange={e=>setDate(e.target.value)}/>
        <label htmlFor="update-message">Paste the message</label><textarea id="update-message" rows={8} required minLength={10} maxLength={12000} placeholder="Paste the relevant email or organizer-chat message here…" value={message} disabled={busy} onChange={e=>setMessage(e.target.value)}/>
        <p className="update-help">Only the summary you confirm is saved. Leave out passwords, API keys and unnecessary contact details. Message review uses OpenAI; it never goes to web search.</p>
        <Button type="submit" disabled={busy}>{busy?'Reading the message…':'Review updates'}</Button>
      </form>}
      {error&&<p className="update-error" role="alert">{error}</p>}
    </div></SheetContent>
  </Sheet>;
}
