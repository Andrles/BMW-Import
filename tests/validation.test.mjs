import test from 'node:test';
import assert from 'node:assert/strict';
import {productionMonthState,resolveProductionDate,validateModelProduction} from '../public/validation.mjs';

test('exact day is required only when month spans an applicable age boundary',()=>{
 assert.deepEqual(productionMonthState('2023-10','2026-10-06').changed,['used','utilOld']);
 assert.equal(productionMonthState('2023-09','2026-10-06').needsExactDay,false);
 assert.equal(productionMonthState('2023-11','2026-10-06').needsExactDay,false);
 assert.deepEqual(productionMonthState('2021-10','2026-10-06').changed,['over5']);
 assert.deepEqual(productionMonthState('2021-10','2026-10-06',{type:'electric'}).changed,[]);
});
test('third anniversary distinguishes tariff and recycling boundaries',()=>{
 assert.deepEqual(productionMonthState('2023-10','2026-10-01').changed,['used']);
 assert.deepEqual(productionMonthState('2023-10','2026-10-31').changed,['utilOld']);
 assert.equal(productionMonthState('2023-10','2026-10-01',{type:'electric'}).needsExactDay,false);
});
test('leap-day anniversaries use the same month-end clamp as the engine',()=>{
 assert.deepEqual(productionMonthState('2020-02','2023-02-28').changed,['utilOld']);
 assert.equal(productionMonthState('2020-02','2023-03-01').needsExactDay,false);
});
test('invalid months and future dates fail; current month excludes future days',()=>{
 for(const month of ['2023-00','2023-13','2023-2','2019-12','2027-01'])assert.equal(productionMonthState(month,'2026-10-06').valid,false);
 assert.equal(productionMonthState('2023-01','2026-02-30').valid,false);
 assert.equal(productionMonthState('2026-10','2026-10-06').lastDate,'2026-10-06');
});
test('catalog checks only explicit valid production bounds',()=>{
 assert.equal(validateModelProduction({year:2025},'2020-01').valid,true);
 assert.equal(validateModelProduction({productionFrom:'2023-11'},'2023-10').valid,false);
 assert.equal(validateModelProduction({productionFrom:'2023-11'},'2023-11-01').valid,true);
 assert.equal(validateModelProduction({productionTo:'2024-03'},'2024-04').valid,false);
 assert.equal(validateModelProduction({productionTo:'2024-03'},'2024-03-31').valid,true);
 assert.equal(validateModelProduction({productionFrom:'invalid'},'2020-01').valid,true);
});
test('resolution requires exact dates at boundaries, checks consistency, and permits safe month-only dates',()=>{
 assert.equal(resolveProductionDate('2023-10','','2026-10-06').valid,false);
 assert.equal(resolveProductionDate('2023-10','2023-10-07','2026-10-06').productionDate,'2023-10-07');
 assert.equal(resolveProductionDate('2023-10','2023-09-30','2026-10-06').valid,false);
 assert.equal(resolveProductionDate('2023-10','2023-10-32','2026-10-06').valid,false);
 assert.equal(resolveProductionDate('2026-10','2026-10-07','2026-10-06').valid,false);
 assert.equal(resolveProductionDate('2023-09','','2026-10-06').productionDate,'2023-09-01');
 assert.equal(resolveProductionDate('2023-09','','2026-10-06',{model:{productionFrom:'2023-11'}}).valid,false);
});
