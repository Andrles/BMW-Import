import {offroadState} from './vehicle.mjs';
export class CalculationError extends Error {}
const fail = message => { throw new CalculationError(message); };
const round = v => Math.round((v + Number.EPSILON) * 100) / 100;
export function number(value, label, {positive=false, integer=false}={}) {
  if(value===null || value===undefined || String(value).trim()==='') fail(`Заполните поле «${label}».`);
  const s=String(value).trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
  if(!/^\d+(\.\d+)?$/.test(s)) fail(`«${label}»: введите неотрицательное число.`);
  const n=Number(s);
  if(!Number.isFinite(n)||n>1e12||(positive&&n<=0)||(integer&&!Number.isInteger(n))) fail(`Проверьте значение «${label}».`);
  return n;
}
function date(s,label) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s||'')) fail(`Укажите ${label}.`);
 const d=new Date(s+'T12:00:00Z');
 if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s) fail(`Проверьте ${label}.`);
 return d;
}
function anniversary(d,years){let y=d.getUTCFullYear()+years,m=d.getUTCMonth(),day=d.getUTCDate();return new Date(Date.UTC(y,m,Math.min(day,new Date(Date.UTC(y,m+1,0)).getUTCDate()),12));}
export function ages(production,at){const p=date(production,'дату изготовления'),d=date(at,'дату расчёта');if(p>d)fail('Дата изготовления не может быть позже даты расчёта.');if(p.getUTCFullYear()<2020)fail('Каталог рассчитан на BMW с 2020 года.');return {used:d>=anniversary(p,3),utilOld:d>anniversary(p,3),over5:d>anniversary(p,5),over7:d>anniversary(p,7)};}
export function dutyRule(type,cc,age,offroad=false){
 if(type==='electric') return {code:'8703800003',percent:15,minEur:0};
 if(!['petrol','diesel'].includes(type))fail('Для гибридной установки пока требуется отдельная проверка классификации.');
 const v=number(cc,'Объём двигателя',{positive:true,integer:true});
 let prefix,code,percent=age.used?20:15,minEur=0;
 if(type==='petrol'){
  if(v<=1000){prefix='870321909';code='8703211099';minEur=age.over7?1.4:.36;}
  else if(v<=1500){prefix='870322909';code='8703221099';minEur=age.over7?1.5:.4;}
  else if(v<=1800){prefix='870323904';code='8703231940';minEur=age.over7?1.6:.36;}
  else if(v<=3000){prefix='870323908';code=v<=2300?'8703231981':v<=2800?'8703231982':offroad?'8703231983':'8703231988';percent=age.used?20:v>2800&&!offroad?12.5:15;minEur=age.over7?2.2:.44;}
  else {prefix='870324909';code=offroad&&v>4200?'8703241091':offroad&&v<3500?'8703241092':'8703241098';percent=age.used?20:offroad&&v>4200?10:offroad&&v<3500?15:12.5;minEur=age.over7?3.2:.8;}
 }else{
  const band=v<=1500?'31':v<=2500?'32':'33';prefix=`8703${band}909`;code=band==='31'?'8703311090':`8703${band}1990`;minEur=age.over7?(v<=1500?1.5:v<=2500?2.2:3.2):(v<=1500?.32:v<=2500?.4:.8);
 }
 if(age.used){
  if(type==='petrol'&&v>1500&&v<=1800)code=prefix+(age.over7?'1':age.over5?'2':'9');
  else if(type==='petrol'&&v>1800&&v<=3000)code=prefix+(v<=2300?(age.over7?'1':age.over5?'2':'3'):(age.over7?'7':age.over5?'8':'9'));
  else code=prefix+(age.over7?'3':age.over5?'4':'8');
 }
 return {code,percent:age.over7?0:percent,minEur:age.used?minEur:0};
}
export function calculate(i,rates,{preview=false}={}){
 const mild48=i.type==='mild48';
 if(mild48)i={...i,type:'petrol'};
 if(!i.calcDate||i.calcDate<rates.validFrom||i.calcDate>rates.validTo)fail('В этой версии проверены ставки только на 2026 год. Обновите таблицы для другой даты.');
 const age=ages(i.productionDate,i.calcDate);
 const price=number(i.price,'Цена автомобиля',{positive:true}),buyRate=number(i.buyRate,'Курс покупки CNY',{positive:true}),cny=number(i.cny,'Курс ЦБ CNY',{positive:true});
 if(!i.rateDate)fail('Укажите дату официального курса.');date(i.rateDate,'дату курса');
 if(i.rateDate>i.calcDate)fail('Дата официального курса позже даты расчёта.');
 const kw=number(i.kw,'Мощность для утильсбора, кВт',{positive:true}),hp=number(i.hp,'Мощность для акциза, л. с.',{positive:true});
 if(!i.confirmSpecs&&!preview)fail('Перед сохранением или формированием предложения подтвердите сверку характеристик с документами.');
 const cc=i.type==='electric'?0:number(i.cc,'Объём двигателя',{positive:true,integer:true});
 const pre=number(String(i.preBorder??'').trim()||'0','Доставка и страхование до границы'),post=number(String(i.postBorder??'').trim()||'0','Доставка по России'),docs=number(String(i.documents??'').trim()||'0','Оформление и брокер'),other=number(String(i.other??'').trim()||'0','Прочие расходы'),service=number(String(i.service??'').trim()||'0','Услуги компании');
 const purchase=round(price*buyRate),customs= i.customsOverride?.trim()?number(i.customsOverride,'Таможенная стоимость',{positive:true}):round(price*cny+pre);
 const classification=offroadState(i,age);
 if(classification.needsReview&&!preview)fail('Уточните тип автомобиля, привод, клиренс и условия ЕТТ перед сохранением.');
 const rule=dutyRule(i.type,cc,age,classification.qualified);
 if(!rates.tariff[rule.code])fail('Ставка по этому коду ТН ВЭД не загружена.');
 const eur=rule.minEur?number(i.eur,'Курс ЦБ EUR',{positive:true}):Number(i.eur||0);
 const duty=round(Math.max(customs*rule.percent/100,cc*rule.minEur*eur));
 const exciseRate=rates.excise.find(b=>b.maxHp===null||hp<=b.maxHp).rate,excise=round(hp*exciseRate);
 const vat=round((customs+duty+excise)*rates.vat),fee=rates.fees.find(b=>b.maxRub===null||customs<=b.maxRub).rub;
 const group=i.type==='electric'?rates.util.find(g=>g.id==='electric'):rates.util.find(g=>g.id!=='electric'&&(g.maxCc===null||cc<=g.maxCc));
 const utilKw=round(kw),band=group.bands.find(b=>b.maxKw===null||utilKw<=b.maxKw);
 const coefficient=band[age.utilOld?'old':'new'],util=round(rates.utilBase*coefficient);
 const rows=[['purchase','Автомобиль',purchase],['preBorder','Доставка и страхование до границы',pre],['duty','Ввозная пошлина',duty],['excise','Акциз',excise],['vat','Ввозной НДС',vat],['fee','Таможенный сбор',fee],['util','Утилизационный сбор',util],['postBorder','Доставка по России',post],['documents','Оформление и брокер',docs],['other','Прочие расходы',other],['service','Услуги компании',service]].map(([id,label,amount])=>({id,label,amount:round(amount)}));
 const total=rows.reduce((s,r)=>s+Math.round(r.amount*100),0)/100;
 const warnings=[];
 if(classification.needsReview)warnings.push('Повышенная проходимость не подтверждена: предварительно применена обычная ставка. Уточните характеристики ЕТТ.');
 if(mild48)warnings.push('48V: бензиновая схема расчёта по настройке пользователя; классификация по документам не проверена.');
 if(!i.confirmSpecs)warnings.push('Предварительная сумма. Для сохранения и предложения клиенту подтвердите сверку характеристик с документами.');
 if(i.rateDate!==i.calcDate)warnings.push(`Курс на ${i.rateDate}; проверьте, что он действует на дату расчёта.`);
 if(i.customsOverride?.trim())warnings.push('Таможенная стоимость задана вручную.');
 if(i.productionDate===`${Number(i.calcDate.slice(0,4))-3}${i.calcDate.slice(4)}`)warnings.push('Граница 3 лет: пошлина для бывшего в эксплуатации, утильсбор — не старше 3 лет.');
 return {rows,total,customs,duty,excise,exciseRate,vat,fee,util,coefficient,rule,age,utilKw,bandLabel:band.label,version:rates.version,rateDate:i.rateDate,warnings};
}
