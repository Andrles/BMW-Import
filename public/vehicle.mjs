// Classification is based on documented characteristics, never on an SUV name alone.
export function offroadState(i, age) {
 const applicable=['petrol','mild48'].includes(i.type)&&Number(i.cc)>2800&&!age.used;
 if(!applicable||i.vehicleType==='passenger'||['rwd','fwd'].includes(i.drive))return {applicable,qualified:false,needsReview:false};
 const clearance=Number(String(i.clearance||'').replace(',','.'));
 if(i.ettStatus==='no'||(clearance>0&&clearance<210))return {applicable,qualified:false,needsReview:false};
 const qualified=i.vehicleType==='suv'&&i.drive==='awd'&&clearance>=210&&i.ettStatus==='yes';
 return {applicable,qualified,needsReview:!qualified};
}
