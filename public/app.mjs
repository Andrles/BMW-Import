import {renderShareImage} from './share.mjs';
import {convertPower} from './power.mjs';
import {calculate,ages} from './engine.mjs';
import {offroadState} from './vehicle.mjs';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rub=v=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
const num=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:4}).format(v);
const dateLabel=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('.'):v;
const fuel={petrol:'Бензин',diesel:'Дизель',electric:'Электро',hybrid:'Гибрид',mild48:'Бензин + 48V'};
const expenseFields=['preBorder','postBorder','documents','other','service'];
const todayDate=()=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Moscow'}).format(new Date());
const fields=['vehicleType','drive','clearance','ettStatus','productionPrecision','powerLinked','model','customName','productionDate','calcDate','type','cc','kw','hp','confirmSpecs','offroad','price','buyRate','buyMode','cny','eur','rateDate','rateSource','preBorder','postBorder','documents','other','service','customsOverride'];
let catalog=[],rates,company={},quotes=[],result=null,busy=false,rateRequest=0,view='calculator';
let toastTimer;
let showTrash=false;
const vehicleFields=['vehicleType','drive','clearance','ettStatus','productionPrecision','model','customName','productionDate','type','cc','kw','hp','powerLinked','confirmSpecs','offroad'];
const vehicleDrafts={};
function entryMode(custom){
 const current=$('model').value==='custom';
 if(current===custom)return;
 const input=collect();vehicleDrafts[current?'manual':'catalog']=Object.fromEntries(vehicleFields.map(k=>[k,input[k]]));
 const saved=vehicleDrafts[custom?'manual':'catalog'];
 if(saved)fill(saved);else chooseModel(custom?'custom':catalog[0].id);
 if(custom)document.querySelector('.spec-details').open=true;
 (custom?$('customName'):$('model')).focus();
}
function toast(s){$('toast').textContent=s;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),4500);}
async function api(url,options){const r=await fetch(url,options);const b=await r.json();if(!r.ok)throw Error(b.error||'Не удалось выполнить действие.');return b;}
const post=(url,b)=>api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
function collect(){const i={};for(const id of fields)i[id]=$(id).type==='checkbox'?$(id).checked:$(id).value;const m=catalog.find(c=>c.id===i.model);i.vehicleName=i.model==='custom'?(i.customName.trim()||'BMW — ручной ввод'):`BMW ${m?.name||''}`;i.body=m?.body||'';i.catalogSource=m?.source||'';return i;}
function syncDateControls(){const [y,m]=($('productionDate').value||'').split('-');$('productionYear').value=y||'';$('productionMonth').value=m||'';}
function writeProductionDate(){const y=$('productionYear').value,m=$('productionMonth').value;$('productionPrecision').value='month';$('productionDate').value=y&&m?y+'-'+m+'-15':'';}
function fill(input){const m=catalog.find(m=>m.id===input.model);input={vehicleType:m?.vehicleType||'passenger',drive:m?.drive||'unknown',clearance:'',ettStatus:'unknown',productionPrecision:'day',...input};if(input.powerLinked===undefined)input={...input,powerLinked:input.type!=='electric'};if(input.type==='hybrid'&&catalog.find(m=>m.id===input.model)?.type==='mild48')input={...input,type:'mild48'};for(const f of fields)if(input[f]!==undefined){if($(f).type==='checkbox')$(f).checked=!!input[f];else $(f).value=input[f]??'';}$('calcDate').value=todayDate();for(const id of expenseFields)if(!$(id).value.trim())$(id).value='0';syncDateControls();syncVehicle();render();}
function setView(id){view=id;document.querySelectorAll('.view').forEach(e=>e.classList.toggle('hidden',e.id!==id));document.querySelectorAll('nav button').forEach(e=>e.classList.toggle('active',e.dataset.view===id));$('topTitle').textContent=' / '+({calculator:'Новый расчёт',history:'Сохранённые расчёты',catalog:'Каталог BMW',settings:'Настройки'}[id]);if(id==='history')loadHistory();window.scrollTo({top:0});}
function syncVehicle(){const m=catalog.find(c=>c.id===$('model').value),custom=$('model').value==='custom',type=$('type').value;
 $('customNameWrap').classList.toggle('hidden',!custom);
 $('modelWrap').classList.toggle('hidden',custom);$('manualHelp').classList.toggle('hidden',!custom);
 $('manualMode').setAttribute('aria-pressed',String(custom));$('catalogMode').setAttribute('aria-pressed',String(!custom));$('type').disabled=!custom;
 $('cc').disabled=type==='electric';$('kwLabel').textContent=type==='electric'?'Макс. 30-минутная мощность, кВт':'Мощность для утильсбора, кВт';
 let classification={applicable:false,qualified:false};try{classification=offroadState(collect(),ages($('productionDate').value,$('calcDate').value));}catch{};
 $('offroad').checked=classification.qualified;
 $('offroadWrap').classList.toggle('hidden',!classification.applicable||$('vehicleType').value!=='suv');
 $('offroadHelp').textContent=classification.qualified?'Повышенная проходимость ЕТТ: применяется автоматически.':classification.needsReview?'Уточните клиренс и остальные условия ЕТТ для точной пошлины.':'Повышенная проходимость ЕТТ: не применяется.';
 $('specSummary').textContent=[fuel[type],type==='electric'?$('kw').value+' кВт':$('cc').value+' см³',$('hp').value+' л.с.'].join(' · ');
 $('heroName').textContent=custom?($('customName').value.replace(/^BMW\s*/i,'')||'Ваш BMW'):m?.name||'BMW';
 $('heroMeta').textContent=custom?'Ручной ввод / по документам':`${m?.family} / ${m?.body}`;
 $('heroFuel').textContent=fuel[type];$('heroPower').textContent=type==='electric'?(m?.peak?`${m.peak} кВт · пиковая`:'Электромобиль'):($('hp').value?`${$('hp').value} л. с.`:'Мощность по документам');
 $('modelNote').innerHTML=custom?'Введите точные характеристики из документов автомобиля. Для 48V доступна бензиновая схема расчёта; для остальных гибридов требуется отдельная классификация.':`${esc(m?.note)} <a href="${esc(m?.source)}" target="_blank" rel="noreferrer">Источник BMW ↗</a>`;
 $('powerHelp').textContent=type==='electric'?'Для электро поля могут обозначать разные показатели. Связывайте их только если в документах это одна и та же мощность.':'1 кВт = 1,35962 л. с. Пересчёт при ручном вводе, до двух знаков после запятой.';
 $('buyRate').readOnly=$('buyMode').value==='cbr';
}
function chooseModel(id){$('model').value=id;const m=catalog.find(c=>c.id===id);for(const field of ['cc','kw','hp'])$(field).value=m?.[field]??'';$('type').value=m?.type||'petrol';$('powerLinked').checked=m?.type!=='electric';$('productionDate').value='';$('productionPrecision').value='month';syncDateControls();$('vehicleType').value=m?.vehicleType||'passenger';$('drive').value=m?.drive||'unknown';$('clearance').value='';$('ettStatus').value='unknown';$('confirmSpecs').checked=false;$('offroad').checked=false;if(m?.type==='electric')document.querySelector('.spec-details').open=true;if(m)$('productionDate').placeholder=`${m.year}-мм-дд`;syncVehicle();render();}
function render(){syncVehicle();const i=collect();try{localStorage.setItem('bmw-import-draft-v1',JSON.stringify(i));}catch{}
 try{result=calculate(i,rates,{preview:true});$('total').textContent=rub(result.total);const grouped=[['Автомобиль',result.rows.find(r=>r.id==='purchase').amount],['Таможенные платежи',result.duty+result.excise+result.vat+result.fee],['Утилизационный сбор',result.util],['Доставка и услуги',result.rows.filter(r=>['preBorder','postBorder','documents','other','service'].includes(r.id)).reduce((s,r)=>s+r.amount,0)]];$('summaryBreakdown').innerHTML=grouped.map(([label,value])=>'<div class="row"><span>'+label+'</span><b>'+rub(value)+'</b></div>').join('');$('breakdown').innerHTML=result.rows.filter(r=>r.amount||['purchase','duty','excise','vat','fee','util'].includes(r.id)).map(r=>`<div class="row ${r.id}"><span>${esc(r.label)}</span><b>${rub(r.amount)}</b></div>`).join('');$('taxMeta').innerHTML=`Таможенная стоимость: ${rub(result.customs)}<br>ТН ВЭД: ${result.rule.code} · ${esc(rates.tariff[result.rule.code].rateText)}<br>Утильсбор: 20 000 × ${num(result.coefficient)}<br>Акциз: ${num(result.exciseRate)} ₽ / л. с. · НДС: ${rates.vat*100}%`;
 $('resultMessage').textContent=result.warnings.join(' ');$('resultMessage').classList.toggle('hidden',!result.warnings.length);$('resultMessage').classList.toggle('warning',!!result.warnings.length);
 }catch(e){result=null;$('summaryBreakdown').innerHTML='';$('total').textContent='—';$('breakdown').innerHTML='';$('taxMeta').innerHTML='';$('resultMessage').textContent=e.message;$('resultMessage').classList.remove('hidden','warning');}
 $('reviewSpecs').classList.toggle('hidden',!result||!!i.confirmSpecs);const unresolved=result&&offroadState(i,result.age).needsReview;$('makeQuote').disabled=!result||busy||!i.confirmSpecs||unresolved;$('saveQuote').disabled=!result||busy||!i.confirmSpecs||unresolved;
}
async function refreshRate(){const request=++rateRequest;const requestedDate=$('calcDate').value;$('refreshRate').disabled=true;$('refreshCustomsRate').disabled=true;$('refreshCustomsRate').textContent='Обновляем…';$('rateStatus').textContent='Получаем официальный курс…';try{const r=await api('/api/rates?date='+encodeURIComponent(requestedDate));if(request!==rateRequest)return;$('cny').value=r.CNY;$('eur').value=r.EUR;$('rateDate').value=r.date;$('rateSource').value=r.cached?'Банк России · сохранённый курс':'Банк России';if($('buyMode').value==='cbr')$('buyRate').value=r.CNY;$('rateStatus').textContent=`1 ¥ = ${num(r.CNY)} ₽`;$('rateDetails').textContent=`${r.source} · ${dateLabel(r.date)}${r.cached?' · из кэша':''}`;if(r.error)toast(r.error);render();}catch(e){if(request!==rateRequest)return;$('rateStatus').textContent='Не удалось обновить курс';$('rateDetails').textContent=$('rateDate').value?`Оставлен курс на ${dateLabel($('rateDate').value)}`:'Введите курс вручную в разделе ниже';$('ratesDetails').open=true;toast(e.message);}finally{if(request===rateRequest){$('refreshRate').disabled=false;$('refreshCustomsRate').disabled=false;$('refreshCustomsRate').textContent='↻ Обновить';}}}
async function loadHistory(){try{quotes=await api('/api/quotes'+(showTrash?'?trash=1':''));$('historyCount').textContent=showTrash?(await api('/api/quotes')).length:quotes.length;$('toggleTrash').textContent=showTrash?'К сохранённым отчётам':'Удалённые отчёты';$('historyList').innerHTML=quotes.length?quotes.map(q=>`<div class="history-item"><div><h3>${esc(q.input.vehicleName)}</h3><small>${dateLabel(q.input.productionDate)}${q.input.productionPrecision==='month'?' (день условный)':''} · расчёт ${dateLabel(q.input.calcDate)} · № ${q.id.slice(0,8).toUpperCase()}</small><div class="history-actions"><button class="button secondary" data-report="${q.id}">Предложение / PDF</button><button class="button secondary" data-copy="${q.id}">Создать копию</button><button class="button secondary" ${showTrash?'data-restore':'data-delete'}="${q.id}">${showTrash?'Восстановить':'Удалить'}</button></div></div><div><div class="amount">${rub(q.result.total)}</div><small>${esc(q.result.version)} · курс ${num(Number(q.input.buyRate))} ₽/¥</small></div></div>`).join(''):`<div class="empty-state"><h2>${showTrash?'Удалённых отчётов нет':'Здесь появятся ваши расчёты'}</h2><p>${showTrash?'Удалённые отчёты можно восстановить в этом разделе.':'Сохраните первое предложение из калькулятора.'}</p></div>`;}catch(e){toast(e.message);}}
async function save(show){if(!result||busy)return;busy=true;render();try{const quote=await post('/api/quotes',{input:collect(),company});await loadHistory();toast('Расчёт сохранён. Курсы и ставки зафиксированы.');if(show)openQuote(quote);}catch(e){toast(e.message);}finally{busy=false;render();}}
let openedQuote=null, shareImage=null;
function openQuote(q){openedQuote=q;const i=q.input,r=q.result,c=q.company||{};const contact=c.contact||'';const production=dateLabel(i.productionDate)+(i.productionPrecision==='month'?' (известны месяц и год; принято 15-е)':'');const taxName=i.type==='electric'?`30-минутная мощность ${num(Number(i.kw))} кВт`:`${num(Number(i.cc))} см³ · ${num(Number(i.hp))} л. с.`;
 $('quotePaper').innerHTML=`<div class="quote-brand"><div><div class="quote-company">${esc(c.name||'АВТОМОБИЛИ ИЗ КИТАЯ')}</div><div class="quote-contact">${esc(contact)}</div></div><div class="quote-number">ПРЕДЛОЖЕНИЕ № ${q.id.slice(0,8).toUpperCase()}<br>${dateLabel(i.calcDate)}</div></div><h1 class="quote-title">Ваш следующий BMW</h1><p class="quote-sub">Индивидуальный расчёт стоимости · Китай → Россия</p><div class="quote-vehicle"><div><h2>${esc(i.vehicleName)}</h2><p>${esc(i.body||'')} · изготовлен ${production}<br>${fuel[i.type]} · ${taxName}</p></div><div class="qprice">${num(Number(i.price))} ¥</div></div><table class="quote-table"><thead><tr><th>СОСТАВ СТОИМОСТИ</th><th>СУММА, ₽</th></tr></thead><tbody>${r.rows.filter(x=>x.amount||['purchase','duty','excise','vat','fee','util'].includes(x.id)).map(x=>`<tr><td>${esc(x.label)}</td><td>${rub(x.amount)}</td></tr>`).join('')}</tbody></table><div class="quote-total"><span>Итоговая цена<br>для клиента</span><strong>${rub(r.total)}</strong></div><p class="quote-foot">Курс покупки: 1 CNY = ${num(Number(i.buyRate))} RUB. Официальный курс CNY: ${num(Number(i.cny))} RUB на ${dateLabel(i.rateDate)}.${r.rule.minEur?` EUR: ${num(Number(i.eur))} RUB.`:''}\n${i.type==='mild48'?'48V: применена бензиновая схема по настройке пользователя; классификация по документам не проверена. ':''}Предварительная оценка, окончательные платежи определяются при таможенном оформлении. НДС в таблице — ввозной НДС. Предложение не является счётом-фактурой.${c.note?'\n\n'+esc(c.note):''}</p><div class="quote-footer"><span>Юридическое лицо · российская таможня</span><span>Расчётная база ${esc(r.version)}</span></div>`;
 if(!$('quoteDialog').open)$('quoteDialog').showModal();
}
function catalogRender(){
 const groups=[...new Set(catalog.map(m=>m.family))];
 $('model').innerHTML=groups.map(g=>`<optgroup label="BMW ${esc(g)}">${catalog.filter(m=>m.family===g).map(m=>`<option value="${m.id}">${esc(m.name)} · ${esc(m.body)} · ${m.year} · ${m.hp?m.hp+' л.с.':m.peak+' кВт пик'}${m.type==='mild48'?' · 48V':''}</option>`).join('')}</optgroup>`).join('')+'<option value="custom">Другой BMW — ввести характеристики</option>';
 catalogFilter();
}
function catalogFilter(){
 const query=$('catalogSearch').value.trim().toLocaleLowerCase(),type=$('catalogFuel').value;
 const matches=catalog.filter(m=>(!type||m.type===type)&&`bmw ${m.name} ${m.family} ${m.body} ${m.year}`.toLocaleLowerCase().includes(query));
 $('catalogCount').textContent=`Показано ${matches.length} из ${catalog.length} модификаций`;
 $('catalogList').innerHTML=matches.length?matches.map(m=>`<article class="card catalog-item"><span class="pill">${fuel[m.type]} · ${m.year} · ${m.hp?m.hp+' л.с.':m.peak+' кВт пик'}${m.type==='hybrid'?' · справочно':''}</span><h3>BMW ${esc(m.name)}</h3><p class="muted">${esc(m.body)} · Китай</p><p class="hint">${esc(m.note)}</p><a href="${esc(m.source)}" target="_blank" rel="noreferrer">Официальный источник ↗</a><button class="button secondary" data-select="${m.id}">${m.type==='hybrid'?'Открыть характеристики':'Рассчитать эту версию'}</button></article>`).join(''):'<div class="empty-state"><h2>Модификации не найдены</h2><p>Измените запрос или выберите другой тип двигателя.</p></div>';
}
async function init(){try{[catalog,rates,company]=await Promise.all([api('/catalog.json'),api('/rates.json'),api('/api/settings')]);catalogRender();$('sources').innerHTML=rates.sources.map(s=>`<a class="source-link" href="${s.url}" target="_blank" rel="noreferrer">${esc(s.name)} ↗</a>`).join('');$('companyName').value=company.name||'';$('companyContact').value=company.contact||'';$('companyNote').value=company.note||'';
 const today=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Moscow'}).format(new Date());$('calcDate').value=today;
 let draft=null;try{draft=JSON.parse(localStorage.getItem('bmw-import-draft-v1'));}catch{}
 if(draft&&([...catalog.map(m=>m.id),'custom'].includes(draft.model))){fill(draft);if(draft.cny){$('rateStatus').textContent=`1 ¥ = ${num(Number(draft.cny))} ₽`;$('rateDetails').textContent=`${draft.rateSource} · ${dateLabel(draft.rateDate)} · из черновика`;}}else chooseModel('325li-2024');
 $('calcForm').addEventListener('submit',e=>e.preventDefault());$('model').addEventListener('change',()=>chooseModel($('model').value));
 $('calcForm').addEventListener('input',e=>{if(expenseFields.includes(e.target.id)&&!e.target.value.trim())e.target.value='0';if(['productionMonth','productionYear'].includes(e.target.id)){writeProductionDate();$('confirmSpecs').checked=false;}if(['vehicleType','drive','clearance','ettStatus'].includes(e.target.id))$('confirmSpecs').checked=false;if(e.target.id==='type')$('powerLinked').checked=$('type').value!=='electric';if(['kw','hp'].includes(e.target.id)&&$('powerLinked').checked){const target=e.target.id==='kw'?'hp':'kw';$(target).value=convertPower(e.target.value,e.target.id);}if(e.target.id==='powerLinked')$('confirmSpecs').checked=false;if(['kw','hp','cc','type','productionDate','customName','offroad'].includes(e.target.id))$('confirmSpecs').checked=false;if(['cny','eur','rateDate'].includes(e.target.id)){$('rateSource').value='Ручной ввод';$('rateStatus').textContent='Официальный курс задан вручную';$('rateDetails').textContent=`Дата: ${dateLabel($('rateDate').value)}`;if($('buyMode').value==='cbr')$('buyRate').value=$('cny').value;}if(e.target.id==='buyMode'&&$('buyMode').value==='cbr')$('buyRate').value=$('cny').value;render();});
 $('manualMode').addEventListener('click',()=>entryMode(true));$('catalogMode').addEventListener('click',()=>entryMode(false));

 document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
 $('reviewSpecs').addEventListener('click',()=>{$('confirmSpecs').scrollIntoView({behavior:'smooth',block:'center'});$('confirmSpecs').focus({preventScroll:true});});
 $('refreshRate').addEventListener('click',refreshRate);$('refreshCustomsRate').addEventListener('click',refreshRate);$('makeQuote').addEventListener('click',()=>save(true));$('saveQuote').addEventListener('click',()=>save(false));$('reloadHistory').addEventListener('click',loadHistory);
 $('toggleTrash').addEventListener('click',()=>{showTrash=!showTrash;loadHistory();});
 $('historyList').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.delete||b.dataset.restore){b.disabled=true;try{const restoring=!!b.dataset.restore;await api('/api/quotes/'+(b.dataset.restore||b.dataset.delete)+(restoring?'/restore':''),{method:restoring?'POST':'DELETE'});await loadHistory();toast(restoring?'Отчёт восстановлен.':'Отчёт перемещён в удалённые. Его можно восстановить.');}catch(e){toast(e.message);b.disabled=false;}return;}if(b.dataset.report)openQuote(quotes.find(q=>q.id===b.dataset.report));if(b.dataset.copy){const q=quotes.find(q=>q.id===b.dataset.copy);fill(q.input);setView('calculator');toast('Открыта копия. Старое предложение осталось без изменений.');}});
 $('catalogSearch').addEventListener('input',catalogFilter);$('catalogFuel').addEventListener('change',catalogFilter);
 $('catalogList').addEventListener('click',e=>{const b=e.target.closest('[data-select]');if(b){chooseModel(b.dataset.select);setView('calculator');}});
 $('closeQuote').addEventListener('click',()=>$('quoteDialog').close());$('printQuote').addEventListener('click',()=>{document.querySelector('.proposal-more').open=false;window.print();});
 $('saveSettings').addEventListener('click',async()=>{try{company=await post('/api/settings',{name:$('companyName').value,contact:$('companyContact').value,note:$('companyNote').value});toast('Реквизиты сохранены для новых предложений.');}catch(e){toast(e.message);}});
 $('demo').addEventListener('click',async()=>{chooseModel('325li-2024');$('productionDate').value='2024-02-15';$('productionPrecision').value='month';syncDateControls();$('calcDate').value=todayDate();$('price').value='200000';for(const id of expenseFields)$(id).value='0';$('customsOverride').value='';$('buyMode').value='cbr';$('confirmSpecs').checked=true;render();await refreshRate();toast('Демонстрационный пример: цена и расходы условные.');});
 await loadHistory();if(!$('cny').value||($('buyMode').value==='cbr'&&draft?.calcDate!==todayDate()))await refreshRate();render();
 }catch(e){$('resultMessage').textContent='Не удалось загрузить приложение: '+e.message;toast(e.message);}}
init();

$('shareQuote').addEventListener('click',async()=>{try{await document.fonts.ready;shareImage=renderShareImage(openedQuote);$('sharePreview').src=shareImage.dataURL;$('shareDialog').showModal();}catch(e){toast(e.message);}});
$('closeShare').addEventListener('click',()=>$('shareDialog').close());
$('shareActions').addEventListener('click',async e=>{
 const action=e.target.closest('[data-share]')?.dataset.share;if(!action||!shareImage)return;
 try{
  const native=window.webkit?.messageHandlers?.shareQuote;
  if(native){native.postMessage({...shareImage,action});return;}
  if(action==='save'){const a=document.createElement('a');a.href=shareImage.dataURL;a.download=shareImage.filename;a.click();return;}
  const blob=await (await fetch(shareImage.dataURL)).blob();const file=new File([blob],shareImage.filename,{type:'image/png'});
  if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:openedQuote.input.vehicleName});}
  else toast('Сохраните PNG и прикрепите его в '+({telegram:'Telegram',whatsapp:'WhatsApp',max:'MAX',email:'Email'}[action]||'сообщении')+'.');
 }catch(e){if(e.name!=='AbortError')toast('Не удалось передать изображение. Сохраните PNG и приложите вручную.');}
});
