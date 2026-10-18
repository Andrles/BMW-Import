import test from 'node:test';import assert from 'node:assert/strict';import {convertPower} from '../public/power.mjs';
test('metric horsepower converts both ways without integer rounding',()=>{assert.equal(convertPower('100','kw'),'135.96');assert.equal(convertPower('190','kw'),'258.33');assert.equal(convertPower('258','hp'),'189.76');assert.equal(convertPower('156','hp'),'114.74');});
test('localised input and incomplete values do not leave a stale conversion',()=>{assert.equal(convertPower('100,5','kw'),'136.64');assert.equal(convertPower(' 1 000 ','kw'),'1359.62');for(const x of ['',',','-5','abc','Infinity'])assert.equal(convertPower(x,'kw'),'');});

test('edited EV value is marked manual rather than attributed to catalog evidence',async()=>{
 const {powerProvenance}=await import('../public/power.mjs');
 const model={kw:85,power30Source:{kind:'user-provided',cell:'C6'}};
 assert.equal(powerProvenance(model,{type:'electric',kw:'85'}).cell,'C6');
 assert.equal(powerProvenance(model,{type:'electric',kw:'90'}).kind,'manual');
 assert.equal(powerProvenance(null,{type:'electric',kw:'85'}).kind,'manual');
});
