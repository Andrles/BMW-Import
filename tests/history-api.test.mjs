import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
test('history survives damage; backup restore validates and preserves existing data',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bmw-api-test-'));
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,BMW_PORT:'0',BMW_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 try{
 const line=await Promise.race([once(child.stdout,'data').then(([b])=>b.toString()),once(child,'exit').then(()=>{throw Error('Server failed to start');})]);
 const address=line.match(/http:\/\/127.0.0.1:(\d+)/)?.[0];assert.ok(address);
 const req=async(url,options)=>{const r=await fetch(address+url,options);return [r.status,await r.json()];};
 const post=(url,b)=>req(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
 const input={vehicleType:'passenger',drive:'rwd',calcDate:'2026-10-06',productionDate:'2024-02-01',productionPrecision:'month',type:'petrol',cc:'1998',kw:'135',hp:'184',price:'200000',buyRate:'12',cny:'12',eur:'100',rateDate:'2026-10-03',rateCheckedDate:'2026-10-06',rateState:'cbr',confirmSpecs:true,vehicleName:'BMW test',customsOverride:''};
 const [status,q]=await post('/api/quotes',{input,company:{name:'Test'}});assert.equal(status,201);assert.equal(q.appVersion,'0.6.0');
 await writeFile(path.join(dir,'quotes','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json'),'{bad');
 const [hs,history]=await req('/api/quotes');assert.equal(hs,200);assert.equal(history.length,1);
 assert.equal((await req('/api/history/warnings'))[1].length,1);
 const [,backup]=await req('/api/backup');assert.equal(backup.damagedFiles.length,1);
 assert.equal((await post('/api/backup/import',backup))[0],409);
 const original=await readFile(path.join(dir,'quotes',q.id+'.json'),'utf8');assert.equal(JSON.parse(original).id,q.id);
 assert.equal((await req('/api/quotes/'+q.id,{method:'DELETE'}))[0],200);
 assert.equal((await req('/api/quotes'))[1].length,0);
 assert.equal((await post('/api/quotes/'+q.id+'/restore',{}))[0],200);
 const newid='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 assert.equal((await post('/api/backup/import',{...backup,quotes:[{...q,id:newid}],damagedFiles:[]}))[0],200);
 assert.equal((await req('/api/quotes'))[1].length,2);
 assert.equal((await post('/api/backup/import',{...backup,quotes:[{...q,id:'../../escape'}]}))[0],400);
 assert.equal((await post('/api/quotes',{input:{...input,model:'x2-u10-m35',productionDate:'2020-01-01'},company:{}}))[0],400);
 assert.equal((await post('/api/quotes',{input:{...input,productionDate:'2023-10-01'},company:{}}))[0],400);
 }finally{child.kill();await once(child,'exit');await rm(dir,{recursive:true,force:true});}
});
