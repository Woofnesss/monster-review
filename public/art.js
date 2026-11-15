// Shared monster drawing for the student page (copy of the host's line-art fill + frame logic)
let MAN={frames:{},fps:{},audio:{},images:{}},NT=6;const BODY=.52,imgs={},LA={},TC=document.createElement('canvas'),T=TC.getContext('2d');TC.width=TC.height=384;
const img=u=>imgs[u]||(imgs[u]=Object.assign(new Image(),{src:u,onerror(){this.bad=1}}));
const shade=(h,k)=>'#'+[1,3,5].map(i=>Math.round(parseInt(h.substr(i,2),16)*k).toString(16).padStart(2,'0')).join('');
function flood(al,N){const ink=new Uint8Array(N*N),lab=new Int32Array(N*N),st=new Int32Array(N*N),sizes=[0],bd=new Set();let n=0;
 for(let i=0;i<N*N;i++)ink[i]=al[i]>40?1:0;
 for(let i=0;i<N*N;i++){if(ink[i]||lab[i])continue;n++;let sp=0,sz=0,tb=false;st[sp++]=i;lab[i]=n;
  while(sp){const j=st[--sp],cx=j%N,cy=(j-cx)/N;sz++;if(cx==0||cy==0||cx==N-1||cy==N-1)tb=true;
   if(cx>0&&!ink[j-1]&&!lab[j-1]){lab[j-1]=n;st[sp++]=j-1}if(cx<N-1&&!ink[j+1]&&!lab[j+1]){lab[j+1]=n;st[sp++]=j+1}
   if(cy>0&&!ink[j-N]&&!lab[j-N]){lab[j-N]=n;st[sp++]=j-N}if(cy<N-1&&!ink[j+N]&&!lab[j+N]){lab[j+N]=n;st[sp++]=j+N}}
  sizes[n]=sz;if(tb)bd.add(n)}
 let bi=0;for(let k=1;k<=n;k++)if(!bd.has(k)&&sizes[k]>(sizes[bi]||0))bi=k;
 if(!bi||sizes[bi]<N*N*.01)return null;
 const body=new Uint8Array(N*N),hole=new Uint8Array(N*N);let any=false;
 for(let i=0;i<N*N;i++){const l=lab[i];if(!l||bd.has(l))continue;if(l==bi||sizes[l]<20)body[i]=1;else{hole[i]=1;any=true}}
 return{body,hole:any?hole:null}}
function maskCv(m,N){const c2=document.createElement('canvas');c2.width=c2.height=N;const g=c2.getContext('2d'),d=g.createImageData(N,N);
 for(let i=0;i<N*N;i++)if(m[i]){d.data[i*4]=d.data[i*4+1]=d.data[i*4+2]=d.data[i*4+3]=255}g.putImageData(d,0,0);return c2}
function lineArt(im){const k=im.src;if(k in LA)return LA[k];const N=384,c2=document.createElement('canvas');c2.width=c2.height=N;const g=c2.getContext('2d');g.drawImage(im,0,0,N,N);
 let d;try{d=g.getImageData(0,0,N,N).data}catch(e){return LA[k]=null}
 const al=new Uint8Array(N*N);let cnt=0,col=0;
 for(let i=0;i<N*N;i++){const a=d[i*4+3];al[i]=a;if(a>128){cnt++;const r=d[i*4],g2=d[i*4+1],b=d[i*4+2];if(Math.max(r,g2,b)-Math.min(r,g2,b)>40)col++}}
 if(!cnt||col>cnt*.02)return LA[k]=null; // coloured art -> hue shift instead
 const f=flood(al,N);return LA[k]={f:f&&{body:maskCv(f.body,N),hole:f.hole&&maskCv(f.hole,N)}}}
function tinted(g,src,col,z){T.globalCompositeOperation='source-over';T.clearRect(0,0,384,384);T.drawImage(src,0,0,384,384);T.globalCompositeOperation='source-in';T.fillStyle=col;T.fillRect(0,0,384,384);g.drawImage(TC,-z/2,-z/2,z,z)}
function frames(tid,form,anim){const F=MAN.frames;for(let f=form;f>=1;f--)for(const d of[`monster/team${tid}/form${f}`,`monster/form${f}`])for(const a of anim=='idle'?['idle']:[anim,'idle'])
 if(F[d]&&F[d][a])return{urls:F[d][a],fps:(MAN.fps[d]||{})[a]||12,anim:a,tint:!d.includes('/team')};return null}
function dur(tid,form,anim){const fr=frames(tid,form,anim);return fr&&fr.anim==anim?fr.urls.length/fr.fps*1000:700}
function artInit(m){MAN=m;for(const d in m.frames)if(d.indexOf('monster')==0)for(const a of['idle','eat','sad'])(m.frames[d][a]||[]).forEach(u=>{const e=img(u);if(e.complete&&e.naturalWidth)lineArt(e);else e.addEventListener('load',()=>lineArt(e))})}
function drawMonster(g,o){const fr=frames(o.tid,o.form,o.anim);let im=null;
 if(fr){const n=fr.urls.length,k=Math.floor(o.t/1000*fr.fps),e=img(fr.urls[fr.anim=='idle'?k%n:Math.min(k,n-1)]);if(e.complete&&e.naturalWidth)im=e;else if(!e.bad)return}
 const sc=o.scale==null?1:o.scale;g.save();g.translate(o.x,o.y);g.rotate(o.rot||0);g.scale(sc,sc);g.globalAlpha=Math.max(0,Math.min(1,sc));
 if(im){const z=o.r*2/BODY,la=fr.tint?lineArt(im):null;g.scale(o.flip<0?-1:1,1);
  if(la){if(la.f){tinted(g,la.f.body,o.color,z);if(la.f.hole)tinted(g,la.f.hole,shade(o.color,.45),z);g.drawImage(im,-z/2,-z/2,z,z)}else tinted(g,im,o.color,z)}
  else{if(fr.tint)g.filter=`hue-rotate(${(o.tid-1)*360/NT}deg)`;g.drawImage(im,-z/2,-z/2,z,z);g.filter='none'}}
 else{g.fillStyle=o.color;g.beginPath();for(let a=0;a<=6.5;a+=.2){const r=o.r*(1+.06*Math.sin(a*5+o.t/300));g[a?'lineTo':'moveTo'](Math.cos(a)*r,Math.sin(a)*r)}g.fill();
  g.fillStyle='#fff';for(const e of[-.3,.3]){g.beginPath();g.arc(e*o.r,-o.r*.2,o.r*.17,0,7);g.fill()}g.fillStyle='#222';for(const e of[-.3,.3]){g.beginPath();g.arc(e*o.r,-o.r*.18,o.r*.08,0,7);g.fill()}}
 g.restore()}
