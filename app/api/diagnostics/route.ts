import {authorize,body,db,failure,json} from '@/lib/server';
import {z} from 'zod';
const numeric=z.number().finite().min(0).max(1e12).nullable();
const diagnostic=z.object({
  model:z.enum(['gpt-live-1','gpt-5.6-terra','gpt-5.6-luna']).nullable(),model_inferred:z.boolean(),
  endpoint:z.enum(['/v1/live/sessions','/v1/responses','unknown']),transport:z.enum(['live_event','http']),
  http_status:numeric,http_status_inferred:z.boolean(),error_code:z.enum(['rate_limit_exceeded','insufficient_quota','invalid_request_error','server_error','api_error','response_failed','rate_limit_error','request_too_large','model_not_found','invalid_api_key','timeout','unknown_error']).nullable(),
  rate_limit_unit:z.enum(['tokens_per_minute','requests_per_minute','requests_per_day','concurrent_requests','unknown']),limit_value:numeric,used_value:numeric,requested_value:numeric,rate_limited:z.boolean(),quota_exhausted:z.boolean(),retry_after_ms:numeric,limit_tokens:numeric,used_tokens:numeric,requested_tokens:numeric,
  limit_requests:numeric,remaining_requests:numeric,remaining_tokens:numeric,input_tokens:numeric,output_tokens:numeric,cached_tokens:numeric,voice_seconds:numeric,
}).strict();
export async function POST(request:Request){try{
  const user=await authorize(request);const data=z.object({session_id:z.string().max(200),diagnostic}).strict().parse(await body(request,4000));
  const session=await db().prepare('SELECT id FROM live_sessions WHERE id=? AND user_id=? AND expires_at>?').bind(data.session_id,user,Date.now()).first();
  if(!session)return json({ok:false},403);
  // Schema is an allowlist. Never log the request, headers, IDs, free text or arguments.
  console.info(JSON.stringify({event:'voice_diagnostic',at:new Date().toISOString(),...data.diagnostic}));
  return json({ok:true});
}catch(error){return failure(error);}}
