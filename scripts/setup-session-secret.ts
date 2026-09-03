import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const put=(name:string)=>{const result=spawnSync('pnpm',['--filter','@brendon/admin','exec','wrangler','secret','put',name],{input:randomBytes(48).toString('base64')+'\n',stdio:['pipe','inherit','inherit'],shell:process.platform==='win32'});if(result.status!==0)throw new Error(`Could not store ${name}`)};
put('SESSION_SECRET');put('IP_HASH_SECRET');console.log('Session and privacy-protection secrets stored in Cloudflare.');
