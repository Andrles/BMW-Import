import test from 'node:test';
import assert from 'node:assert/strict';
import {offroadState} from '../public/vehicle.mjs';
import {calculate,ages} from '../public/engine.mjs';
import {readFile} from 'node:fs/promises';
const rates=JSON.parse(await readFile(new URL('../public/rates.json',import.meta.url)));
const car={vehicleType:'suv',drive:'awd',clearance:'210',ettStatus:'yes',type:'petrol',cc:'2998',productionDate:'2026-01-15',calcDate:'2026-09-23',kw:'280',hp:'381',price:'234000',buyRate:'12.5291',cny:'12.5291',eur:'96.5915',rateDate:'2026-09-23',confirmSpecs:true,preBorder:'0',postBorder:'0',documents:'0',other:'0',service:'0'};
test('ETT: strict volume threshold; clearance inclusive; petrol and new only',()=>{
 for(const cc of [2799,2800])assert.equal(offroadState({...car,cc}, {used:false}).qualified,false);
 for(const cc of [2801,2998,3000,3001,4395])assert.equal(offroadState({...car,cc},{used:false}).qualified,true);
 assert.equal(offroadState({...car,clearance:'209'}, {used:false}).qualified,false);
 assert.equal(offroadState(car,{used:true}).qualified,false);
 for(const type of ['diesel','electric'])assert.equal(offroadState({...car,type},{used:false}).qualified,false);
});
test('AWD sedan never qualifies; unknown SUV cannot silently produce final quote',()=>{
 assert.equal(calculate({...car,vehicleType:'passenger'},rates).rule.percent,12.5);
 assert.equal(calculate(car,rates).rule.percent,15);
 for(const change of [{drive:'unknown'},{ettStatus:'unknown'},{clearance:''}]){
 assert.throws(()=>calculate({...car,...change},rates),/ЕТТ/);
 assert.match(calculate({...car,...change},rates,{preview:true}).warnings.join(' '),/не подтверждена/);
 }
 assert.equal(calculate({...car,drive:'rwd'},rates).rule.percent,12.5);
 assert.equal(calculate({...car,ettStatus:'no'},rates).rule.percent,12.5);
});
test('production month midpoint and exact day change age on boundary',()=>{
 assert.equal(ages('2023-09-15','2026-09-14').used,false);
 assert.equal(ages('2023-09-15','2026-09-15').used,true);
 assert.equal(ages('2023-09-15','2026-09-15').utilOld,false);
 assert.equal(ages('2023-09-15','2026-09-16').utilOld,true);
 assert.equal(ages('2023-09-24','2026-09-23').used,false);
 assert.throws(()=>ages('2024-02-31','2026-09-23'));
});
test('X6 catalog preserves previous generation and has requested modern powers',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url)));
 for(const [id,hp,kw] of [['x6-30-2021',265,195],['x6-40-2021',340,250],['x6-30-2026',258,190],['x6-40-2026',381,280]]){
 const m=catalog.find(m=>m.id===id);assert.equal(m.hp,hp);assert.equal(m.kw,kw);
 const r=calculate({...car,...m,productionDate:'2026-01-15'},rates);assert.equal(r.excise,hp*(hp<=300?1004:1711));
 }
});
