import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sortCatalog} from '../public/catalog-order.mjs';
test('catalog groups sort numerically without mutating input',()=>{
 const families=['X10','3 серия','iX3','X2','1 серия','i4','X1','2 серия','i3','iX'];
 const input=families.map((family,i)=>({family,name:family,id:String(i)}));
 assert.deepEqual(sortCatalog(input).map(m=>m.family),['1 серия','2 серия','3 серия','X1','X2','X10','i3','i4','iX','iX3']);
 assert.deepEqual(input.map(m=>m.family),families);
});
test('Chinese X1 M35Li retains documented power and production scope',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../public/catalog.json',import.meta.url)));
 const m=catalog.find(m=>m.id==='x1-u12-m35li');
 assert.deepEqual([m.hp,m.kw,m.cc,m.productionFrom],[300,221,1998,'2024-09']);
 assert.equal(new Set(catalog.map(m=>m.id)).size,catalog.length);
});
