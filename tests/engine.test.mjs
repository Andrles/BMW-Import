import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calculate,dutyRule,ages,number} from '../public/engine.mjs';
const rates=JSON.parse(await readFile(new URL('../public/rates.json',import.meta.url),'utf8'));
const base={vehicleType:'passenger',drive:'rwd',calcDate:'2026-09-22',productionDate:'2024-02-15',type:'petrol',cc:'1998',kw:'135',hp:'184',price:'200000',buyRate:'12',cny:'11',eur:'100',rateDate:'2026-09-22',confirmSpecs:true,preBorder:'120000',postBorder:'80000',documents:'65000',other:'0',service:'100000',customsOverride:''};
test('commercial BMW 325Li: separate purchase/CBR bases, VAT and total',()=>{const r=calculate(base,rates);assert.equal(r.customs,2320000);assert.equal(r.duty,348000);assert.equal(r.excise,112792);assert.equal(r.vat,611774.24);assert.equal(r.fee,13541);assert.equal(r.util,900000);assert.equal(r.total,4751107.24);assert.equal(r.rule.code,'8703231981');});
test('used petrol: percentage or minimum, old util',()=>{const r=calculate({...base,productionDate:'2021-01-01',price:'10000'},rates);assert.equal(r.rule.code,'8703239082');assert.equal(r.duty,87912);assert.equal(r.util,1492800);});
test('diesel 2L selects its own tariff minimum',()=>{const r=calculate({...base,type:'diesel',productionDate:'2021-01-01',price:'10000'},rates);assert.equal(r.rule.code,'8703329094');assert.equal(r.duty,79920);});
test('electric: no document number required, power still required',()=>{const i={...base,type:'electric',cc:'',kw:'100',hp:'135.96',powerEvidence:'СБКТС тест'};const r=calculate(i,rates);assert.equal(r.rule.code,'8703800003');assert.equal(r.util,1560000);assert.equal(r.duty,348000);assert.equal(r.excise,8701.44);assert.equal(calculate({...i,powerEvidence:''},rates).total,r.total);assert.equal(calculate({...i,powerEvidence:undefined},rates).total,r.total);assert.throws(()=>calculate({...i,kw:''},rates),/Мощность/);});
test('3-year boundary differs for tariff and recycling',()=>{const a=ages('2023-09-22','2026-09-22');assert.equal(a.used,true);assert.equal(a.utilOld,false);assert.equal(ages('2023-09-21','2026-09-22').utilOld,true);assert.equal(ages('2023-09-23','2026-09-22').used,false);});
test('5/7-year boundaries and specific duties',()=>{assert.equal(ages('2021-09-22','2026-09-22').over5,false);assert.equal(ages('2021-09-21','2026-09-22').over5,true);const a={used:true,over5:true,over7:true};assert.deepEqual(dutyRule('petrol',1998,a),{code:'8703239081',percent:0,minEur:2.2});});
test('new 3L sedan and qualified SUV use different duties',()=>{const age={used:false,over5:false,over7:false};assert.equal(dutyRule('petrol',2998,age).percent,12.5);assert.equal(dutyRule('petrol',2998,age,true).percent,15);assert.equal(dutyRule('petrol',4395,age,true).percent,10);});
test('all implemented codes match saved tariff rates',()=>{for(const type of ['petrol','diesel'])for(const cc of [999,1000,1001,1499,1500,1501,1799,1800,1801,1998,2300,2301,2500,2501,2799,2800,2801,2998,3000,3001,3499,3500,4200,4201,4395])for(const offroad of [false,true])for(const age of [{used:false},{used:true},{used:true,over5:true},{used:true,over5:true,over7:true}]){const r=dutyRule(type,cc,age,offroad),entry=rates.tariff[r.code];assert.ok(entry,`${type} ${cc} ${r.code}`);if(r.minEur){assert.ok(entry.rateText.includes(String(r.minEur).replace('.',',')),r.code);if(r.percent)assert.ok(entry.rateText.startsWith(String(r.percent)),r.code);}else assert.equal(Number(entry.rateText.replace(',','.')),r.percent,r.code);}});
test('every util table band endpoint chooses the correct coefficient',()=>{for(const g of rates.util)for(let idx=0;idx<g.bands.length;idx++){const b=g.bands[idx],kw=b.maxKw??500;const type=g.id==='electric'?'electric':'petrol',cc=g.maxCc??4000;const r=calculate({...base,type,cc:String(cc),kw:String(kw),powerEvidence:'Документ'},rates);assert.equal(r.coefficient,b.new,`${g.id}/${idx}`);}});
test('excise and fee boundary values',()=>{for(const hp of [90,90.01,150,150.01,200,200.01,300,300.01,400,400.01,500,500.01]){const r=calculate({...base,hp:String(hp)},rates);const rate=hp<=90?0:hp<=150?64:hp<=200?613:hp<=300?1004:hp<=400?1711:hp<=500?1771:1829;assert.equal(r.excise,Math.round(hp*rate*100)/100);}assert.equal(calculate({...base,customsOverride:'2700000'},rates).fee,13541);assert.equal(calculate({...base,customsOverride:'2700000.01'},rates).fee,18465);});
test('invalid, missing, negative or unsupported values fail closed',()=>{for(const value of ['',-1,'NaN','Infinity','1e5','x'])assert.throws(()=>calculate({...base,price:value},rates));assert.throws(()=>calculate({...base,calcDate:'2027-01-01'},rates),/2026/);assert.throws(()=>calculate({...base,productionDate:'2026-02-30'},rates));assert.throws(()=>calculate({...base,type:'hybrid'},rates),/гибрид/);assert.throws(()=>calculate({...base,confirmSpecs:false},rates));assert.throws(()=>calculate({...base,rateDate:'2026-09-23'},rates));assert.throws(()=>calculate({...base,cc:'1998.5'},rates));assert.throws(()=>calculate({...base,productionDate:'2019-01-01'},rates));});
test('localised input and total consistency',()=>{assert.equal(number('1 234,56','Цена'),1234.56);const r=calculate({...base,price:'200 000,01'},rates);assert.equal(Math.round(r.total*100),r.rows.reduce((s,r)=>s+Math.round(r.amount*100),0));});

