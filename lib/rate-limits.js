export const temporaryLimitMessage='I hit a temporary service limit. Give me a moment and ask me again.';
export function createCooldown({now=()=>Date.now(),random=Math.random,storage=null}={}) {
  let states={};try{states=JSON.parse(storage?.getItem('hey-lindsay-cooldowns')||'{}');}catch{}
  return {
    remaining(model){return Math.max(0,(states[model]?.until||0)-now());},
    hit(model,retryMs=null){
      const old=states[model];const attempts=old&&now()-old.at<300000?old.attempts+1:1;
      const delay=retryMs!==null?Math.max(0,retryMs):Math.min(120000,15000*2**(attempts-1));
      const until=Math.max(old?.until||0,now()+delay+250+Math.floor(random()*250));
      states[model]={until,at:now(),attempts};try{storage?.setItem('hey-lindsay-cooldowns',JSON.stringify(states));}catch{}
      return until-now();
    },
  };
}
