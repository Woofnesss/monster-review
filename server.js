const express=require('express'),http=require('http'),{Server}=require('socket.io');
const app=express(),srv=http.createServer(app),io=new Server(srv);
app.use(express.static('public'));
const QR=require('qrcode'),fs=require('fs'),path=require('path');
function manifest(){const m={frames:{},fps:{},audio:{}},root=path.join(__dirname,'public','assets');
 (function walk(d){let es;try{es=fs.readdirSync(d,{withFileTypes:true})}catch(e){return}
  for(const e of es){const f=path.join(d,e.name);if(e.isDirectory()){walk(f);continue}
   const rel=path.relative(root,f).split(path.sep),dir=rel.slice(0,-1).join('/'),b=e.name,ext=path.extname(b).slice(1).toLowerCase(),stem=b.slice(0,b.length-ext.length-1),url=encodeURI('/assets/'+rel.join('/'));
   if(b.toLowerCase()=='fps.txt'){m.fps[dir]={};fs.readFileSync(f,'utf8').split(/\r?\n/).forEach(l=>{const[a,n]=l.trim().split(/\s+/);if(a&&+n>0)m.fps[dir][a]=+n})}
   else if(['png','webp','jpg','jpeg','gif'].includes(ext)){const mt=stem.match(/^(.*?)[_-]?(\d+)$/);if(!mt)continue;let a=mt[1]||'frame',d=dir;
    if(a=='frame'&&rel.length>=3){a=rel[rel.length-2].toLowerCase();d=rel.slice(0,-2).join('/')}
    (m.frames[d]=m.frames[d]||{});(m.frames[d][a]=m.frames[d][a]||[]).push([+mt[2],url])}
   else if(['mp3','ogg','wav','m4a'].includes(ext))m.audio[dir+'/'+stem]=url}})(root);
 for(const d in m.frames)for(const a in m.frames[d])m.frames[d][a]=m.frames[d][a].sort((x,y)=>x[0]-y[0]).map(v=>v[1]);
 return m}
app.get('/assets.json',(q,r)=>r.json(manifest()));
app.get('/qr.svg',async(q,r)=>{try{r.type('image/svg+xml').send(await QR.toString(String(q.query.u||'').slice(0,300),{type:'svg',margin:1}))}catch(e){r.status(400).end()}});
const Q=require('./questions.json'),TAGS=[...new Set(Q.map(q=>q.tag))];
const COLORS=['#ff6b6b','#4dabf7','#51cf66','#fcc419','#cc5de8','#ff922b','#20c997','#f06595'];
const NAMES=['Blobbers','Gloopies','Munchers','Squishies','Chompers','Wobblers','Slimers','Gulpers'];
// ---- tweakable rules ----
const START_MASS=10,GAIN=2,LOSS_PCT=0.1,MIN_MASS=6,FAIL_KEEP=0.8,VOTE_SECS=20,COUNTDOWN=3,MS=+process.env.MS_PER_MIN||60000;
let G={phase:'setup',teams:[],players:{},cfg:null,count:0,pool:[],endAt:0,timeUp:false,base:null,round:-1,out:[],score:{},tc:{},rr:[]};
const mk=()=>Array.from({length:G.cfg.teams},(_,i)=>({id:i+1,name:NAMES[i],color:COLORS[i],mass:START_MASS,eats:0,eating:false,votes:{},done:{},members:[]}));
const cnt=(t,id)=>Math.min(t.done[id]||0,G.cfg.quota);
const tm=sid=>{const p=G.players[sid];return p&&G.teams.find(t=>t.id==p.team)};
const board=()=>G.base.map(b=>({id:b.id,name:b.name,color:b.color,pts:G.score[b.id]||0,gain:(G.rr.find(r=>r.id==b.id)||{}).pts||0,tc:G.tc[b.id]||0})).sort((a,b)=>b.pts-a.pts||b.tc-a.tc);
const send=()=>io.emit('state',{timeUp:G.timeUp,round:G.round,left:G.phase=='playing'?Math.max(0,Math.round((G.endAt-Date.now())/1000)):0,
 phase:G.phase,count:G.count,np:Object.keys(G.players).length,tags:TAGS,cfg:G.cfg,board:(G.phase=='results'||G.phase=='final')?board():null,
 teams:G.teams.map(t=>({id:t.id,name:t.name,color:t.color,mass:t.mass,ev:t.eats,eating:t.eating,votes:t.votes,n:t.members.length,ids:t.members,names:t.members.map(i=>G.players[i].name),done:t.done,
  need:t.members.length*G.cfg.quota,prog:t.members.reduce((a,i)=>a+cnt(t,i),0),fin:t.members.filter(i=>cnt(t,i)>=G.cfg.quota).length}))});
