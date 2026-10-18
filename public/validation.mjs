// Date-only validation. UTC avoids local daylight-saving and timezone shifts.
const invalid = error => ({valid:false,error});
function parsedDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const d=new Date(`${value}T12:00:00Z`);
 return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value?d:null;
}
function validMonth(value){return typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&!!parsedDate(`${value}-01`);}
function anniversary(d,years){const y=d.getUTCFullYear()+years,m=d.getUTCMonth();return new Date(Date.UTC(y,m,Math.min(d.getUTCDate(),new Date(Date.UTC(y,m+1,0)).getUTCDate()),12));}
function ageAt(production,at){const p=parsedDate(production),d=parsedDate(at);return {used:d>=anniversary(p,3),utilOld:d>anniversary(p,3),over5:d>anniversary(p,5),over7:d>anniversary(p,7)};}
export function validateModelProduction(model,value){
 const month=typeof value==='string'?value.slice(0,7):'';
 if(!validMonth(month)||(value.length!==7&&!parsedDate(value)))return invalid('Проверьте дату изготовления.');
 // `year` is catalog metadata, not evidence of a production start date.
 for(const [key,label] of [['productionFrom','раньше начала'],['productionTo','позже окончания']]){
  const bound=model?.[key];
  if(!validMonth(bound))continue;
  if(key==='productionFrom'?month<bound:month>bound)return invalid(`Дата изготовления ${label} производства выбранной модели (${bound}).`);
 }
 return {valid:true,error:''};
}
export function productionMonthState(month,calcDate,{type='petrol'}={}){
 if(!validMonth(month))return invalid('Укажите корректный месяц изготовления.');
 if(!parsedDate(calcDate))return invalid('Укажите корректную дату расчёта.');
 if(month<'2020-01')return invalid('Каталог рассчитан на BMW с 2020 года.');
 if(month>calcDate.slice(0,7))return invalid('Дата изготовления не может быть позже даты расчёта.');
 const firstDate=`${month}-01`;
 const lastDay=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
 // Days later than the calculation date cannot be production candidates.
 const lastDate=`${month}-${String(lastDay).padStart(2,'0')}`<calcDate?`${month}-${String(lastDay).padStart(2,'0')}`:calcDate;
 const first=ageAt(firstDate,calcDate),last=ageAt(lastDate,calcDate);
 const keys=type==='electric'?['utilOld']:['used','utilOld','over5','over7'];
 const changed=keys.filter(key=>first[key]!==last[key]);
 return {valid:true,error:'',firstDate,lastDate,needsExactDay:changed.length>0,changed};
}
export function resolveProductionDate(month,exactDate,calcDate,{type='petrol',model}={}){
 const state=productionMonthState(month,calcDate,{type});
 if(!state.valid)return state;
 const modelState=validateModelProduction(model,month);
 if(!modelState.valid)return {...state,...modelState};
 if(exactDate){
  if(!parsedDate(exactDate)||exactDate.slice(0,7)!==month)return {...state,...invalid('Точная дата изготовления должна соответствовать выбранному месяцу.')};
  if(exactDate>calcDate)return {...state,...invalid('Дата изготовления не может быть позже даты расчёта.')};
  return {...state,productionDate:exactDate};
 }
 if(state.needsExactDay)return {...state,...invalid('Месяц изготовления находится на возрастной границе ставок. Укажите точную дату по документам.')};
 return {...state,productionDate:state.firstDate};
}
