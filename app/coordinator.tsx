'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, ArrowUpRight, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { startVoice } from '@/lib/voice';
import OrganizerUpdate from './organizer-update';

type Entry = { id: string; kind: string; text: string; created_at: string; due_at: string | null };
const date = (v: string) => new Date(v).toLocaleString('en-US', {timeZone:'America/Los_Angeles', month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
export default function Coordinator({ signedIn }: { signedIn: boolean }) {
  const [status, setStatus] = useState('Ready when you are');
  const [active, setActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState('');
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const session = useRef<Awaited<ReturnType<typeof startVoice>> | null>(null);
  async function loadEntries() {
    if (!signedIn) return;
    const r = await fetch('/api/entries');
    if (!r.ok) throw new Error('Could not load your notes. Please refresh and sign in again.');
    const data = await r.json() as {entries:Entry[];total:number}; setEntries(data.entries); setTotal(data.total);
  }
  useEffect(() => {
    if(signedIn) fetch('/api/entries').then(async r=>{if(!r.ok) throw new Error('Could not load your notes.');return await r.json() as {entries:Entry[];total:number};}).then(data=>{setEntries(data.entries);setTotal(data.total);}).catch(e=>setNotice(e.message));
    return () => { session.current?.stop(); };
  }, [signedIn]);
  async function toggle() {
    if (pending) return;
    setPending(true); setNotice(''); setSaved('');
    try {
      if (session.current) { await session.current.stop(); session.current = null; }
      else {
        session.current = await startVoice({
          status: setStatus, notice: setNotice, blocked: setAudioBlocked,
          started: () => setActive(true),
          ended: () => { setActive(false); session.current = null; },
          saved: (text: string) => { setSaved(text); loadEntries().catch(e=>setNotice(e.message)); },
        });
      }
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not connect. Please try again.'); }
    finally { setPending(false); }
  }
  return <main className="coordinator">
    <header className="masthead"><div><span className="wordmark">HEY LINDSAY<span className="brand-period">.</span></span><p>Hey, I Gotcha</p></div>
      <Sheet><SheetTrigger className="notes-button" onClick={()=>loadEntries().catch(e=>setNotice(e.message))}><NotebookPen size={18}/><span>Notes</span>{total > 0 && <span className="note-count">{total}</span>}</SheetTrigger>
      <SheetContent className="notes-sheet"><SheetHeader><SheetTitle>Off your mind.</SheetTitle><SheetDescription>Things you asked Lindsay to remember. Reminders are saved notes, without alerts.</SheetDescription></SheetHeader><div className="entries">{!entries.length && <p className="empty">One less thing to keep in your head.</p>}{entries.map(entry=><article className="entry" key={entry.id}><span className="entry-kind">{entry.kind}</span><p>{entry.text}</p><time dateTime={entry.created_at}>{date(entry.created_at)} PDT</time>{entry.due_at && <small>For {date(entry.due_at)} PDT · no alert</small>}</article>)}{total > entries.length && <p>Showing {entries.length} of {total} notes. Older notes remain saved.</p>}</div></SheetContent></Sheet>
    </header>
    <section className="voice-stage" aria-label="Voice conversation">
      <p className="eyebrow">ON HAND FOR YOU</p>
      <h1>Keep Going.<br/><span>I Gotcha.</span></h1>
      <div className="voice-controls"><p className="voice-status" role="status"><span className={`status-dot ${active?'is-live':''}`}/>{status}</p>
      {signedIn ? <Button className={`talk-button ${active?'is-active':''}`} disabled={pending} onClick={toggle}>{active ? <Square size={18} fill="currentColor"/> : <Mic size={21}/>} {pending ? (active?'Ending…':'Connecting…') : active?'End conversation':'Talk to Lindsay'}</Button> : <a className="sign-in talk-button" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in to talk <ArrowUpRight size={18}/></a>}
      <p className="voice-hint">{active?'Speak naturally. You can interrupt anytime.':'One tap to connect. No chat box required.'}</p>
      {audioBlocked && <Button variant="outline" onClick={()=>session.current?.resumeAudio()}>Enable speaker audio</Button>}
      <p className="notice" role="alert">{notice}</p><p className="saved-note" role="status">{saved ? `Saved · ${saved}`:''}</p></div>
    </section>
    <div className="update-access">{signedIn && <OrganizerUpdate onSaved={entry=>{session.current?.organizerUpdated(entry);setSaved('Organizer update');void loadEntries().catch(()=>{});}}/>}</div>
    <footer className="context-footer"><div><span className="eyebrow">Audio Pilot Productions</span><p>Sample event · fictional runbook</p></div><div className="source-caption">Runbook + your notes<br/><span>Tinkerers · checked when you ask</span></div></footer>
  </main>;
}
