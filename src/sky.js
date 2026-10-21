(function skyFactory(global) {
'use strict';
/* Schematic zodiac constellation drawings: illustrative, not celestial coordinates.
   Auto matching uses only domain confidence / declared interest, not astrology. */
const templates=[
['Aries','♈',[[.20,.68],[.37,.53],[.51,.36],[.60,.29],[.70,.37],[.83,.52]]],
['Taurus','♉',[[.12,.19],[.36,.32],[.52,.52],[.75,.30],[.89,.18],[.75,.30],[.83,.69],[.52,.52],[.31,.78],[.36,.32]]],
['Gemini','♊',[[.28,.12],[.34,.40],[.35,.72],[.25,.88],[.35,.72],[.65,.71],[.79,.87],[.65,.71],[.68,.40],[.77,.13],[.68,.40],[.34,.40]]],
['Cancer','♋',[[.20,.24],[.45,.43],[.69,.24],[.45,.43],[.65,.69],[.82,.83],[.65,.69],[.39,.82]]],
['Leo','♌',[[.14,.66],[.30,.55],[.42,.32],[.54,.22],[.67,.34],[.51,.52],[.42,.32],[.30,.55],[.67,.69],[.87,.77]]],
['Virgo','♍',[[.14,.29],[.30,.44],[.47,.31],[.59,.49],[.76,.42],[.88,.64],[.70,.82],[.59,.49],[.43,.75],[.30,.44],[.16,.68]]],
['Libra','♎',[[.20,.35],[.50,.41],[.79,.28],[.50,.41],[.33,.74],[.20,.35],[.33,.74],[.72,.77],[.79,.28]]],
['Scorpius','♏',[[.13,.20],[.29,.30],[.40,.40],[.51,.50],[.62,.61],[.65,.78],[.78,.86],[.89,.69],[.79,.58],[.71,.64]]],
['Sagittarius','♐',[[.18,.78],[.35,.63],[.49,.45],[.70,.19],[.84,.19],[.70,.19],[.79,.35],[.49,.45],[.73,.60],[.51,.81],[.35,.63],[.22,.30],[.49,.45]]],
['Capricornus','♑',[[.12,.35],[.29,.26],[.40,.50],[.56,.73],[.80,.62],[.90,.26],[.80,.62],[.69,.44],[.40,.50],[.12,.35]]],
['Aquarius','♒',[[.17,.17],[.32,.29],[.46,.20],[.60,.31],[.76,.22],[.60,.31],[.52,.53],[.41,.66],[.25,.78],[.52,.53],[.72,.73],[.82,.85]]],
['Pisces','♓',[[.12,.29],[.24,.18],[.37,.25],[.39,.41],[.27,.51],[.43,.60],[.58,.66],[.73,.58],[.87,.67],[.86,.83],[.73,.89],[.62,.80],[.58,.66]]]
];
function resample(points,n) {
 let length=0,segments=[];
 for(let i=1;i<points.length;i++){length+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);segments.push(length)}
 return Array.from({length:n},(_,i)=>{let at=i*length/(n-1),j=segments.findIndex(s=>s>=at);if(j<0)j=segments.length-1;let prior=j?segments[j-1]:0,t=(at-prior)/Math.max(.000001,segments[j]-prior),a=points[j],b=points[j+1];return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]})
}
const patterns=templates.map(t=>resample(t[2],13)),svgNS='http://www.w3.org/2000/svg';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let live=null;
function stop(){if(live){live.dead=true;cancelAnimationFrame(live.raf);live=null}}
function signal(skill,profile){
 let r=profile.surveys?.[skill.id];
 if(r&&Number.isFinite(Number(r.confidence)))return {rated:true,confidence:clamp(Number(r.confidence),0,4),intensity:.16+.20*Number(r.confidence)};
 if(profile.confirmed?.includes(skill.id))return {rated:false,claimed:true,intensity:.38};
 return {rated:false,claimed:false,intensity:.14};
}
function rankTemplates(skills,profile){
 let sig=[],known=0;
 for(let i=0;i<13;i++){let domain=skills.filter(s=>s.di===i),rated=domain.map(s=>profile.surveys?.[s.id]).filter(Boolean);
 if(rated.length){sig.push(rated.reduce((sum,r)=>sum+Number(r.confidence)/4,0)/rated.length);known++}
 else sig.push(domain.some(s=>profile.confirmed?.includes(s.id))?.27:.06)}
 const total=sig.reduce((a,b)=>a+b,0)||1,normalized=sig.map(x=>x/total);
 const results=templates.map(([name,glyph],index)=>{let p=patterns[index],radii=p.map(([x,y])=>Math.hypot(x-.5,y-.5)+.12),sum=radii.reduce((a,b)=>a+b,0),score=normalized.reduce((acc,v,i)=>acc+Math.pow(v-radii[i]/sum,2),0);return {name,glyph,index,score}}).sort((a,b)=>a.score-b.score);
 return {known,results};
}
function render(o){
 stop();
 const {svg,surface,detail,legend,skills,colors,profile,filter='all',query='',selected=null,choice='auto',onSelect,onReflect,modeLabel}=o;
 const rank=rankTemplates(skills,profile),idx=templates.findIndex(t=>t[0]===choice),chosen=idx>=0?idx:(rank.known?rank.results[0].index:0),shape=templates[chosen],anchors=patterns[chosen].map(([x,y],i)=>({x:105+750*x,y:72+410*y,di:i}));
 const displayed=skills.filter(s=>(filter==='all'||s.di===Number(filter))&&(!query||`${s.name} ${s.domain}`.toLowerCase().includes(query.toLowerCase())));
 const visible=new Set(displayed.map(s=>s.id));
 const particles=skills.map(s=>{let hub=anchors[s.di],a=s.si*Math.PI/4+s.di*.18,r=21+(s.si%4)*9,x=hub.x+Math.cos(a)*r,y=hub.y+Math.sin(a)*r;return {s,homeX:x,homeY:y,x,y,vx:0,vy:0,info:signal(s,profile),show:visible.has(s.id)}});
 const byId=new Map(particles.map(p=>[p.s.id,p])),edges=[],adj=new Map();
 function link(a,b,major=false){if(!a||!b||a===b)return;edges.push([a,b,major]);for(let [u,v] of [[a,b],[b,a]]){if(!adj.has(u))adj.set(u,new Set());adj.get(u).add(v)}}
 for(let di=0;di<13;di++){const arr=skills.filter(s=>s.di===di);for(let i=0;i<7;i++)link(arr[i]?.id,arr[i+1]?.id);link(arr[0]?.id,arr[4]?.id)}
 for(let di=0;di<12;di++)link(skills.find(s=>s.di===di)?.id,skills.find(s=>s.di===di+1)?.id,true);
 svg.replaceChildren();svg.setAttribute('viewBox','0 0 950 550');
 function node(tag,props,parent=svg){let e=document.createElementNS(svgNS,tag);for(let [k,v] of Object.entries(props||{}))e.setAttribute(k,String(v));parent.appendChild(e);return e}
 let defs=node('defs'),f=node('filter',{id:'synapse-sky-glow',x:'-100%',y:'-100%',width:'300%',height:'300%'},defs);
 node('feGaussianBlur',{stdDeviation:4,result:'blur'},f);let m=node('feMerge',{},f);node('feMergeNode',{in:'blur'},m);node('feMergeNode',{in:'SourceGraphic'},m);
 let background=node('g',{'aria-hidden':'true'}),skeleton=node('g',{'aria-hidden':'true'}),lines=node('g',{'aria-hidden':'true'}),nodeLayer=node('g'),trailLayer=node('g',{'pointer-events':'none'});
 for(let i=0;i<115;i++){node('circle',{cx:((i*73+29)%936)+7,cy:((i*191+51)%528)+6,r:i%10===0?1.2:.57,fill:'#cce4f8',opacity:i%9===0?.25:.10},background)}
 for(let i=0;i<12;i++)node('line',{x1:anchors[i].x,y1:anchors[i].y,x2:anchors[i+1].x,y2:anchors[i+1].y,class:'sky-skeleton'},skeleton);
 let drawn=edges.map(([a,b,major])=>({a,b,major,el:node('line',{class:major?'sky-link sky-major':'sky-link'},lines)}));
 let elements=new Map;
 for(let p of particles){if(!p.show)continue;let g=node('g',{class:'sky-skill-node',role:'button',tabindex:0,'data-skill':p.s.id,'aria-label':p.s.name},nodeLayer);
 let glow=node('circle',{r:12,fill:colors[p.s.di],opacity:0,filter:'url(#synapse-sky-glow)'},g);
 let ring=node('circle',{r:7,fill:'none',stroke:colors[p.s.di],'stroke-opacity':.16},g);
 let dot=node('circle',{r:3,fill:p.info.rated?colors[p.s.di]:'#8da5b9',opacity:p.info.intensity},g);
 node('title',{},g).textContent=`${p.s.name} · ${p.info.rated?'Self-reported '+p.info.confidence+'/4':p.info.claimed?'Confirmed experience mention, unrated':'Unknown confidence'}`;
 g.addEventListener('click',()=>onSelect?.(p.s.id));
 g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.(p.s.id)}});
 elements.set(p.s.id,{g,glow,ring,dot,p});
 }
 let pointer={x:-900,y:-900,active:false},trail=[],last={x:-900,y:-900},lastTime=0;
 const reduce=!!global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 surface.onpointermove=e=>{const rect=svg.getBoundingClientRect();if(!rect.width||!rect.height)return;pointer.x=(e.clientX-rect.left)*950/rect.width;pointer.y=(e.clientY-rect.top)*550/rect.height;pointer.active=true;if(Math.hypot(pointer.x-last.x,pointer.y-last.y)>3){trail.push({x:pointer.x,y:pointer.y,ttl:22});if(trail.length>20)trail.shift();last={x:pointer.x,y:pointer.y}}};
 surface.onpointerleave=()=>{pointer.active=false};surface.onpointercancel=()=>{pointer.active=false};
 let instance={dead:false,raf:0};live=instance;
 function frame(t){
 if(instance.dead)return;
 if(!svg.closest('.view.active')){instance.raf=requestAnimationFrame(frame);return}
 let dt=clamp((t-(lastTime||t))/16.7,.4,2);lastTime=t;
 let focus=null,closest=90;
 for(let p of particles){if(!p.show)continue;let fx=(p.homeX-p.x)*.034,fy=(p.homeY-p.y)*.034;
 if(pointer.active&&!reduce){let dx=p.x-pointer.x,dy=p.y-pointer.y,d=Math.hypot(dx,dy)||1;if(d<130){let push=Math.pow(1-d/130,2)*3.5;fx+=(dx/d)*push;fy+=(dy/d)*push}}
 if(!reduce){fx+=.002*Math.sin(t*.0008+p.s.si*1.7);fy+=.002*Math.cos(t*.0006+p.s.di)}
 p.vx=reduce?0:(p.vx+fx*dt)*Math.pow(.84,dt);p.vy=reduce?0:(p.vy+fy*dt)*Math.pow(.84,dt);p.x=reduce?p.homeX:p.x+p.vx*dt;p.y=reduce?p.homeY:p.y+p.vy*dt;
 let el=elements.get(p.s.id);el.g.setAttribute('transform',`translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`);
 const dis=pointer.active?Math.hypot(pointer.x-p.x,pointer.y-p.y):999;if(dis<closest){closest=dis;focus=p.s.id}
 }
 for(let e of drawn){let a=byId.get(e.a),b=byId.get(e.b);if(!a.show||!b.show){e.el.style.display='none';continue}e.el.style.display='';e.el.setAttribute('x1',a.x);e.el.setAttribute('x2',b.x);e.el.setAttribute('y1',a.y);e.el.setAttribute('y2',b.y);e.el.style.strokeOpacity=(selected===e.a||selected===e.b||focus===e.a||focus===e.b)?'.73':e.major?'.28':'.18'}
 for(let [id,el] of elements){let prominent=id===selected||id===focus,dim=selected&&id!==selected&&!adj.get(selected)?.has(id);el.g.style.opacity=dim?'.22':'1';el.dot.setAttribute('r',prominent?7:el.p.info.rated?4.3:3);el.dot.setAttribute('opacity',prominent?1:el.p.info.intensity);el.glow.setAttribute('opacity',prominent?'.52':el.p.info.rated?String(.14*el.p.info.intensity):'0');el.ring.setAttribute('stroke-opacity',prominent?'.96':el.p.info.rated?'.56':'.15');el.ring.setAttribute('r',prominent?12:7)}
 trailLayer.replaceChildren();if(pointer.active&&!reduce){trail=trail.filter(p=>p.ttl-->0);for(let p of trail)node('circle',{cx:p.x,cy:p.y,r:1+p.ttl/11,fill:'#6cf1d3',opacity:p.ttl/80},trailLayer)}
 instance.raf=requestAnimationFrame(frame);
 }
 frame(0);
 const s=skills.find(s=>s.id===selected),v=s&&profile.surveys?.[s.id];
 detail.innerHTML=s?`<div class="eyebrow">SKILL SIGNAL</div><h3>${esc(s.name)}</h3><p>${esc(s.task)}</p><dl><dt>Domain</dt><dd>${esc(s.domain)}</dd><dt>Self-reported confidence</dt><dd>${v?esc(v.confidence)+'/4':'Unanswered / unknown'}</dd><dt>Execution method</dt><dd>${v?esc(modeLabel(v.method)):'Not reported'}</dd><dt>Experience</dt><dd>${v?esc(v.performed):'Unknown'}</dd><dt>Employee-confirmed mention</dt><dd>${profile.confirmed.includes(s.id)?'Yes':'Not provided'}</dd><dt>Qualification verification</dt><dd>Not available</dd></dl><button class="secondary" id="graphAction">Reflect on this task ↗</button>`:`<div class="eyebrow">ILLUSTRATIVE SKY PATTERN</div><h3>${shape[1]} ${esc(shape[0])}</h3><p>${choice==='auto'?'Automatic visual selection':'Manual visual selection'}. ${rank.known?`${rank.known} domain(s) with rated responses.`:'No rated domains yet, showing a placeholder.'}</p><p>Bright = higher <em>self-reported confidence</em>. Dim colored = lower self-report. Grey = unanswered, <strong>not incapable</strong>.</p><p>Move your mouse to ripple the starfield. Click a star to inspect distinct signals.</p><p class="muted">Zodiac-inspired schematic art, not sky coordinates or an astrological personality assessment.</p>`;
 if(s)detail.querySelector('#graphAction').onclick=()=>onReflect?.(s.id);
 legend.innerHTML=`<span class="legend-item"><i style="background:#62e5cf"></i>Rated: brightness by confidence</span><span class="legend-item"><i style="background:#7892a7"></i>Unrated: unknown</span><span class="legend-item">${shape[1]} ${esc(shape[0])} · ${choice==='auto'?'Auto':'Manual'} · ${rank.known}/13 surveyed domains</span>`;
 return {name:shape[0],known:rank.known,matches:rank.results.slice(0,3)};
}
global.SynapseSky={render,stop,rankTemplates,templates:templates.map(([name,glyph])=>({name,glyph}))};
})(window);
