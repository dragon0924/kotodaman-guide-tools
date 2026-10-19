import assert from "node:assert/strict";
import test from "node:test";
import { displayMoveConditions, normalizeKotowaza } from "../lib/moveConditions.ts";
import { meaningfulTraitLines, partitionDisplayTraits, leaderInformationState, statusDisplayEntries } from "../lib/characterDetailDisplay.ts";
import { supplementTraitMatchIndex, type SupplementalTraitFile } from "../lib/newCharacterTraitMatches.ts";
import type { CharacterRecord, TraitTemplate } from "../lib/types";
const c: CharacterRecord={id:"new",name:"新",attribute:"火",letters:["あ"],gimmicks:[],rating:"",sourceUrl:"",updatedAt:"",traitsRaw:["通常の原文"],blessingTraitsRaw:["祝福の原文"]};
const templates: TraitTemplate[]=[{id:"normal",name:"通常分類",template:"通常の原文",params:[],sourceType:"trait",isActive:true},{id:"blessing",name:"祝福分類",template:"祝福の原文",params:[],sourceType:"blessingTrait",isActive:true}];
test("legacy OR at line boundaries is joined once; original condition and effect stay intact",()=>{
 const condition='【「さい・こう」を含む4文字以上 or\n「さ・い・こ」から始まる4文字以上 or\n「さ・い・こ」で終わる4文字以上】';
 const before={level:4,condition,effect:"味方を強化 or 敵に攻撃"};
 assert.equal(displayMoveConditions([],condition).join(" or "),'「さい・こう」を含む4文字以上 or 「さ・い・こ」から始まる4文字以上 or 「さ・い・こ」で終わる4文字以上');
 assert.equal(normalizeKotowaza([before])[0].condition,condition);assert.equal(normalizeKotowaza([before])[0].effect,before.effect);
 assert.equal(displayMoveConditions([],"A\nor B").join(" or "),"A or B");
 assert.equal(displayMoveConditions([],"A\nor\nB").join(" or "),"A or B");
 assert.deepEqual(displayMoveConditions([],"【テーマ「science or art」の言葉】"),['テーマ「science or art」の言葉']);
 assert.deepEqual(displayMoveConditions([],"【4文字以上】\n【2文字以上10コンボ以上】"),["4文字以上","2文字以上10コンボ以上"]);
 assert.deepEqual(displayMoveConditions([],"条件：4文字以上\n条件：2文字以上10コンボ以上"),["4文字以上","2文字以上10コンボ以上"]);
 assert.deepEqual(displayMoveConditions([{type:"minLetters",count:4}],"4文字以上"),["4文字以上"]);
});
test("all known status values including an explicit zero are shown without filling absent values",()=>{
 assert.deepEqual(statusDisplayEntries(undefined),[]);
 assert.deepEqual(statusDisplayEntries({hp:1200,maxAtk:2000,blessedHp:0,raw:["レベル最大\t合計"]}),[{key:"hp",label:"HP",value:1200},{key:"maxAtk",label:"ATK（合計）",value:2000},{key:"blessedHp",label:"HP（祝福）",value:0}]);
 assert.equal(statusDisplayEntries({atk:NaN}).length,0);
});
test("empty blessings are hidden and typed blessings do not appear in normal traits",()=>{
 assert.deepEqual(meaningfulTraitLines(["なし","効果","祝福とくせいなし"]),[]);
 const original=JSON.stringify(c);const result=partitionDisplayTraits({...c,traits:[{templateId:"blessing",values:{}}]},templates);
 assert.deepEqual(result.renderedTraits,["通常の原文"]);assert.deepEqual(result.renderedBlessingTraits,["祝福の原文"]);assert.equal(JSON.stringify(c),original);
 assert.deepEqual(meaningfulTraitLines(["複数効果の原文①","複数効果の原文②"]),["複数効果の原文①","複数効果の原文②"]);
});
test("leader text availability is independent of classification",()=>{
 assert.equal(leaderInformationState({}),"missing");assert.equal(leaderInformationState({leaderTraitText:"原文"}),"text_only");assert.equal(leaderInformationState({leaderTraits:["毒耐性"]}),"classified");
});
const file: SupplementalTraitFile={meta:{characterIds:["new"]},matches:[{characterId:"new",characterName:"新",sourceType:"trait",rawText:"通常の原文",matchedTemplateId:"normal",matchedTemplateName:"通常分類",confidence:"high",status:"matched"},{characterId:"new",characterName:"新",sourceType:"blessingTrait",rawText:"祝福の原文",matchedTemplateId:"blessing",matchedTemplateName:"祝福分類",confidence:"high",status:"matched"}]};
test("new trait supplementation preserves legacy IDs and separates normal and blessing sources",()=>{
 const legacy=new Map([["old",{ids:["old-tag"],names:["既存"]}]]);const before=JSON.stringify([...legacy]);const result=supplementTraitMatchIndex(legacy,file,[c],templates);
 assert.deepEqual(result.get("new")?.ids,["normal","blessing"]);assert.deepEqual(result.get("old"),legacy.get("old"));assert.equal(JSON.stringify([...legacy]),before);
});
test("stale, wrong-source, unscoped, inactive, and unconfirmed matches cannot enter search",()=>{
 assert.equal(supplementTraitMatchIndex(new Map(),file,[{...c,traitsRaw:[],blessingTraitsRaw:[]}],templates).size,0);
 assert.equal(supplementTraitMatchIndex(new Map(),{...file,meta:{characterIds:[]}},[c],templates).size,0);
 assert.equal(supplementTraitMatchIndex(new Map(),file,[c],templates.map(t=>({...t,isActive:false}))).size,0);
 const unconfirmed={...file,matches:file.matches.map(m=>({...m,confidence:"medium"}))} as unknown as SupplementalTraitFile;assert.equal(supplementTraitMatchIndex(new Map(),unconfirmed,[c],templates).size,0);
 const wrong={...file,matches:file.matches.map(m=>({...m,sourceType:"blessingTrait" as const,rawText:"祝福の原文",matchedTemplateId:"normal"}))};assert.equal(supplementTraitMatchIndex(new Map(),wrong,[c],templates).size,0);
});
