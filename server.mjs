import http from 'node:http';
import {readFile,writeFile,mkdir,rename,readdir,link,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {calculate} from './public/engine.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=process.env.BMW_DATA_DIR||path.join(root,'data');await mkdir(path.join(data,'quotes'),{recursive:true});
const catalog=JSON.parse(await readFile(path.join(root,'public/catalog.json'),'utf8'));
const tariff=JSON.parse(await readFile(path.join(root,'public/rates.json'),'utf8'));
import {APP_VERSION} from './public/version.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const port=Number(process.env.BMW_PORT||8765),host='127.0.0.1';
async function atomic(file,value,exclusive=false){
 const temp=file+'.'+randomUUID()+'.tmp';
 try{await writeFile(temp,JSON.stringify(value,null,2),{flag:'wx'});if(exclusive)await link(temp,file);else await rename(temp,file);}
 finally{await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function validQuote(q){return object(q)&&UUID.test(q.id)&&typeof q.createdAt==='string'&&Number.isFinite(Date.parse(q.createdAt))&&object(q.input)&&typeof q.input.vehicleName==='string'&&object(q.result)&&Number.isFinite(q.result.total)&&Array.isArray(q.result.rows)&&q.result.rows.every(r=>object(r)&&typeof r.label==='string'&&Number.isFinite(r.amount))&&object(q.rates)&&object(q.company);}
async function history(folder){
 await mkdir(path.join(data,folder),{recursive:true});const items=[],warnings=[],damagedFiles=[];
 for(const file of (await readdir(path.join(data,folder))).filter(f=>f.endsWith('.json')).sort()){
  let raw;
  try{raw=await readFile(path.join(data,folder,file),'utf8');const q=JSON.parse(raw);if(!validQuote(q)||file!==q.id+'.json')throw Error('Неверная структура расчёта.');items.push(q);}
  catch(e){warnings.push({folder,file,message:e.message});if(raw!==undefined)damagedFiles.push({folder,file,raw});}
 }
 return {items:items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),warnings,damagedFiles};
}
let mutationTail=Promise.resolve();
function mutate(fn){const next=mutationTail.then(fn);mutationTail=next.catch(()=>{});return next;}
async function importBackup(b){
 if(!object(b)||b.format!=='bmw-import-backup'||b.schemaVersion!==1||!Array.isArray(b.quotes)||!Array.isArray(b.trash)||!object(b.settings))throw Error('Неверный формат резервной копии.');
 const entries=[...b.quotes.map(q=>['quotes',q]),...b.trash.map(q=>['trash',q])],ids=new Set();
 for(const [,q] of entries){if(!validQuote(q)||ids.has(q.id))throw Error('Некорректный или повторяющийся ID расчёта.');ids.add(q.id);}
 const damaged=b.damagedFiles||[];
 if(!Array.isArray(damaged)||damaged.some(x=>!object(x)||!['quotes','trash'].includes(x.folder)||typeof x.file!=='string'||!x.file.endsWith('.json')||path.basename(x.file)!==x.file||typeof x.raw!=='string'))throw Error('Неверный формат повреждённых файлов.');
 for(const folder of ['quotes','trash']){await mkdir(path.join(data,folder),{recursive:true});const existing=new Set(await readdir(path.join(data,folder)));for(const id of ids)if(existing.has(id+'.json')){const e=Error('Расчёт с таким ID уже существует: '+id);e.status=409;throw e;}}
 const written=[];let settingsImported=false;
 try{
  for(const [folder,q] of entries){const file=path.join(data,folder,q.id+'.json');await atomic(file,q,true);written.push(file);}
  try{const file=path.join(data,'settings.json');await atomic(file,b.settings,true);written.push(file);settingsImported=true;}catch(e){if(e.code!=='EEXIST')throw e;}
  // Preserve damaged source material separately; never expose it as a valid quote.
  if(damaged.length){const file=path.join(data,'recovery-'+randomUUID()+'.json');await atomic(file,damaged,true);written.push(file);}
 }catch(e){await Promise.all(written.map(file=>unlink(file)));throw e;}
 return {ok:true,imported:entries.length,settingsImported,recoveredFiles:damaged.length};
}
async function readJSON(file,defaultValue){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return defaultValue;throw e;}}
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function body(req,limit=2000000){let text='';for await(const c of req){text+=c;if(Buffer.byteLength(text)>limit)throw Error('Слишком большой запрос.');}return JSON.parse(text);}
function isoDate(date){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;}
async function currency(date){
 if(!isoDate(date))throw Error('Некорректная дата курса.');
 const [y,m,d]=date.split('-');
 const url=`https://www.cbr.ru/scripts/XML_daily.asp?date_req=${d}/${m}/${y}`;
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('ЦБ временно недоступен.');
 const xml=new TextDecoder('windows-1251').decode(await response.arrayBuffer());
 const stamp=xml.match(/<ValCurs[^>]*Date="(\d{2})\.(\d{2})\.(\d{4})"/);
 if(!stamp)throw Error('Не удалось прочитать дату ЦБ.');
 const result={source:'Банк России',sourceUrl:url,date:`${stamp[3]}-${stamp[2]}-${stamp[1]}`,requestedDate:date,fetchedAt:new Date().toISOString(),cached:false};
 for(const code of ['CNY','EUR']){
  const block=[...xml.matchAll(/<Valute\b[^>]*>([\s\S]*?)<\/Valute>/g)].map(m=>m[1]).find(b=>b.includes(`<CharCode>${code}</CharCode>`));
  const value=Number(block?.match(/<Value>([^<]+)<\/Value>/)?.[1].replace(',','.'));
  const nominal=Number(block?.match(/<Nominal>([^<]+)<\/Nominal>/)?.[1]);
  if(!Number.isFinite(value)||value<=0||!Number.isFinite(nominal)||nominal<=0)throw Error('В ответе ЦБ отсутствует курс '+code);
  result[code]=value/nominal;
 }
 await atomic(path.join(data,'rates-'+date+'.json'),result);return result;
}
const server=http.createServer(async(req,res)=>{
 try{
  const actualPort=server.address().port;const expected=new Set([`127.0.0.1:${actualPort}`,`localhost:${actualPort}`]);
  if(!expected.has(req.headers.host)){send(res,403,{error:'Недопустимый адрес.'});return;}
  if(req.headers.origin&&!expected.has(new URL(req.headers.origin).host)){send(res,403,{error:'Недопустимый источник.'});return;}
  const u=new URL(req.url,`http://${host}:${port}`);
  if(u.pathname==='/api/health'){send(res,200,{app:'bmw-import',version:APP_VERSION});return;}
  if(u.pathname==='/api/rates'&&req.method==='GET'){
   const date=u.searchParams.get('date')||new Date().toISOString().slice(0,10);
   if(!isoDate(date)){send(res,400,{error:'Некорректная дата курса.'});return;}
   try{send(res,200,await currency(date));}catch(e){const cache=await readJSON(path.join(data,'rates-'+date+'.json'),null);if(cache)send(res,200,{...cache,cached:true,error:'ЦБ недоступен: использован сохранённый курс.'});else send(res,503,{error:'Не удалось получить курс ЦБ. Введите официальный курс вручную и укажите дату.'});}return;
  }
  const quoteAction=u.pathname.match(/^\/api\/quotes\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(\/restore)?$/);
  if(quoteAction && ((req.method==='DELETE'&&!quoteAction[2])||(req.method==='POST'&&quoteAction[2]))){
   const restore=!!quoteAction[2],name=quoteAction[1]+'.json';
   await mkdir(path.join(data,'trash'),{recursive:true});
   await mutate(async()=>{const source=path.join(data,restore?'trash':'quotes',name),target=path.join(data,restore?'quotes':'trash',name);await link(source,target);await unlink(source);});
   send(res,200,{ok:true});return;
  }
  if((u.pathname==='/api/quotes'||u.pathname==='/api/history/warnings')&&req.method==='GET'){
   const result=await history(u.searchParams.get('trash')==='1'?'trash':'quotes');
   res.setHeader('X-BMW-History-Warnings',String(result.warnings.length));
   send(res,200,u.pathname==='/api/quotes'?result.items:result.warnings);return;
  }
  if(u.pathname==='/api/backup'&&req.method==='GET'){
   const backup=await mutate(async()=>{
    const saved=await history('quotes'),trash=await history('trash');
    return {format:'bmw-import-backup',schemaVersion:1,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),quotes:saved.items,trash:trash.items,settings:await readJSON(path.join(data,'settings.json'),{}),warnings:[...saved.warnings,...trash.warnings],damagedFiles:[...saved.damagedFiles,...trash.damagedFiles]};
   });send(res,200,backup);return;
  }
  if(u.pathname==='/api/backup/import'&&req.method==='POST'){
   const backup=await body(req,50000000);send(res,200,await mutate(()=>importBackup(backup)));return;
  }
  if(u.pathname==='/api/quotes'&&req.method==='POST'){
   const {input,company}=await body(req);const model=catalog.find(m=>m.id===input?.model);const checkedInput={...input,productionFrom:model?.productionFrom||'',productionTo:model?.productionTo||''};const result=calculate(checkedInput,tariff);
   const quote={appVersion:APP_VERSION,id:randomUUID(),createdAt:new Date().toISOString(),input:checkedInput,result,company:company||{},rates:tariff};
   await mutate(()=>atomic(path.join(data,'quotes',quote.id+'.json'),quote,true));send(res,201,quote);return;
  }
  if(u.pathname==='/api/settings'&&req.method==='GET'){send(res,200,await readJSON(path.join(data,'settings.json'),{}));return;}
  if(u.pathname==='/api/settings'&&req.method==='POST'){
   const b=await body(req);const clean={name:String(b.name||'').slice(0,160),contact:String(b.contact||'').slice(0,300),note:String(b.note||'').slice(0,600)};
   await mutate(()=>atomic(path.join(data,'settings.json'),clean));send(res,200,clean);return;
  }
  if(req.method!=='GET'){send(res,405,{error:'Метод не поддерживается.'});return;}
  const name=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));
  if(!/^[a-zA-Z0-9_.-]+$/.test(name)){send(res,404,{error:'Страница не найдена.'});return;}
  const ext=path.extname(name),types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
  if(!types[ext]){send(res,404,{error:'Страница не найдена.'});return;}
  const file=await readFile(path.join(root,'public',name));
  res.writeHead(200,{'Content-Type':types[ext]+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"});res.end(file);
 }catch(e){send(res,e.status||(e.code==='ENOENT'?404:e.code==='EEXIST'?409:400),{error:e.code==='ENOENT'?'Файл не найден.':e.message});}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Порт 8765 занят. Закройте предыдущий запуск или задайте BMW_PORT.':e.message);process.exit(1);});
server.listen(port,host,()=>console.log(`BMW Import: http://${host}:${server.address().port}\nДля остановки нажмите Ctrl+C.`));
