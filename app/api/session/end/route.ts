import {authorize,body,db,failure,json} from '@/lib/server';
import {z} from 'zod';
export async function POST(request:Request){try{const user=await authorize(request);const {id}=z.object({id:z.string().max(200)}).strict().parse(await body(request,2000));await db().prepare('UPDATE live_sessions SET expires_at=0 WHERE id=? AND user_id=?').bind(id,user).run();return json({ok:true});}catch(error){return failure(error);}}
