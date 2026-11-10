const express=require('express'),http=require('http'),{Server}=require('socket.io');
const app=express(),srv=http.createServer(app),io=new Server(srv);
app.use(express.static('public'));
const Q=require('./questions.json');
const COLORS=['#ff6b6b','#4dabf7','#51cf66','#fcc419','#cc5de8','#ff922b','#20c997','#f06595'];
const NAMES=['Blobbers','Gloopies','Munchers','Squishies','Chompers','Wobblers','Slimers','Gulpers'];
// ---- tweakable rules ----
const START_MASS=10, GAIN=2, LOSS=1, MIN_MASS=6, BASE_TARGET=5, FAIL_KEEP=0.8;
const target=t=>Math.max(BASE_TARGET,t.members.length);
let G={phase:'lobby',teams:[],players:{}};
const tm=sid=>{const p=G.players[sid];return p&&G.teams.find(t=>t.id==p.team)};
const send=()=>io.emit('state',{phase:G.phase,np:Object.keys(G.players).length,
 teams:G.teams.map(t=>({id:t.id,name:t.name,color:t.color,mass:t.mass,progress:t.progress,target:target(t),hunting:t.hunting,n:t.members.length}))});
function place(id){const t=G.teams.reduce((a,b)=>b.members.length<a.members.length?b:a);
 t.members.push(id);G.players[id].team=t.id;io.to(id).emit('you',t.id)}
io.on('connection',s=>{
 s.on('host',send);
 s.on('join',n=>{G.players[s.id]={name:String(n).slice(0,16),team:null};if(G.phase=='playing')place(s.id);send()});
 s.on('start',n=>{const ids=Object.keys(G.players).sort(()=>Math.random()-.5);
  G.teams=Array.from({length:Math.max(2,Math.min(+n||4,ids.length))},(_,i)=>({id:i+1,name:NAMES[i%8],color:COLORS[i%8],mass:START_MASS,progress:0,hunting:false,members:[]}));
  G.phase='playing';ids.forEach(place);send()});
 s.on('reset',()=>{G.phase='lobby';G.teams=[];Object.values(G.players).forEach(p=>p.team=null);send()});
 s.on('next',()=>{const t=tm(s.id);if(!t||t.hunting||G.phase!='playing')return;
  const i=Math.floor(Math.random()*Q.length);s.emit('q',{id:i,q:Q[i].q,o:Q[i].o})});
 s.on('ans',({id,c})=>{const t=tm(s.id);if(!t||t.hunting||!Q[id])return;const ok=c==Q[id].a;
  if(ok){t.mass+=GAIN;t.progress++;if(t.progress>=target(t))t.hunting=true}else t.mass=Math.max(MIN_MASS,t.mass-LOSS);
  s.emit('res',{ok,a:Q[id].o[Q[id].a]});send()});
 s.on('hunt',pid=>{const t=tm(s.id),p=G.teams.find(x=>x.id==pid);if(!t||!t.hunting||!p||p===t)return;
  const win=t.mass>=p.mass;io.emit('eat',{h:t.id,p:p.id,win,hn:t.name,pn:p.name});
  t.hunting=false;t.progress=0;
  if(win){t.mass+=p.mass;p.members.forEach(id=>{t.members.push(id);G.players[id].team=t.id;io.to(id).emit('you',t.id)});
   G.teams=G.teams.filter(x=>x!==p);if(G.teams.length==1)G.phase='done'}
  else t.mass=Math.max(MIN_MASS,Math.round(t.mass*FAIL_KEEP));
  send()});
 s.on('disconnect',()=>{const p=G.players[s.id];if(!p)return;const t=G.teams.find(t=>t.id==p.team);
  if(t)t.members=t.members.filter(i=>i!=s.id);delete G.players[s.id];send()});
});
srv.listen(process.env.PORT||3000,()=>console.log('Host screen: http://localhost:3000/host.html'));
