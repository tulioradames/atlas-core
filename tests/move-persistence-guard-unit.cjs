const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../js/v2.js'),'utf8');
const code=src.slice(src.indexOf('  async function assertMoveRecordsPersisted('),src.indexOf('  async function submitCrossBoardMove('));
function setup(groups,items,error=null,pending=[]){
 const queries=[];
 const c=vm.createContext({runtime:{itemPersistQueues:new Map(pending.map((p,i)=>[i,p])),authClient:{from(table){
 const q={select(){return q},eq(){return q},in(){return q},then(resolve,reject){queries.push(table);return Promise.resolve({data:table==='atlas_v2_groups'?groups:items,error}).then(resolve,reject)}};return q;
 }}}});
 vm.runInContext(code+'\nthis.check=assertMoveRecordsPersisted;',c);return {check:c.check,queries};
}
(async()=>{
 let h=setup([],[]);await assert.rejects(h.check(['i'],'b','g'),/setor de destino/);assert.equal(h.queries.length,1);
 h=setup([{id:'g'}],[]);await assert.rejects(h.check(['i'],'b','g'),/elementos ainda/);
 h=setup([{id:'g'}],[{id:'i'}]);await h.check(['i','i'],'b','g');
 h=setup([],[],null,[Promise.resolve(false)]);await assert.rejects(h.check(['i'],'b','g'),/não foram salvas/);assert.equal(h.queries.length,0);
 h=setup([],[],null,[Promise.reject(new Error('save'))]);await assert.rejects(h.check(['i'],'b','g'),/não foram salvas/);
 h=setup([],[],new Error('network'));await assert.rejects(h.check(['i'],'b','g'),/network/);
 const recovery=src.slice(src.indexOf('  function preserveUnsyncedRecovery('),src.indexOf('  function persistLocalBackup('));
 let stored,fail=false;
 const c=vm.createContext({runtime:{data:{items:['pending']},authSession:{user:{id:'u'}}},STORAGE_KEY:'test',console:{warn(){}},
 localBackupSnapshot:(data,structure)=>{assert.equal(structure,false);return data;},
 localStorage:{setItem:(key,value)=>{if(fail)throw Error('quota');stored={key,value};}}});
 vm.runInContext(recovery+'\nthis.save=preserveUnsyncedRecovery;',c);
 assert.equal(c.save(),true);assert.deepEqual(JSON.parse(stored.value).data,{items:['pending']});
 fail=true;const before=stored;assert.equal(c.save(),false);assert.equal(stored,before);
 assert.equal((src.match(/await assertMoveRecordsPersisted\(/g)||[]).length,2);
 console.log('PASS move preflight and unsynced recovery: missing destination/item, failed saves, network error, success and storage quota');
})().catch(e=>{console.error(e);process.exitCode=1});