test('preview shows a complete calculation without confirming documents; saving remains strict',()=>{
 const input={...base,confirmSpecs:false,productionDate:'2023-06-01',kw:'115',hp:'156',price:'234000',buyRate:'12.5448',cny:'12.5448',eur:'96.3733',preBorder:'200000',postBorder:'50000',documents:'100000',other:'10000',service:'10000'};
 const preview=calculate(input,rates,{preview:true});
 assert.equal(preview.total,calculate({...input,confirmSpecs:true},rates).total);
 assert.equal(preview.total,6304278.56);assert.match(preview.warnings.join(' '),/Предварительная/);
 assert.throws(()=>calculate(input,rates),/подтвердите/);
 assert.throws(()=>calculate({...input,price:''},rates,{preview:true}),/Цена/);
 assert.ok(calculate({...input,type:'electric',powerEvidence:''},rates,{preview:true}).total>0);
 assert.throws(()=>calculate({...input,type:'hybrid'},rates,{preview:true}),/гибрид/);
});

test('matches user TKS screenshot at 2026-09-23, CNY 12.5291, customs value excluding additional freight',()=>{
 const r=calculate({...base,calcDate:'2026-09-23',rateDate:'2026-09-23',productionDate:'2023-06-01',price:'234000',buyRate:'12.5291',cny:'12.5291',eur:'96.5915',kw:'115',hp:'156',preBorder:'0',postBorder:'0',documents:'0',other:'0',service:'0'},rates);
 assert.equal(r.customs,2931809.40);assert.equal(r.duty,586361.88);assert.equal(r.excise,95628);assert.equal(r.vat,795035.84);assert.equal(r.fee,18465);assert.equal(r.util,1408800);
 assert.equal(Math.round((r.duty+r.excise+r.vat+r.fee+r.util)*100)/100,2904290.72);
});

test('48V user mode uses petrol calculation without changing other hybrids',()=>{
 for(const cc of ['1998','2998'])for(const offroad of [false,true]){
 const petrol=calculate({...base,cc,offroad},rates);
 const mild=calculate({...base,cc,offroad,type:'mild48'},rates);
 assert.deepEqual(mild.rows,petrol.rows);assert.deepEqual(mild.rule,petrol.rule);
 assert.match(mild.warnings.join(' '),/48V/);
 }
 assert.throws(()=>calculate({...base,type:'hybrid'},rates),/гибрид/);
});

test('empty optional expenses default to zero; negative and invalid expenses still fail',()=>{
 const keys=['preBorder','postBorder','documents','other','service'];
 const zero=Object.fromEntries(keys.map(k=>[k,'0']));
 for(const value of ['', '   ',null,undefined]){
 const expenses=Object.fromEntries(keys.map(k=>[k,value]));
 assert.deepEqual(calculate({...base,...expenses},rates).rows,calculate({...base,...zero},rates).rows);
 }
 for(const k of keys)for(const value of ['-1','oops'])assert.throws(()=>calculate({...base,...zero,[k]:value},rates));
});
