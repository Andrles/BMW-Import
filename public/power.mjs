// Metric horsepower: 1 л. с. = 0.73549875 kW.
export function convertPower(value,from){
 const s=String(value??'').trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
 if(!/^\d+(\.\d*)?$/.test(s))return '';
 const n=Number(s);if(!Number.isFinite(n)||n>1e12)return '';
 const converted=from==='kw'?n/0.73549875:n*0.73549875;
 return String(Math.round((converted+Number.EPSILON)*100)/100);
}

// An edited value must never retain the catalogue's evidence as its own source.
export function powerProvenance(model, input) {
 if(input.type!=='electric')return null;
 const value=Number(String(input.kw).replace(',','.'));
 return model?.power30Source && value===Number(model.kw)
  ? {...model.power30Source,valueKw:value}
  : {kind:'manual',valueKw:Number.isFinite(value)?value:null};
}
