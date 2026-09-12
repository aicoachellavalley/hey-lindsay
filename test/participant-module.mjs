import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=readFileSync(new URL('../lib/participants.ts',import.meta.url),'utf8').replace("'./tinkerers-mcp'",JSON.stringify(new URL('../lib/tinkerers-mcp.ts',import.meta.url).href));
export const participants=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
