import { authorize, failure, json, readEntries } from '@/lib/server';
export async function GET(request:Request) { try{return json(await readEntries(await authorize(request)));}catch(error){return failure(error);} }
