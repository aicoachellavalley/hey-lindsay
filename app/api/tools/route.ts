import {authorize,body,db,executeTool,failure,json} from '@/lib/server';
import {z} from 'zod';
export async function POST(request:Request){
  try{
    const user=await authorize(request);
    const {session_id,call_id,name,args}=z.object({session_id:z.string().min(1).max(200),call_id:z.string().min(1).max(200),name:z.string().max(100),args:z.unknown()}).strict().parse(await body(request,6000));
    const session=await db().prepare('SELECT id FROM live_sessions WHERE id=? AND user_id=? AND expires_at>?').bind(session_id,user,Date.now()).first();
    if(!session)return json({ok:false,error:'Your conversation ended. Reconnect before saving.'},403);
    return json(await executeTool(user,session_id,call_id,name,args));
  }catch(error){return failure(error);}
}
