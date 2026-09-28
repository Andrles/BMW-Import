import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url)));
const app=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
const expected={'ix1-25-2024':68,'ix1-30':104,ix3:85,'ix3-impressive-2024':85,'ix3-leading-2024':85,'i3-35':85,'i3-40':105,i5:90,'i5-edrive40l-2025':120,'i5-xdrive50l-2025':135,'i7-60':135,'i4-35':85,'i4-40':105,'ix-40':108,'ix-50':150,'ix-60':180};
test('workbook values populate every supplied version without replacing excise power',()=>{
 assert.equal(new Set(catalog.map(m=>m.id)).size,catalog.length);
 for(const [id,kw] of Object.entries(expected)){
  const m=catalog.find(m=>m.id===id);assert.ok(m,id);assert.equal(m.kw,kw,id);
  assert.equal(m.hp,null);assert.equal(m.power30Source.kind,'user-provided');assert.match(m.power30Source.cell,/^C\d+$/);
 }
 for(const id of ['i4-m50','i7-50'])assert.equal(catalog.find(m=>m.id===id).kw,null);
 assert.equal(catalog.find(m=>m.id==='i3-35').peak,210);
});
test('selection fills power and clears previous values when the next model is unknown',()=>{
 const fields={};const $=id=>fields[id]??={value:'',checked:false};
 const context=vm.createContext({catalog,$,document:{querySelector:()=>({open:false})},syncDateControls(){},syncVehicle(){},render(){}});
 vm.runInContext(app.match(/function chooseModel\(id\)\{[^\n]+/)[0],context);
 for(const [id,kw] of Object.entries(expected)){
  context.chooseModel(id);assert.equal($('kw').value,kw);assert.equal($('hp').value,'');assert.equal($('powerLinked').checked,false);
 }
 $('kw').value='181';context.chooseModel('i4-m50');assert.equal($('kw').value,'');
 context.chooseModel('i3-35');assert.equal($('kw').value,85);
});
