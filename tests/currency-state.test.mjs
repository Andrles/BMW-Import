import test from 'node:test';
import assert from 'node:assert/strict';
import {rateReadiness,needsRateRefresh,tariffReminder} from '../public/currency-state.mjs';
test('weekend official rate is verified by requested date, not publication date',()=>{
 assert.equal(rateReadiness({rateState:'cbr',rateCheckedDate:'2026-10-04',rateDate:'2026-10-03',calcDate:'2026-10-04'}).ready,true);
});
test('manual purchase does not suppress customs refresh',()=>{
 assert.equal(needsRateRefresh({buyMode:'manual',cny:12,eur:100,rateCheckedDate:'2026-10-03'},'2026-10-04'),true);
});
test('stale, failed and manually changed rates require acknowledgement',()=>{
 for(const rateState of ['manual','error','stale']){
 const input={rateState,rateCheckedDate:'2026-10-04',calcDate:'2026-10-04'};
 assert.equal(rateReadiness(input).ready,false);
 assert.equal(rateReadiness({...input,rateConfirmed:true}).ready,true);
 }
 assert.equal(rateReadiness({rateState:'cbr',rateCheckedDate:'2026-10-03',calcDate:'2026-10-04'}).ready,false);
});
test('tariff reminder appears ahead of expiry and blocks no valid dates',()=>{
 assert.match(tariffReminder({validTo:'2026-12-31'},'2026-10-06'),/31.12.2026/);
 assert.match(tariffReminder({validTo:'2026-12-31'},'2027-01-01'),/истёк/);
 assert.equal(tariffReminder({validTo:'2026-12-31'},'2026-01-01'),'');
});
