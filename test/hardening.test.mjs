import test from 'node:test';
import assert from 'node:assert/strict';
import {safeDiagnostic,retryAfterMs} from '../lib/diagnostics.js';
import {createCooldown} from '../lib/rate-limits.js';
import {createToolBridge} from '../lib/live-bridge.js';

test('diagnostics identify wrapped Terra TPM without retaining free text',()=>{
 const secret='NEVER_LOG_PRIVATE_CONTENT';
 const d=safeDiagnostic({type:'error',error:{type:'invalid_request_error',message:`${secret}: 429 Rate limit reached for gpt-5.6-terra on tokens per min (TPM): Limit 10000, Used 8872, Requested 3495. Please try again in 14.202s.`}});
 assert.equal(d.model,'gpt-5.6-terra');assert.equal(d.rate_limit_unit,'tokens_per_minute');assert.equal(d.retry_after_ms,14202);assert.equal(d.limit_tokens,10000);assert(!JSON.stringify(d).includes(secret));
});
test('request limits are not mislabelled token limits; quota is not retryable',()=>{
 const d=safeDiagnostic({type:'error',error:{code:'rate_limit_exceeded',message:'gpt-5.6-terra requests per min (RPM): Limit 3, Used 3, Requested 1. Try again in 20s.'}});
 assert.equal(d.rate_limit_unit,'requests_per_minute');assert.equal(d.limit_value,3);assert.equal(d.limit_tokens,null);
 const quota=safeDiagnostic({error:{code:'insufficient_quota'}},'gpt-5.6-luna',null,429);assert.equal(quota.quota_exhausted,true);assert.equal(quota.rate_limited,false);
});
test('Retry-After supports seconds and dates and is never shortened',()=>{
 assert.equal(retryAfterMs('1.5'),1500);assert.equal(retryAfterMs('Thu, 01 Jan 1970 00:02:00 GMT',0),120000);
 let now=0;const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const gate=createCooldown({now:()=>now,random:()=>0,storage});assert(gate.hit('luna',300000)>=300000);
 now=1000;assert(gate.hit('luna',1000)>=299000);
 const restored=createCooldown({now:()=>now,random:()=>0,storage});assert.equal(restored.remaining('luna'),gate.remaining('luna'));
 const b=createCooldown({now:()=>now,random:()=>0});const first=b.hit('terra');now+=20000;assert(b.hit('terra')>first);
});
test('failed response does not continue or execute incomplete function calls',async()=>{
 const sent=[];let executed=0;const bridge=createToolBridge({send:e=>sent.push(e),execute:async()=>{executed++;},blocked:()=>true});
 await bridge.receive({type:'response.event',delegation_id:'d',event:{type:'response.created',response:{id:'r'}}});
 await bridge.receive({type:'response.event',delegation_id:'d',event:{type:'response.output_item.done',item:{type:'function_call',call_id:'c',name:'save',arguments:'{}'}}});
 await bridge.receive({type:'response.event',delegation_id:'d',event:{type:'response.failed',response:{id:'r'}}});
 assert.equal(executed,0);assert.deepEqual(sent,[]);
});
test('cooldown blocks writes and continuation; duplicate completed events do not replay saves',async()=>{
 const sent=[];let executed=0,blocked=false;const bridge=createToolBridge({send:e=>sent.push(e),execute:async()=>{executed++;return{ok:true};},blocked:()=>blocked});
 async function run(id,call){await bridge.receive({type:'response.event',delegation_id:'d',event:{type:'response.created',response:{id}}});await bridge.receive({type:'response.event',delegation_id:'d',event:{type:'response.output_item.done',item:{type:'function_call',call_id:call,name:'save',arguments:'{}'}}});await bridge.receive({type:'response.event',delegation_id:'d',event:{type:'response.completed',response:{id}}});}
 await run('r','c');await run('r2','c');assert.equal(executed,1);
 blocked=true;const start=sent.length;await run('r3','new');assert.equal(executed,1);assert.equal(sent.slice(start).filter(e=>e.type==='response.create').length,0);
 assert.equal(JSON.parse(sent.at(-1).item.output).ok,false);
});