function clean(){clearTimeout(G.endTimer);G.teams.forEach(t=>clearTimeout(t.timer));G.teams=[];G.base=null;G.round=-1;G.out=[];G.score={};G.tc={};G.rr=[];G.timeUp=false;
 Object.values(G.players).forEach(p=>p.team=null)}
function leave(id){const t=tm(id);if(t){t.members=t.members.filter(i=>i!=id);delete t.votes[id];delete t.done[id]}if(G.players[id])G.players[id].team=null}
function place(id){const free=G.teams.filter(t=>t.members.length<G.cfg.slots),L=free.length?free:G.teams;
 const t=L.reduce((a,b)=>b.members.length<a.members.length?b:a);t.members.push(id);G.players[id].team=t.id;
 if(G.base){const b=G.base.find(b=>b.id==t.id);if(b)b.members.push(id)}io.to(id).emit('you',t.id)}
function startRound(){G.round++;G.out=[];G.rr=[];G.timeUp=false;
 G.teams=G.base.map(b=>({id:b.id,name:b.name,color:b.color,mass:START_MASS,eats:0,eating:false,votes:{},done:{},members:[...b.members]}));
 G.base.forEach(b=>b.members.forEach(id=>{G.players[id].team=b.id;io.to(id).emit('you',b.id);io.to(id).emit('orig',b.id)}));
 const all=Q.map((q,i)=>i),p=all.filter(i=>Q[i].tag==G.cfg.rounds[G.round]);G.pool=p.length?p:all;
 G.phase='countdown';G.count=COUNTDOWN;send();
 const iv=setInterval(()=>{G.count--;if(G.count<=0){clearInterval(iv);G.phase='playing';G.endAt=Date.now()+G.cfg.mins*MS;G.endTimer=setTimeout(()=>endRound(true),G.cfg.mins*MS)}send()},1000)}
function endRound(timeUp){if(G.phase!='playing')return;clearTimeout(G.endTimer);G.teams.forEach(t=>clearTimeout(t.timer));
 const order=[...G.teams.slice().sort((a,b)=>b.mass-a.mass).map(t=>t.id),...G.out.slice().reverse()],N=order.length;
 G.rr=order.map((id,i)=>({id,pts:N-i}));G.rr.forEach(r=>G.score[r.id]=(G.score[r.id]||0)+r.pts);
 G.timeUp=timeUp;G.phase=G.round+1>=G.cfg.rounds.length?'final':'results';send()}
function chk(t){if(t.eating||G.phase!='playing'||!t.members.length)return;
 if(t.members.every(i=>cnt(t,i)>=G.cfg.quota)){t.eating=true;t.votes={};t.timer=setTimeout(()=>resolve(t),VOTE_SECS*1000)}}
function resolve(t){if(!t.eating||G.phase!='playing'||!G.teams.includes(t))return;clearTimeout(t.timer);
 const others=G.teams.filter(x=>x!==t);if(!others.length)return;
 const tally={};Object.values(t.votes).forEach(v=>{if(others.find(o=>o.id==v))tally[v]=(tally[v]||0)+1});
 const mx=Math.max(0,...Object.values(tally));let best=Object.keys(tally).filter(k=>tally[k]==mx);
 if(!best.length)best=others.map(o=>String(o.id));
 const p=others.find(o=>o.id==best[Math.floor(Math.random()*best.length)]),win=t.mass>=p.mass;
 io.emit('eat',{h:t.id,p:p.id,win,hn:t.name,pn:p.name});
 t.eating=false;t.done={};t.votes={};
 if(win){clearTimeout(p.timer);t.mass+=p.mass;t.eats+=1+p.eats;p.members.forEach(id=>{t.members.push(id);G.players[id].team=t.id;io.to(id).emit('you',t.id)});
  G.teams=G.teams.filter(x=>x!==p);G.out.push(p.id);if(G.teams.length==1)setTimeout(()=>endRound(false),3000)}
 else t.mass=Math.max(MIN_MASS,Math.round(t.mass*FAIL_KEEP));
 send()}
