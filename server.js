const express=require('express'),http=require('http'),{Server}=require('socket.io');
const app=express(),srv=http.createServer(app),io=new Server(srv);
app.use(express.static('public'));
const QR=require('qrcode');
app.get('/qr.svg',async(q,r)=>{try{r.type('image/svg+xml').send(await QR.toString(String(q.query.u||'').slice(0,300),{type:'svg',margin:1}))}catch(e){r.status(400).end()}});
const Q=require('./questions.json'),TAGS=[...new Set(Q.map(q=>q.tag))];
const COLORS=['#ff6b6b','#4dabf7','#51cf66','#fcc419','#cc5de8','#ff922b','#20c997','#f06595'];
const NAMES=['Blobbers','Gloopies','Munchers','Squishies','Chompers','Wobblers','Slimers','Gulpers'];
// ---- tweakable rules ----
const START_MASS=10,GAIN=2,LOSS_PCT=0.1,MIN_MASS=6,FAIL_KEEP=0.8,VOTE_SECS=20,COUNTDOWN=3;
let G={phase:'setup',teams:[],players:{},cfg:null,count:0,pool:[]};
const cnt=(t,id)=>Math.min(t.done[id]||0,G.cfg.quota);
const tm=sid=>{const p=G.players[sid];return p&&G.teams.find(t=>t.id==p.team)};
const send=()=>io.emit('state',{phase:G.phase,count:G.count,np:Object.keys(G.players).length,tags:TAGS,cfg:G.cfg,
 teams:G.teams.map(t=>({id:t.id,name:t.name,color:t.color,mass:t.mass,eating:t.eating,votes:t.votes,n:t.members.length,ids:t.members,names:t.members.map(i=>G.players[i].name),done:t.done,
  need:t.members.length*G.cfg.quota,prog:t.members.reduce((a,i)=>a+cnt(t,i),0),fin:t.members.filter(i=>cnt(t,i)>=G.cfg.quota).length}))});
function leave(id){const t=tm(id);if(t){t.members=t.members.filter(i=>i!=id);delete t.votes[id];delete t.done[id]}if(G.players[id])G.players[id].team=null}
function place(id){const free=G.teams.filter(t=>t.members.length<G.cfg.slots),L=free.length?free:G.teams;
 const t=L.reduce((a,b)=>b.members.length<a.members.length?b:a);t.members.push(id);G.players[id].team=t.id;io.to(id).emit('you',t.id)}
function chk(t){if(t.eating||G.phase!='playing'||!t.members.length)return;
 if(t.members.every(i=>cnt(t,i)>=G.cfg.quota)){t.eating=true;t.votes={};t.timer=setTimeout(()=>resolve(t),VOTE_SECS*1000)}}
function resolve(t){if(!t.eating||!G.teams.includes(t))return;clearTimeout(t.timer);
 const others=G.teams.filter(x=>x!==t);if(!others.length)return;
 const tally={};Object.values(t.votes).forEach(v=>{if(others.find(o=>o.id==v))tally[v]=(tally[v]||0)+1});
 const mx=Math.max(0,...Object.values(tally));let best=Object.keys(tally).filter(k=>tally[k]==mx);
 if(!best.length)best=others.map(o=>String(o.id));
 const p=others.find(o=>o.id==best[Math.floor(Math.random()*best.length)]),win=t.mass>=p.mass;
 io.emit('eat',{h:t.id,p:p.id,win,hn:t.name,pn:p.name});
 t.eating=false;t.done={};t.votes={};
 if(win){clearTimeout(p.timer);t.mass+=p.mass;p.members.forEach(id=>{t.members.push(id);G.players[id].team=t.id;io.to(id).emit('you',t.id)});
  G.teams=G.teams.filter(x=>x!==p);if(G.teams.length==1)G.phase='done'}
 else t.mass=Math.max(MIN_MASS,Math.round(t.mass*FAIL_KEEP));
 send()}
io.on('connection',s=>{
 s.on('host',send);
 s.on('config',c=>{if(G.phase!='setup')return;
  const n=Math.max(2,Math.min(8,+c.teams||4)),sl=Math.max(1,Math.min(10,+c.slots||4)),qt=Math.max(1,Math.min(5,+c.quota||2));
  const tags=(c.tags||[]).filter(x=>TAGS.includes(x));
  G.cfg={teams:n,slots:sl,quota:qt,tags:tags.length?tags:TAGS};
  G.pool=Q.map((q,i)=>i).filter(i=>G.cfg.tags.includes(Q[i].tag));
  G.teams=Array.from({length:n},(_,i)=>({id:i+1,name:NAMES[i],color:COLORS[i],mass:START_MASS,progress:0,eating:false,votes:{},done:{},members:[]}));
  G.phase='lobby';send()});
 s.on('join',n=>{G.players[s.id]={name:String(n).replace(/[<>&"]/g,'').slice(0,16),team:null};
  if(G.phase=='countdown'||G.phase=='playing')place(s.id);send()});
 s.on('pick',id=>{const p=G.players[s.id],t=G.teams.find(x=>x.id==id);
  if(!p||G.phase!='lobby'||!t||p.team==id||t.members.length>=G.cfg.slots)return;
  leave(s.id);t.members.push(s.id);p.team=id;s.emit('you',id);send()});
 s.on('start',()=>{if(G.phase!='lobby')return;
  Object.keys(G.players).filter(id=>G.players[id].team==null).forEach(place);
  G.phase='countdown';G.count=COUNTDOWN;send();
  const iv=setInterval(()=>{G.count--;if(G.count<=0){clearInterval(iv);G.phase='playing'}send()},1000)});
 s.on('reset',()=>{G.teams.forEach(t=>clearTimeout(t.timer));G.phase='setup';G.teams=[];
  Object.values(G.players).forEach(p=>p.team=null);send()});
 s.on('next',()=>{const t=tm(s.id);if(!t||t.eating||G.phase!='playing'||cnt(t,s.id)>=G.cfg.quota)return;
  const i=G.pool[Math.floor(Math.random()*G.pool.length)];s.emit('q',{id:i,q:Q[i].q,o:Q[i].o})});
 s.on('ans',({id,c})=>{const t=tm(s.id);if(!t||t.eating||G.phase!='playing'||!Q[id]||cnt(t,s.id)>=G.cfg.quota)return;const ok=c==Q[id].a;
  if(ok){t.mass+=GAIN;t.done[s.id]=cnt(t,s.id)+1;chk(t)}else t.mass=Math.max(MIN_MASS,Math.round(t.mass*(1-LOSS_PCT)*10)/10);
  s.emit('res',{ok,a:Q[id].o[Q[id].a]});send()});
 s.on('vote',id=>{const t=tm(s.id);if(!t||!t.eating)return;t.votes[s.id]=id;
  if(Object.keys(t.votes).length>=t.members.length)resolve(t);else send()});
 s.on('disconnect',()=>{const t=tm(s.id);leave(s.id);delete G.players[s.id];
  if(t&&G.teams.includes(t)){chk(t);if(t.eating&&t.members.length&&Object.keys(t.votes).length>=t.members.length)resolve(t)}send()});
});
srv.listen(process.env.PORT||3000,()=>console.log('Host screen: http://localhost:3000/host.html'));
