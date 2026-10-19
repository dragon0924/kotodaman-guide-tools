import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {validateArticleFile,normalizeArticleFile,normalizeArticleBlock} from '../lib/articleStore.ts';
import {isPublicArticle} from '../lib/articleEvents.ts';
import {articleCharacterIds,articleImageSources,legacyBlockDocument,richTextPlain} from '../lib/articleRichText.ts';
import {buildTraitSearchIndex,indexTraitSearchEvidence,matchesTraitSearch} from '../lib/traitSearch.ts';
import {questInputIssues} from '../lib/questArticle.ts';
import {selectHomeEvents} from '../lib/homeEvents.ts';
import type {CharacterRecord,Article} from '../lib/types';
const read=async(name:string)=>JSON.parse(await readFile('data/'+name,'utf8'));
test('the sample articles validate without importing private real data',async()=>{
 const data=await read('characters.json'),file=await read('articles.json');const ids=new Set<string>(data.characters.map((c:CharacterRecord)=>c.id));
 assert.equal(ids.size,24);assert.doesNotThrow(()=>validateArticleFile(file,ids));
 for(const a of file.articles){for(const id of articleCharacterIds(a))assert.ok(ids.has(id));for(const src of articleImageSources(a))assert.ok(src.startsWith('/images/demo/'));}
 assert.equal(file.articles.filter(isPublicArticle).length,2);assert.equal(isPublicArticle(file.articles.find((a:Article)=>a.id==='demo-private-draft')),false);
 const quest=file.articles.find((a:Article)=>a.id==='demo-quest').quest;assert.equal(quest.waves.length,2);assert.deepEqual(questInputIssues(quest).filter(i=>i.severity==='error'),[]);
});
test('the synthetic dataset exercises named AND and OR without crossing trait sources',async()=>{
 const {characters}=await read('characters.json');const index=indexTraitSearchEvidence(buildTraitSearchIndex(characters,[],[]));
 const all=[...index.values()];assert.equal(all.filter(e=>matchesTraitSearch(e,['看破','応援'],[],'and')).length,2);
 assert.equal(all.filter(e=>matchesTraitSearch(e,['blessing:看破'])).length,0);
 assert.ok(all.some(e=>matchesTraitSearch(e,['牽制'])));assert.ok(all.some(e=>matchesTraitSearch(e,['援護'])));
 assert.ok(all.some(e=>matchesTraitSearch(e,['blessing:モード・シフト'])));
});
test('public content never contains the synthetic draft or its marker',async()=>{
 const bytes=await readFile('content/public/data/articles.json','utf8');const file=JSON.parse(bytes);
 assert.equal(file.articles.length,2);assert.ok(file.articles.every(isPublicArticle));assert.ok(!bytes.includes('PRIVATE_DEMO_DRAFT_SENTINEL'));
});
test('legacy paragraph normalization remains non-destructive using a synthetic fixture',()=>{
 const block=normalizeArticleBlock({id:'legacy',type:'paragraph',content:'独自の本文\n次の行'});const before=structuredClone(block);
 assert.equal(richTextPlain(legacyBlockDocument(block)),block.content);assert.deepEqual(block,before);
 const file=normalizeArticleFile({articles:[{id:'legacy-article',title:'架空',type:'beginner_guide',status:'draft',sections:[{id:'s',heading:'本文',blocks:[block]}]}]});assert.deepEqual(file.articles[0].sections[0].blocks[0],block);
});
test('public home events use sample schedules and exclude the draft',async()=>{
 const {articles}=await read('articles.json');const cards=selectHomeEvents(articles,new Date('2026-10-19T12:00:00+09:00'));
 assert.deepEqual(cards.map(c=>c.articleId),['demo-event']);assert.equal(cards[0].name,'ポートフォリオ・サンプルイベント');
});