io.on('connection',s=>{
 s.on('host',send);
 s.on('config',c=>{if(G.phase!='setup')return;
  const n=Math.max(2,Math.min(8,+c.teams||4)),sl=Math.max(1,Math.min(10,+c.slots||4)),qt=Math.max(1,Math.min(5,+c.quota||2)),mn=Math.max(2,Math.min(20,+c.mins||8));
  const rounds=(Array.isArray(c.rounds)?c.rounds:[]).filter(x=>TAGS.includes(x)).slice(0,6);
  G.cfg={teams:n,slots:sl,quota:qt,mins:mn,rounds:rounds.length?rounds:[TAGS[0]]};
  G.teams=mk();G.phase='lobby';send()});
 s.on('join',n=>{G.players[s.id]={name:String(n).replace(/[<>&"]/g,'').slice(0,16),team:null};
  if(G.phase=='countdown'||G.phase=='playing')place(s.id);send()});
 s.on('pick',id=>{const p=G.players[s.id],t=G.teams.find(x=>x.id==id);
  if(!p||G.phase!='lobby'||!t||p.team==id||t.members.length>=G.cfg.slots)return;
  leave(s.id);t.members.push(s.id);p.team=id;s.emit('you',id);send()});
 s.on('start',()=>{if(G.phase!='lobby')return;
  Object.keys(G.players).filter(id=>G.players[id].team==null).forEach(place);
  G.base=G.teams.map(t=>({id:t.id,name:t.name,color:t.color,members:[...t.members]}));G.score={};G.tc={};G.round=-1;startRound()});
 s.on('nextround',()=>{if(G.phase=='results')startRound()});
 s.on('again',()=>{if(G.phase!='final')return;clean();G.teams=mk();G.phase='lobby';io.emit('you',null);send()});
 s.on('reset',()=>{clean();G.phase='setup';send()});
 s.on('next',()=>{const t=tm(s.id);if(!t||t.eating||G.phase!='playing'||cnt(t,s.id)>=G.cfg.quota)return;
  const i=G.pool[Math.floor(Math.random()*G.pool.length)];s.emit('q',{id:i,q:Q[i].q,o:Q[i].o})});
 s.on('ans',({id,c})=>{const t=tm(s.id);if(!t||t.eating||G.phase!='playing'||!Q[id]||cnt(t,s.id)>=G.cfg.quota)return;const ok=c==Q[id].a;
  if(ok){t.mass+=GAIN;t.done[s.id]=cnt(t,s.id)+1;const b=G.base&&G.base.find(b=>b.members.includes(s.id));if(b)G.tc[b.id]=(G.tc[b.id]||0)+1;chk(t)}
  else t.mass=Math.max(MIN_MASS,Math.round(t.mass*(1-LOSS_PCT)*10)/10);
  io.emit('fx',{t:t.id,k:ok?'ok':'no'});s.emit('res',{ok,a:Q[id].o[Q[id].a]});send()});
 s.on('vote',id=>{const t=tm(s.id);if(!t||!t.eating)return;t.votes[s.id]=id;
  if(Object.keys(t.votes).length>=t.members.length)resolve(t);else send()});
 s.on('disconnect',()=>{const t=tm(s.id);leave(s.id);delete G.players[s.id];if(G.base)G.base.forEach(b=>b.members=b.members.filter(i=>i!=s.id));
  if(t&&G.teams.includes(t)){chk(t);if(t.eating&&t.members.length&&Object.keys(t.votes).length>=t.members.length)resolve(t)}send()});
});
srv.listen(process.env.PORT||3000,()=>console.log('Host screen: http://localhost:3000/host.html'));
