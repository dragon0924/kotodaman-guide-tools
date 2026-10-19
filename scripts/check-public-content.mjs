import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const load=async f=>JSON.parse(await fs.readFile(path.join(root,f),'utf8'));
const manifest=await load('data/sample-manifest.json');
const characters=(await load('data/characters.json')).characters;
if(manifest.synthetic!==true||characters.length!==24||characters.some(c=>!manifest.characterIds.includes(c.id)||!c.name.startsWith('架空キャラ')||!c.sourceUrl.startsWith('https://example.com/portfolio/')))throw Error('Only the reviewed synthetic character fixtures are allowed in this portfolio snapshot.');
const articles=(await load('data/articles.json')).articles;
const publicArticles=(await load('content/public/data/articles.json')).articles;
if(articles.some(a=>!manifest.articleIds.includes(a.id))||publicArticles.some(a=>a.status!=='published'||a.id==='demo-private-draft')||publicArticles.length!==2)throw Error('Unexpected article or a private fixture reached the reader bundle.');
const ids=new Set(characters.map(c=>c.id));
function inspect(value,key=''){
  if(typeof value==='string'){
    if(/img\.gamewith\.jp|gamewith\.jp\/kotodaman\/article|kotodaman\.jp\/info|[A-Za-z]:[\\/]+Users[\\/]|-----BEGIN [A-Z ]*PRIVATE KEY|\b(?:gh[pousr]_|github_pat_)/.test(value))throw Error('Unexpected external dataset or private material in sample content.');
    if(key==='characterId'&&value&&!ids.has(value))throw Error('Unknown sample character link.');
    if((key==='src'||key==='imageUrl')&&!manifest.imagePaths.includes(value))throw Error('Unexpected image reference.');
    if((key==='characterIds'||key==='slots')&&value&&!ids.has(value))throw Error('Unknown sample character in a list.');
  }else if(Array.isArray(value))value.forEach(v=>inspect(v,key));else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>inspect(v,k));
}
for(const file of await fs.readdir(path.join(root,'data'))){if(file.endsWith('.json'))inspect(await load('data/'+file));}
inspect(publicArticles);
for(const file of manifest.imagePaths)await fs.access(path.join(root,'public',file.slice(1)));
const source=await fs.readFile(path.join(root,'content/public/data/articles.json'),'utf8');if(source.includes('PRIVATE_DEMO_DRAFT_SENTINEL'))throw Error('Draft fixture in public bundle.');
console.log('Public fixtures verified: 24 synthetic characters, 2 public samples, 8 original images; all references resolve.');
