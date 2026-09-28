// Export only the immutable saved quote. Never recalculate during sharing.
export function shareContent(q) {
 if (!q?.input || !q?.result || !Array.isArray(q.result.rows)) throw new Error('Сначала сохраните расчёт.');
 const i=q.input,r=q.result,c=q.company||{};
 const n=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:4}).format(Number(v));
 const rub=v=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v))+' ₽';
 const date=v=>String(v||'').split('-').reverse().join('.');
 const rows=r.rows.filter(x=>x.amount||['purchase','duty','excise','vat','fee','util'].includes(x.id)).map(x=>({label:x.label,value:rub(x.amount)}));
 const fuel={petrol:'Бензин',diesel:'Дизель',electric:'Электро',mild48:'Бензин · 48V'};
 return {title:i.vehicleName,company:c.name||'BMW IMPORT',contact:c.contact||'',number:String(q.id).slice(0,8).toUpperCase(),date:date(i.calcDate),
 specs:[i.body,i.productionPrecision==='month'?String(i.productionDate).slice(0,7).split('-').reverse().join('.') : date(i.productionDate),fuel[i.type],i.type==='electric'?`30-минутная мощность ${n(i.kw)} кВт`:`${n(i.cc)} см³ · ${n(i.hp)} л. с.`].filter(Boolean).join(' · '),
 price:n(i.price)+' ¥',rows,total:rub(r.total),version:r.version||q.rates?.version||'Не указана',jurisdiction:'Юридическое лицо · российская таможня',
 foot:`Курс покупки: 1 CNY = ${n(i.buyRate)} RUB. Официальный курс CNY: ${n(i.cny)} RUB на ${date(i.rateDate)}.${r.rule?.minEur?` EUR: ${n(i.eur)} RUB.`:''}\nПредварительная оценка. Окончательные платежи определяются при таможенном оформлении. НДС в таблице — ввозной НДС. Предложение не является счётом-фактурой.${i.productionPrecision==='month'?' Для расчёта возраста принят условный день — 15-е.':''}${i.type==='mild48'?' 48V: бензиновая схема по настройке пользователя; классификация по документам не проверена.':''}${c.note?'\n'+c.note:''}`,
 filename:'BMW-Import-'+String(q.id).replace(/[^a-zA-Z0-9-]/g,'').slice(0,40)+'.png'};
}
// Shared content and colors for the screen, print and raster document.
export const documentPalette = {ink:'#172239',secondary:'#52637a',accent:'#315edb',surface:'#f4f6fa',line:'#e2e7ef',paper:'#ffffff'};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function proposalHTML(q) {
 const d=shareContent(q),e=escapeHTML;
 return `<header class="document-brand"><div><strong>${e(d.company)}</strong>${d.contact?`<p>${e(d.contact)}</p>`:''}</div><p>Предложение № ${e(d.number)}<br>${e(d.date)}</p></header>
 <section class="document-intro"><h1>${e(d.title)}</h1><p>${e(d.specs)}</p><div class="document-price"><span>Итоговая цена для клиента</span><strong>${e(d.total)}</strong><small>Предварительный расчёт · с ввозным НДС, доставкой и услугами</small></div></section>
 <section class="document-costs"><h2>Состав стоимости</h2><p class="document-purchase">Стоимость закупки: ${e(d.price)}</p><table><thead><tr><th scope="col">Статья расходов</th><th scope="col">Сумма, ₽</th></tr></thead><tbody>${d.rows.map(row=>`<tr><th scope="row">${e(row.label)}</th><td>${e(row.value)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">Итого для клиента</th><td>${e(d.total)}</td></tr></tfoot></table></section>
 <section class="document-terms"><h2>Курсы и условия расчёта</h2>${d.foot.split('\n').map(line=>`<p>${e(line)}</p>`).join('')}</section>
 <footer class="document-footer"><span>${e(d.jurisdiction)}</span><span>Расчётная база ${e(d.version)}</span></footer>`;
}
// Whitespace wrapping plus grapheme fallback for long names, links and identifiers.
export function wrapText(value, maxWidth, measure) {
 const lines=[];
 const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ru',{granularity:'grapheme'}):null;
 for(const paragraph of String(value).split('\n')) {
  let line='';
  for(const word of paragraph.split(/\s+/).filter(Boolean)) {
   if(line && measure(line+' '+word)<=maxWidth){line+=' '+word;continue;}
   if(line){lines.push(line);line='';}
   if(measure(word)<=maxWidth){line=word;continue;}
   for(const char of segmenter?[...segmenter.segment(word)].map(s=>s.segment):Array.from(word)) {
    if(line && measure(line+char)>maxWidth){lines.push(line);line='';}
    line+=char;
   }
  }
  lines.push(line);
 }
 return lines;
}
export function renderShareImage(q) {
 const d=shareContent(q),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 if(!ctx)throw Error('Не удалось подготовить изображение. Используйте PDF.');
 const c=documentPalette,W=1440,M=72,inner=W-M*2,blocks=[];let y=64;
 function text(value,x,width,size=26,color=c.ink,bold=false,gap=16,right=false) {
  const font=`${bold?'600':'400'} ${size}px -apple-system, BlinkMacSystemFont, Arial, sans-serif`;
  ctx.font=font;const lines=wrapText(value,width,t=>ctx.measureText(t).width);
  blocks.push({kind:'text',lines,x,y,width,size,color,font,right});y+=lines.length*size*1.4+gap;
 }
 function box(x,top,w,h,color,radius=0){blocks.push({kind:'box',x,y:top,w,h,color,radius});}
 text(d.company,M,inner,28,c.ink,true,8);
 if(d.contact)text(d.contact,M,inner,24,c.secondary,false,12);
 text(`Предложение № ${d.number} · ${d.date}`,M,inner,24,c.secondary,false,24);
 box(M,y,inner,2,c.line);y+=32;
 text(d.title,M,inner,46,c.ink,true,12);text(d.specs,M,inner,26,c.secondary,false,28);
 const priceTop=y;const priceBox={kind:'box',x:M,y,w:inner,h:0,color:c.surface,radius:20};blocks.push(priceBox);y+=28;
 text('Итоговая цена для клиента',M+32,inner-64,26,c.secondary,false,6);
 text(d.total,M+32,inner-64,56,c.ink,true,12);
 text('Предварительный расчёт · с ввозным НДС, доставкой и услугами',M+32,inner-64,24,c.secondary,false,28);
 priceBox.h=y-priceTop;y+=32;
 text('Состав стоимости',M,inner,30,c.ink,true,8);
 text(`Стоимость закупки: ${d.price}`,M,inner,24,c.secondary,false,24);
 function row(label,value,bold=false) {
  const top=y;const labelWidth=inner*.57,amountX=M+inner*.62,amountWidth=inner*.38;
  text(label,M,labelWidth,26,c.ink,bold,0);const labelBottom=y;y=top;
  text(value,amountX,amountWidth,26,c.ink,bold,0,true);y=Math.max(y,labelBottom)+22;
  box(M,y-8,inner,1,c.line);
 }
 for(const r of d.rows)row(r.label,r.value);
 y+=8;row('Итого для клиента',d.total,true);y+=24;
 text('Курсы и условия расчёта',M,inner,28,c.ink,true,12);
 text(d.foot,M,inner,24,c.secondary,false,24);
 box(M,y,inner,2,c.line);y+=24;
 text(d.jurisdiction,M,inner,23,c.secondary,false,6);
 text(`Расчётная база ${d.version}`,M,inner,23,c.secondary,false,40);
 if(y>24000)throw Error('Предложение слишком длинное для PNG. Сохраните PDF.');
 canvas.width=W;canvas.height=Math.ceil(y);ctx.fillStyle=c.paper;ctx.fillRect(0,0,W,canvas.height);
 for(const b of blocks){ctx.fillStyle=b.color;if(b.kind==='box'){ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,b.radius);ctx.fill();}else{ctx.font=b.font;ctx.textBaseline='top';b.lines.forEach((line,j)=>ctx.fillText(line,b.right?b.x+b.width-ctx.measureText(line).width:b.x,b.y+j*b.size*1.4));}}
 const dataURL=canvas.toDataURL('image/png');if(dataURL==='data:,')throw Error('Не удалось создать PNG. Используйте PDF.');
 return {dataURL,filename:d.filename};
}
