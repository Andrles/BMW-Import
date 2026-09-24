import http from 'node:http';
import {readFile,writeFile,mkdir,rename,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {calculate} from './public/engine.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=process.env.BMW_DATA_DIR||path.join(root,'data');await mkdir(path.join(data,'quotes'),{recursive:true});
const tariff=JSON.parse(await readFile(path.join(root,'public/rates.json'),'utf8'));
const port=Number(process.env.BMW_PORT||8765),host='127.0.0.1';
async function atomic(file,value){const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value,null,2));await rename(temp,file);}
async function readJSON(file,defaultValue){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return defaultValue;throw e;}}
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
async function body(req){let text='';for await(const c of req){text+=c;if(Buffer.byteLength(text)>2000000)throw Error('Слишком большой запрос.');}return JSON.parse(text);}
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
  const expected=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
  if(!expected.has(req.headers.host)){send(res,403,{error:'Недопустимый адрес.'});return;}
  if(req.headers.origin&&!expected.has(new URL(req.headers.origin).host)){send(res,403,{error:'Недопустимый источник.'});return;}
  const u=new URL(req.url,`http://${host}:${port}`);
  if(u.pathname==='/api/health'){send(res,200,{app:'bmw-import',version:'0.1.0'});return;}
  if(u.pathname==='/api/rates'&&req.method==='GET'){
   const date=u.searchParams.get('date')||new Date().toISOString().slice(0,10);
   if(!isoDate(date)){send(res,400,{error:'Некорректная дата курса.'});return;}
   try{send(res,200,await currency(date));}catch(e){const cache=await readJSON(path.join(data,'rates-'+date+'.json'),null);if(cache)send(res,200,{...cache,cached:true,error:'ЦБ недоступен: использован сохранённый курс.'});else send(res,503,{error:'Не удалось получить курс ЦБ. Введите официальный курс вручную и укажите дату.'});}return;
  }
  const quoteAction=u.pathname.match(/^\/api\/quotes\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(\/restore)?$/);
  if(quoteAction && ((req.method==='DELETE'&&!quoteAction[2])||(req.method==='POST'&&quoteAction[2]))){
   const restore=!!quoteAction[2],name=quoteAction[1]+'.json';
   await mkdir(path.join(data,'trash'),{recursive:true});
   await rename(path.join(data,restore?'trash':'quotes',name),path.join(data,restore?'quotes':'trash',name));
   send(res,200,{ok:true});return;
  }
  if(u.pathname==='/api/quotes'&&req.method==='GET'){
   const folder=u.searchParams.get('trash')==='1'?'trash':'quotes';
   await mkdir(path.join(data,folder),{recursive:true});
   const files=(await readdir(path.join(data,folder))).filter(f=>/^[a-f0-9-]+\.json$/.test(f));
   const items=await Promise.all(files.map(f=>readJSON(path.join(data,folder,f),null)));
   send(res,200,items.filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));return;
  }
  if(u.pathname==='/api/quotes'&&req.method==='POST'){
   const {input,company}=await body(req);const result=calculate(input,tariff);
   const quote={id:randomUUID(),createdAt:new Date().toISOString(),input,result,company:company||{},rates:tariff};
   await atomic(path.join(data,'quotes',quote.id+'.json'),quote);send(res,201,quote);return;
  }
  if(u.pathname==='/api/settings'&&req.method==='GET'){send(res,200,await readJSON(path.join(data,'settings.json'),{}));return;}
  if(u.pathname==='/api/settings'&&req.method==='POST'){
   const b=await body(req);const clean={name:String(b.name||'').slice(0,160),contact:String(b.contact||'').slice(0,300),note:String(b.note||'').slice(0,600)};
   await atomic(path.join(data,'settings.json'),clean);send(res,200,clean);return;
  }
  if(req.method!=='GET'){send(res,405,{error:'Метод не поддерживается.'});return;}
  const name=u.pathname==='/'?'index.html':decodeURIComponent(u.pathname.slice(1));
  if(!/^[a-zA-Z0-9_.-]+$/.test(name)){send(res,404,{error:'Страница не найдена.'});return;}
  const ext=path.extname(name),types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
  if(!types[ext]){send(res,404,{error:'Страница не найдена.'});return;}
  const file=await readFile(path.join(root,'public',name));
  res.writeHead(200,{'Content-Type':types[ext]+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"});res.end(file);
 }catch(e){send(res,e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'Файл не найден.':e.message});}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Порт 8765 занят. Закройте предыдущий запуск или задайте BMW_PORT.':e.message);process.exit(1);});
server.listen(port,host,()=>console.log(`BMW Import: http://${host}:${port}\nДля остановки нажмите Ctrl+C.`));
