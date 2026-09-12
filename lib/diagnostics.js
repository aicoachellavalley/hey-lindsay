const models=['gpt-live-1','gpt-5.6-terra','gpt-5.6-luna'];
const codes=['rate_limit_exceeded','insufficient_quota','invalid_request_error','server_error','api_error','response_failed','rate_limit_error','request_too_large','model_not_found','invalid_api_key','timeout','unknown_error'];
const number=v=>{const n=Number(v);return v!==null&&v!==undefined&&Number.isFinite(n)&&n>=0?n:null;};
export function retryAfterMs(value,now=Date.now()) {
  if(value===null||value===undefined||value==='')return null;
  const seconds=Number(value);if(Number.isFinite(seconds)&&seconds>=0)return Math.ceil(seconds*1000);
  const date=Date.parse(value);return Number.isFinite(date)?Math.max(0,date-now):null;
}
/** @param {object} envelope @param {string} [backend] @param {{get:(key:string)=>string|null}|null} [headers] @param {number|null} [httpStatus] */
export function safeDiagnostic(envelope,backend='gpt-5.6-terra',headers=null,httpStatus=null) {
  const event=envelope?.type==='response.event'?envelope.event:envelope||{};
  const error=event.error||event.response?.error||{};
  // Inspect free text only in memory; never return or log it.
  const message=String(error.message||'');
  const explicit=models.find(m=>error.model===m||event.response?.model===m||message.includes(m));
  const model=explicit||(envelope?.type==='response.event'?backend:null);
  const quota=error.code==='insufficient_quota'||/insufficient_quota|current quota|billing quota|no balance|run out of credits/i.test(message);
  const limited=!quota&&(error.code==='rate_limit_exceeded'||/rate.?limit|tokens per min|requests per min|\b429\b/i.test(message)||httpStatus===429);
  const get=k=>headers?.get?.(k)??error.headers?.[k]??null;
  let retry=retryAfterMs(get('retry-after')??error.retry_after??error.retry_after_seconds);
  if(retry===null){const match=message.match(/try again in\s+([\d.]+)\s*(ms|s|seconds?|minutes?)/i);if(match)retry=Number(match[1])*(match[2]==='ms'?1:/^m/i.test(match[2])?60000:1000);}
  const unit=/tokens per min|\bTPM\b/i.test(message)?'tokens_per_minute':/requests per min|\bRPM\b/i.test(message)?'requests_per_minute':/requests per day|\bRPD\b/i.test(message)?'requests_per_day':/concurren/i.test(message)?'concurrent_requests':'unknown';
  const usage=event.response?.usage||event.usage||{};
  const matchNumber=pattern=>number(message.match(pattern)?.[1]?.replaceAll(',',''));
  return {model:models.includes(model)?model:null,model_inferred:!explicit&&!!model,
    endpoint: model==='gpt-live-1'?'/v1/live/sessions':model?'/v1/responses':'unknown',
    transport:envelope?.type==='response.event'||envelope?.type==='error'?'live_event':'http',
    http_status:httpStatus??(limited||quota?429:null),http_status_inferred:httpStatus===null&&(limited||quota),
    error_code:quota?'insufficient_quota':codes.includes(error.code)?error.code:codes.includes(error.type)?error.type:error.message?'unknown_error':null,
    rate_limited:limited,quota_exhausted:quota,retry_after_ms:retry,
    rate_limit_unit:unit,limit_value:matchNumber(/Limit[:\s]+([\d,]+)/i),used_value:matchNumber(/Used[:\s]+([\d,]+)/i),requested_value:matchNumber(/Requested[:\s]+([\d,]+)/i),
    limit_tokens:number(get('x-ratelimit-limit-tokens'))??(unit==='tokens_per_minute'?matchNumber(/Limit[:\s]+([\d,]+)/i):null),
    used_tokens:unit==='tokens_per_minute'?matchNumber(/Used[:\s]+([\d,]+)/i):null,requested_tokens:unit==='tokens_per_minute'?matchNumber(/Requested[:\s]+([\d,]+)/i):null,
    limit_requests:number(get('x-ratelimit-limit-requests')),remaining_requests:number(get('x-ratelimit-remaining-requests')),
    remaining_tokens:number(get('x-ratelimit-remaining-tokens')),
    input_tokens:number(usage.input_tokens),output_tokens:number(usage.output_tokens),cached_tokens:number(usage.input_tokens_details?.cached_tokens),voice_seconds:number(usage.seconds),
  };
}
