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
 price:n(i.price)+' ¥',rows,total:rub(r.total),
 foot:`Курс покупки: 1 CNY = ${n(i.buyRate)} RUB. Официальный курс CNY: ${n(i.cny)} RUB на ${date(i.rateDate)}.${r.rule?.minEur?` EUR: ${n(i.eur)} RUB.`:''}\nПредварительная оценка. Окончательные платежи определяются при таможенном оформлении. НДС в таблице — ввозной НДС. Предложение не является счётом-фактурой.${i.productionPrecision==='month'?' Для расчёта возраста принят условный день — 15-е.':''}${i.type==='mild48'?' 48V: бензиновая схема по настройке пользователя; классификация по документам не проверена.':''}${c.note?'\n'+c.note:''}`,
 filename:'BMW-Import-'+String(q.id).replace(/[^a-zA-Z0-9-]/g,'').slice(0,40)+'.png'};
}
export function renderShareImage(q) {
 const d=shareContent(q),canvas=document.createElement('canvas');
 canvas.width=1440;const ctx=canvas.getContext('2d');
 const blocks=[];let y=56;
 function text(value,x,width,size=24,color='#18263f',bold=false,gap=14){
  const font=`${bold?'600':'400'} ${size}px -apple-system, BlinkMacSystemFont, Arial, sans-serif`;
  ctx.font=font;const lines=[];
  for(const paragraph of String(value).split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>width&&line){lines.push(line);line=word;}else line=next;}lines.push(line);}
  blocks.push({kind:'text',lines,x,y,size,color,font,right:x===970});y+=lines.length*size*1.45+gap;
 }
 function box(x,top,w,h,color){blocks.push({kind:'box',x,y:top,w,h,color});}
 text(d.company,56,1328,24,'#18263f',true,6);
 if(d.contact)text(d.contact,56,1328,20,'#72839b');
 text(`ПРЕДЛОЖЕНИЕ № ${d.number} · ${d.date}`,56,1328,18,'#72839b',false,30);
 const top=y;box(36,top-20,1368,1,'#eef3fa');const b=blocks[blocks.length-1];
 text(d.title,80,1250,40,'#18263f',true,12);text(d.specs,80,1250,23,'#72839b',false,12);text(d.price,80,1250,30,'#18263f',true,30);b.h=y-top+10;y+=30;
 text('СОСТАВ СТОИМОСТИ',36,800,18,'#8996aa',true,14);
 for(const row of d.rows){const ry=y;text(row.label,36,850,24,'#18263f',false,0);const h=y-ry;y=ry;text(row.value,970,434,24,'#18263f',false,0);y=ry+Math.max(h,y-ry)+22;box(36,y-8,1368,1,'#e1e7ef');}
 y+=24;box(36,y,1368,156,'#162c4d');y+=26;text('Итоговая цена для клиента',80,1250,22,'#ffffff',false,2);text(d.total,80,1250,48,'#ffffff',true,36);y+=24;
 text(d.foot,36,1368,20,'#72839b',false,28);
 canvas.height=Math.ceil(y);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
 for(const b of blocks){ctx.fillStyle=b.color;if(b.kind==='box'){ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,Math.min(20,b.h/2));ctx.fill();}else{ctx.font=b.font;ctx.textBaseline='top';b.lines.forEach((line,j)=>ctx.fillText(line,b.right?1404-ctx.measureText(line).width:b.x,b.y+j*b.size*1.45));}}
 return {dataURL:canvas.toDataURL('image/png'),filename:d.filename};
}
