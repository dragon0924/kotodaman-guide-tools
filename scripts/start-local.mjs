import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const standalone=path.join(root,'.next/standalone');
for(const [from,to]of [['.next/static','.next/static'],['public','public']])await fs.cp(path.join(root,from),path.join(standalone,to),{recursive:true});
const child=spawn(process.execPath,[path.join(standalone,'server.js')],{cwd:standalone,env:{...process.env,HOSTNAME:'127.0.0.1',NODE_ENV:'production'},stdio:'inherit',windowsHide:true});
child.on('exit',code=>{process.exitCode=code??1;});
