import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'.env.local');
await fs.writeFile(file,'ADMIN_PASSWORD='+randomBytes(32).toString('hex')+'\nSITE_MODE=local-admin\n',{flag:'wx',mode:0o600});
console.log('Created an ignored .env.local without printing its secret. Open it locally to use the editor. Existing settings are never overwritten.');
