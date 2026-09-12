/* eslint-disable @typescript-eslint/no-explicit-any -- Untrusted MCP envelopes are projected through explicit field validators. */
// Server-only client for AI Tinkerers' official MCP. No browser credentials.
export const mcpEndpoint='https://aitinkerers.org/api/agents/mcp/v1';
const meetup='mu_demo_event',hackathon='h_demo_event';
const slug='demo-hackathon';
const allowed=new Set(['rsvp_summary','hackathon_team_search','global_hackathon_cities_list','rsvp_search']);
type Json=Record<string,any>; // External envelopes are validated before projection.
export class ConnectorError extends Error {
  code:string;retryMs:number|null;status:number|null;
  constructor(code:string,retryMs:number|null=null,status:number|null=null){super(code);this.code=code;this.retryMs=retryMs;this.status=status;}
}
const integer=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=0;
const safeName=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=160?v.trim():null;
export function attendanceValue(data:Json){
  if(!integer(data.total_count)||data.group_by!=='status'||!Array.isArray(data.groups)||data.filters?.meetup_token!==meetup)throw new ConnectorError('invalid_data');
  const counts:Record<string,number>={};let total=0;
  for(const row of data.groups){if(typeof row.key!=='string'||!/^[a-z_]{1,50}$/.test(row.key)||!integer(row.count)||row.key in counts)throw new ConnectorError('invalid_data');counts[row.key]=row.count;total+=row.count;}
  if(total!==data.total_count)throw new ConnectorError('incomplete_data');
  return {attending:counts.attending||0,waitlisted:counts.waitlisted||0,cancelled:Object.entries(counts).filter(([k])=>k==='cancelled'||k.startsWith('cancelled_')).reduce((n,[,v])=>n+v,0),pending:counts.pending??null,method:'Official MCP aggregate RSVP counts; no attendee rows retrieved.'};
}
export function teamValues(data:Json){
  if(!Array.isArray(data.teams)||data.truncated!==false||data.filters?.hackathon_token!==hackathon)throw new ConnectorError('incomplete_data');
  const teams=data.teams.map((t:Json)=>{
    if(t.hackathon?.hackathon_token!==hackathon||t.team_type!=='participant'||!safeName(t.name)||!integer(t.accepted_members_count)||typeof t.entry?.present!=='boolean'||typeof t.entry?.finalized!=='boolean')throw new ConnectorError('invalid_data');
    return {name:safeName(t.name),members:t.accepted_members_count,submission:t.entry.finalized?'submitted':t.entry.present?'draft':'not_started'};
  });
  return {teams:{count:teams.length,teams},submissions:{total_submitted:teams.filter((t:Json)=>t.submission==='submitted').length,drafts:teams.filter((t:Json)=>t.submission==='draft').length,not_started:teams.filter((t:Json)=>t.submission==='not_started').length,teams:teams.map(({name,submission}:Json)=>({name,status:submission})),coverage:'All participant teams returned by the official MCP; special-role teams excluded.'}};
}
export function deadlineValue(data:Json){
  if(!Array.isArray(data.cities)||data.truncated!==false)throw new ConnectorError('incomplete_data');
  const matches=data.cities.filter((c:Json)=>c.hackathon_token===hackathon&&c.meetup_token===meetup);
  const value=matches[0]?.hackathon_fields?.project_submission_deadline;
  if(matches.length!==1||typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw new ConnectorError('invalid_data');
  return {portal_deadline:new Date(value).toISOString(),timezone:'America/Los_Angeles',operational_target:'Latest HQ guidance: submit approximately 3:30–4 PM PDT before local show-and-tell. This is separate from the portal cutoff; disclose the difference.'};
}
export function createTinkerersClient(key:string,fetcher:typeof fetch=fetch){
  let session:string|null=null,protocol='2025-03-26',seq=0;
  const budget=AbortSignal.timeout(10000);
  async function rpc(method:string,params:Json,notification=false){
    const r=await fetcher(mcpEndpoint,{method:'POST',redirect:'manual',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(session?{'Mcp-Session-Id':session,'MCP-Protocol-Version':protocol}:{})},body:JSON.stringify({jsonrpc:'2.0',...(notification?{}:{id:++seq}),method,params}),signal:budget});
    const retry=r.headers.get('Retry-After');let retryMs=retry===null?null:Number.isFinite(Number(retry))?Math.max(0,Number(retry)*1000):Math.max(0,Date.parse(retry)-Date.now());if(!Number.isFinite(retryMs))retryMs=null;
    if(!r.ok)throw new ConnectorError(r.status===401?'auth_expired':r.status===403?'access_denied':r.status===429?'rate_limited':'unavailable',retryMs,r.status);
    session=r.headers.get('Mcp-Session-Id')||session;
    if(notification){await r.body?.cancel();return null;}
    const reader=r.body?.getReader();if(!reader)throw new ConnectorError('invalid_data');let text='',bytes=0;
    const decoder=new TextDecoder();while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.length;if(bytes>750000){await reader.cancel();throw new ConnectorError('response_too_large');}text+=decoder.decode(item.value,{stream:true});}text+=decoder.decode();
    let envelope;try{envelope=r.headers.get('content-type')?.includes('text/event-stream')?text.split(/\r?\n\r?\n/).map(block=>block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n')).filter(Boolean).map(s=>JSON.parse(s)).find(e=>e.id===seq):JSON.parse(text);}catch{throw new ConnectorError('invalid_data');}
    if(!envelope||envelope.id!==seq||envelope.error)throw new ConnectorError('mcp_error');return envelope.result;
  }
  return {
    async initialize(){const result=await rpc('initialize',{protocolVersion:protocol,capabilities:{},clientInfo:{name:'hey-lindsay',version:'0.1.0'}});if(!result?.protocolVersion)throw new ConnectorError('invalid_data');protocol=result.protocolVersion;await rpc('notifications/initialized',{},true);},
    async read(name:string,offset=0){
      if(!allowed.has(name))throw new ConnectorError('tool_not_allowed');
      if(name==='rsvp_search'&&(!Number.isInteger(offset)||offset<0||offset>95))throw new ConnectorError('invalid_offset');
      const args=name==='rsvp_search'?{meetup_token:meetup,status:'attending',limit:5,offset}:name==='rsvp_summary'?{meetup_token:meetup,group_by:'status',limit:20}:name==='hackathon_team_search'?{hackathon_token:hackathon,team_type:'participant',include_deleted:false,limit:100}:{hackathon_slug:slug,query:'Coachella',limit:5};
      const out=await rpc('tools/call',{name,arguments:args});if(out?.isError)throw new ConnectorError('tool_error');
      let data=out?.structuredContent;try{if(!data)data=JSON.parse(out?.content?.find((c:Json)=>c.type==='text')?.text);}catch{throw new ConnectorError('invalid_data');}
      if(data?.ok!==true||!data.data)throw new ConnectorError('tool_error');return data.data;
    }
  };
}
