import test from 'node:test';
import assert from 'node:assert/strict';
import {attendanceValue,teamValues,deadlineValue,createTinkerersClient} from '../lib/tinkerers-mcp.ts';
test('attendance uses complete aggregate counts and rejects partial or wrong-event data',()=>{
 const d={total_count:24,group_by:'status',groups:[{key:'attending',count:19},{key:'waitlisted',count:2},{key:'cancelled_by_user',count:3}],filters:{meetup_token:'mu_demo_event'},private_extra:'must not escape'};
 assert.equal(attendanceValue(d).attending,19);assert.equal(attendanceValue(d).cancelled,3);assert(!JSON.stringify(attendanceValue(d)).includes('must not escape'));
 assert.throws(()=>attendanceValue({...d,total_count:25}));assert.throws(()=>attendanceValue({...d,filters:{meetup_token:'wrong'}}));
});
test('team projection retains only operational fields; partial lists cannot become totals',()=>{
 const d={truncated:false,filters:{hackathon_token:'h_demo_event'},teams:[{name:'Synthetic team',team_type:'participant',accepted_members_count:2,hackathon:{hackathon_token:'h_demo_event'},entry:{present:true,finalized:true},email:'private@example.invalid',message_board:{token:'private'}}]};
 const out=teamValues(d);assert.equal(out.submissions.total_submitted,1);assert(!JSON.stringify(out).includes('private'));
 assert.throws(()=>teamValues({...d,truncated:true}));
});
test('deadline targets the exact local event and preserves the separate HQ target',()=>{
 const d={truncated:false,cities:[{hackathon_token:'h_demo_event',meetup_token:'mu_demo_event',hackathon_fields:{project_submission_deadline:'2026-09-13T00:00:00Z',handbook_markdown:'unneeded'}}]};
 assert.equal(deadlineValue(d).portal_deadline,'2026-09-13T00:00:00.000Z');assert(!JSON.stringify(deadlineValue(d)).includes('unneeded'));
 assert.throws(()=>deadlineValue({...d,cities:[]}));
});
test('MCP auth and rate errors are safe, respect Retry-After, and never auto-retry',async()=>{
 for(const status of [401,429]){let requests=0;const c=createTinkerersClient('synthetic-secret',async()=>{requests++;return new Response('sensitive raw error',{status,headers:{'Retry-After':'20'}});});
 await assert.rejects(()=>c.initialize(),e=>e.status===status&&e.retryMs===20000&&!e.message.includes('sensitive'));assert.equal(requests,1);}
 const c=createTinkerersClient('synthetic-secret',async()=>{throw Error('Should not fetch');});await assert.rejects(()=>c.read('rsvp_mark_cancelled'),/tool_not_allowed/);
});
