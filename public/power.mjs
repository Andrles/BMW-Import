// Metric horsepower: 1 л. с. = 0.73549875 kW.
export function convertPower(value,from){
 const s=String(value??'').trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
 if(!/^\d+(\.\d*)?$/.test(s))return '';
 const n=Number(s);if(!Number.isFinite(n)||n>1e12)return '';
 const converted=from==='kw'?n/0.73549875:n*0.73549875;
 return String(Math.round((converted+Number.EPSILON)*100)/100);
}
