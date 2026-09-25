import test from 'node:test';
import assert from 'node:assert/strict';
import {shareContent} from '../public/share.mjs';
const q={id:'abcd-1234',input:{vehicleName:'BMW X3',productionDate:'2025-09-15',productionPrecision:'month',calcDate:'2026-09-24',type:'petrol',cc:1998,hp:190,price:261000,buyRate:12.5598,cny:12.5598,rateDate:'2026-09-24'},result:{rows:[{id:'purchase',label:'Автомобиль',amount:3278107.8},{id:'other',label:'Прочее',amount:0}],total:5962543.64,rule:{}},company:{name:'Компания',note:'Особые условия'}};
test('sharing preserves saved amounts and does not mutate the quote',()=>{const before=JSON.stringify(q);const d=shareContent(q);assert.equal(d.total,'5 962 543,64 ₽');assert.equal(d.rows[0].value,'3 278 107,80 ₽');assert.equal(JSON.stringify(q),before);assert.match(d.specs,/09.2025/);assert.match(d.foot,/Особые условия/);assert.equal(d.rows.length,1);});
test('electric image labels 30-minute power, not peak power',()=>{const d=shareContent({...q,input:{...q.input,type:'electric',kw:100}});assert.match(d.specs,/30-минутная мощность 100 кВт/);assert.doesNotMatch(d.specs,/190 л/);});
test('sharing requires a saved quote and sanitizes filenames',()=>{assert.throws(()=>shareContent(null));assert.doesNotMatch(shareContent({...q,id:'../../file'}).filename,/[/.]{2}|\//);});
