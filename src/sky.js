(function skyFactory(global) {
'use strict';
/* Western constellation silhouettes derived from BSD-licensed astronomical reference lines when available; fallback drawings are illustrative.
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
const patterns=templates.map(t=>global.SynapseZodiac?.[t[0]]?.anchors||resample(t[2],13)),svgNS='http://www.w3.org/2000/svg';
/* Curated conceptual relationships inherited from the original graph. These describe
   useful learning pathways, not an employee's observed work or a causal dependency. */
const skillBridges=[
 ['sql-pipelines','power-bi'],['sql-pipelines','data-quality'],
 ['aws-architecture','identity-access'],['aws-architecture','infrastructure-as-code'],
 ['powershell-automation','workflow-automation'],['git-workflows','ci-cd-pipelines'],
 ['ai-orchestration','ai-outcome-validation'],['shipyard-process-mapping','qualification-planning'],
 ['root-cause-analysis','data-quality'],['knowledge-transfer','mentoring'],
 ['systems-thinking','systems-integration'],['responsible-ai-use','security-controls'],
 ['rapid-prototyping','frontend-engineering'],['requirements-analysis','acceptance-criteria'],
 ['threat-modeling','risk-assessment'],['cloud-observability','monitoring-alerting'],
 ['dashboard-design','metrics-definition'],['technical-writing','technical-work-instructions'],
 ['test-automation','regression-testing'],['product-judgment','stakeholder-alignment'],
 ['cross-team-facilitation','agile-facilitation'],['data-governance','audit-evidence'],
 ['incident-readiness','resilience-recovery'],['ai-outcome-validation','quality-assurance']
];
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
 const byId=new Map(particles.map(p=>[p.s.id,p])),edges=[],adj=new Map(),edgeKeys=new Set();
 function link(a,b,kind='local'){
  if(!byId.has(a)||!byId.has(b)||a===b)return;
  const key=[a,b].sort().join('|');if(edgeKeys.has(key))return;edgeKeys.add(key);
  edges.push({a,b,kind});
  for(const [u,v] of [[a,b],[b,a]]){if(!adj.has(u))adj.set(u,new Set());adj.get(u).add(v)}
 }
 for(let di=0;di<13;di++){
  const arr=skills.filter(s=>s.di===di).sort((a,b)=>a.si-b.si);
  for(let i=0;i<arr.length-1;i++)link(arr[i]?.id,arr[i+1]?.id);
  // Branch the hub skill into more than a ring, restoring the first graph's
  // explorable parent/child-looking topology without claiming a taxonomy hierarchy.
  for(const si of [2,4,6,7])link(arr[0]?.id,arr[si]?.id,'branch');
 }
 for(let di=0;di<12;di++)link(skills.find(s=>s.di===di)?.id,skills.find(s=>s.di===di+1)?.id,'spine');
 for(const [a,b] of skillBridges)link(a,b,'semantic');
 svg.replaceChildren();svg.setAttribute('viewBox','0 0 950 550');
 function node(tag,props,parent=svg){let e=document.createElementNS(svgNS,tag);for(let [k,v] of Object.entries(props||{}))e.setAttribute(k,String(v));parent.appendChild(e);return e}
 let defs=node('defs'),f=node('filter',{id:'synapse-sky-glow',x:'-100%',y:'-100%',width:'300%',height:'300%'},defs);
 node('feGaussianBlur',{stdDeviation:4,result:'blur'},f);let m=node('feMerge',{},f);node('feMergeNode',{in:'blur'},m);node('feMergeNode',{in:'SourceGraphic'},m);
 let background=node('g',{'aria-hidden':'true'}),skeleton=node('g',{'aria-hidden':'true'}),lines=node('g',{'aria-hidden':'true'}),nodeLayer=node('g'),trailLayer=node('g',{'pointer-events':'none'});
 for(let i=0;i<115;i++){node('circle',{cx:((i*73+29)%936)+7,cy:((i*191+51)%528)+6,r:i%10===0?1.2:.57,fill:'#cce4f8',opacity:i%9===0?.25:.10},background)}
 const realFigure=global.SynapseZodiac?.[shape[0]];if(realFigure){for(const figline of realFigure.lines)for(let i=0;i<figline.length-1;i++){const a=figline[i],b=figline[i+1];node('line',{x1:105+750*a[0],y1:72+410*a[1],x2:105+750*b[0],y2:72+410*b[1],class:'sky-skeleton'},skeleton)}}else for(let i=0;i<12;i++)node('line',{x1:anchors[i].x,y1:anchors[i].y,x2:anchors[i+1].x,y2:anchors[i+1].y,class:'sky-skeleton'},skeleton);
 let drawn=edges.map(({a,b,kind})=>({a,b,kind,el:node('path',{class:'sky-link sky-'+kind,fill:'none','data-relation-a':a,'data-relation-b':b,'data-relation-type':kind},lines)}));
 let elements=new Map;
 for(let p of particles){if(!p.show)continue;let g=node('g',{class:'sky-skill-node',role:'button',tabindex:0,'data-skill':p.s.id,'aria-label':p.s.name},nodeLayer);
 let glow=node('circle',{r:12,fill:colors[p.s.di],opacity:0,filter:'url(#synapse-sky-glow)'},g);
 let ring=node('circle',{r:7,fill:'none',stroke:colors[p.s.di],'stroke-opacity':.16},g);
 let dot=node('circle',{r:3,fill:p.info.rated?colors[p.s.di]:'#8da5b9',opacity:p.info.intensity},g);
 // Hit targets stay large while visual star points remain small.
 let hit=node('circle',{r:16,fill:'transparent',class:'sky-hit-target','pointer-events':'all'},g);
 node('title',{},g).textContent=`${p.s.name} · ${p.info.rated?'Self-reported '+p.info.confidence+'/4':p.info.claimed?'Confirmed experience mention, unrated':'Unknown confidence'}`;
 g.addEventListener('click',()=>onSelect?.(p.s.id));
 g.addEventListener('focus',()=>{keyboardFocus=p.s.id;showTip(p.s.id)});
 g.addEventListener('blur',()=>{keyboardFocus=null;if(!stickyId)hideTip()});
 g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.(p.s.id)}});
 elements.set(p.s.id,{g,glow,ring,dot,p});
 }
 let pointer={x:-900,y:-900,active:false},trail=[],last={x:-900,y:-900},lastTime=0,stickyId=null,keyboardFocus=null,tipId=null;
 const reduce=!!global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const tooltip=surface.querySelector('#graphHoverTip');
 function hideTip(){if(tooltip){tooltip.hidden=true;tooltip.classList.remove('visible')}tipId=null}
 function showTip(id){
  const p=byId.get(id);if(!p||!p.show||!tooltip)return hideTip();
  if(tipId!==id){
   tipId=id;const connections=[...(adj.get(id)||[])].filter(k=>visible.has(k));
   const bridges=edges.filter(e=>(e.a===id||e.b===id)&&e.kind==='semantic').map(e=>e.a===id?e.b:e.a).filter(k=>visible.has(k));
   const examples=[...new Set([...bridges,...connections])].slice(0,3).map(k=>byId.get(k)?.s.name).filter(Boolean);
   tooltip.innerHTML='<strong>'+esc(p.s.name)+'</strong><span>'+esc(p.s.domain)+'</span><small>'+
     (p.info.rated?'Self-reported confidence: '+p.info.confidence+'/4':p.info.claimed?'Experience confirmed; confidence unrated':'Confidence not reported')+
     '</small>'+(examples.length?'<small class="sky-tip-related">Linked to '+esc(examples.join(' · '))+'</small>':'');
  }
  tooltip.hidden=false;tooltip.classList.add('visible');
 }
 function placeTip(p){
  if(!tooltip||tooltip.hidden||!p)return;
  const svgBox=svg.getBoundingClientRect(),box=surface.getBoundingClientRect();
  const scale=Math.min(svgBox.width/950,svgBox.height/550);
  const x=svgBox.left-box.left+(svgBox.width-950*scale)/2+p.x*scale;
  const y=svgBox.top-box.top+(svgBox.height-550*scale)/2+p.y*scale;
  const tipW=tooltip.offsetWidth||225,tipH=tooltip.offsetHeight||90;
  tooltip.style.left=clamp(x+18,8,Math.max(8,box.width-tipW-8))+'px';
  tooltip.style.top=clamp(y-tipH-14,8,Math.max(8,box.height-tipH-8))+'px';
 }
 function seekSticky(){
  if(!pointer.active){stickyId=null;return}
  if(stickyId){
   const p=byId.get(stickyId);
   if(!p?.show||Math.hypot(pointer.x-p.homeX,pointer.y-p.homeY)>76||
       Math.hypot(pointer.x-p.x,pointer.y-p.y)>54){stickyId=null}
  }
  if(!stickyId){
   let closest=28;
   for(const p of particles){if(!p.show)continue;
    const d=Math.hypot(pointer.x-p.x,pointer.y-p.y);
    if(d<closest){closest=d;stickyId=p.s.id}
   }
  }
 }
 surface.onpointermove=e=>{
  const rect=svg.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const scale=Math.min(rect.width/950,rect.height/550);
  pointer.x=(e.clientX-rect.left-(rect.width-950*scale)/2)/scale;
  pointer.y=(e.clientY-rect.top-(rect.height-550*scale)/2)/scale;
  pointer.active=true;seekSticky();
  if(Math.hypot(pointer.x-last.x,pointer.y-last.y)>3){trail.push({x:pointer.x,y:pointer.y,ttl:16});if(trail.length>12)trail.shift();last={x:pointer.x,y:pointer.y}}
 };
 surface.onpointerleave=()=>{pointer.active=false;stickyId=null;if(!keyboardFocus)hideTip()};
 surface.onpointercancel=()=>{pointer.active=false;stickyId=null;if(!keyboardFocus)hideTip()};
 let instance={dead:false,raf:0};live=instance;
 function frame(t){
 if(instance.dead)return;
 if(!svg.closest('.view.active')){instance.raf=requestAnimationFrame(frame);return}
 let dt=clamp((t-(lastTime||t))/16.7,.4,2);lastTime=t;
 const focus=stickyId||keyboardFocus;
 for(const p of particles){
  if(!p.show)continue;
  const caught=pointer.active&&stickyId===p.s.id;
  let fx=(p.homeX-p.x)*.034,fy=(p.homeY-p.y)*.034;
  if(caught&&!reduce){fx=(pointer.x-p.x)*.14;fy=(pointer.y-p.y)*.14}
  else if(pointer.active&&!reduce){
   let dx=p.x-pointer.x,dy=p.y-pointer.y,d=Math.hypot(dx,dy)||1;
   // A subdued ripple behind the cursor, not a large force field.
   if(d<92){let push=Math.pow(1-d/92,2)*.52;fx+=(dx/d)*push;fy+=(dy/d)*push}
  }
  if(!reduce&&!caught){fx+=.002*Math.sin(t*.0008+p.s.si*1.7);fy+=.002*Math.cos(t*.0006+p.s.di)}
  const friction=caught?.56:.84;
  p.vx=reduce?0:(p.vx+fx*dt)*Math.pow(friction,dt);
  p.vy=reduce?0:(p.vy+fy*dt)*Math.pow(friction,dt);
  p.x=reduce?p.homeX:p.x+p.vx*dt;p.y=reduce?p.homeY:p.y+p.vy*dt;
  const el=elements.get(p.s.id);el.g.setAttribute('transform',`translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`);
 }
 for(const e of drawn){
  const a=byId.get(e.a),b=byId.get(e.b);
  if(!a.show||!b.show){e.el.style.display='none';continue}
  e.el.style.display='';
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,curve=e.kind==='semantic'?Math.min(34,d*.12):e.kind==='branch'?8:0;
  const mx=(a.x+b.x)/2-dy/d*curve,my=(a.y+b.y)/2+dx/d*curve;
  e.el.setAttribute('d',curve?`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`:`M ${a.x} ${a.y} L ${b.x} ${b.y}`);
  const focused=focus&&(focus===e.a||focus===e.b),pinned=selected&&(selected===e.a||selected===e.b);
  e.el.style.strokeOpacity=focused||pinned?'.91':e.kind==='semantic'?'.49':e.kind==='branch'?'.44':e.kind==='spine'?'.33':'.28';
  e.el.style.strokeWidth=focused||pinned?'2.3':'';
 }
 for(const [id,el] of elements){
  const prominent=id===selected||id===focus,dim=(focus||selected)&&id!==focus&&id!==selected&&!adj.get(focus||selected)?.has(id);
  el.g.style.opacity=dim?'.35':'1';el.dot.setAttribute('r',prominent?7:el.p.info.rated?4.3:3);
  el.dot.setAttribute('opacity',prominent?1:el.p.info.intensity);
  el.glow.setAttribute('opacity',prominent?'.52':el.p.info.rated?String(.14*el.p.info.intensity):'0');
  el.ring.setAttribute('stroke-opacity',prominent?'.96':el.p.info.rated?'.56':'.15');
  el.ring.setAttribute('r',prominent?12:7)
 }
 if(focus){showTip(focus);placeTip(byId.get(focus))}else hideTip();
 trailLayer.replaceChildren();if(pointer.active&&!reduce){
  trail=trail.filter(p=>p.ttl-->0);
  for(const p of trail)node('circle',{cx:p.x,cy:p.y,r:1+p.ttl/12,fill:'#6cf1d3',opacity:p.ttl/135},trailLayer)
 }
 instance.raf=requestAnimationFrame(frame);
 }
 frame(0);
 const s=skills.find(s=>s.id===selected),v=s&&profile.surveys?.[s.id];
 detail.innerHTML=s?`<div class="eyebrow">SKILL SIGNAL</div><h3>${esc(s.name)}</h3><p>${esc(s.task)}</p><dl><dt>Domain</dt><dd>${esc(s.domain)}</dd><dt>Self-reported confidence</dt><dd>${v?esc(v.confidence)+'/4':'Unanswered / unknown'}</dd><dt>Execution method</dt><dd>${v?esc(modeLabel(v.method)):'Not reported'}</dd><dt>Experience</dt><dd>${v?esc(v.performed):'Unknown'}</dd><dt>Employee-confirmed mention</dt><dd>${profile.confirmed.includes(s.id)?'Yes':'Not provided'}</dd><dt>Qualification verification</dt><dd>Not available</dd></dl><button class="secondary" id="graphAction">Reflect on this task ↗</button>`:`<div class="eyebrow">ILLUSTRATIVE SKY PATTERN</div><h3>${shape[1]} ${esc(shape[0])}</h3><p>${choice==='auto'?'Automatic visual selection':'Manual visual selection'}. ${rank.known?`${rank.known} domain(s) with rated responses.`:'No rated domains yet, showing a placeholder.'}</p><p>Bright = higher <em>self-reported confidence</em>. Dim colored = lower self-report. Grey = unanswered, <strong>not incapable</strong>.</p><p>Approach a star to magnetically catch it and see its skill name. Colored branches trace same-domain and cross-domain skill relationships; select a star to explore them.</p><p class="muted">Figure projected from Western constellation line data (d3-celestial, BSD-3-Clause). Visual alignment is decorative, not astrological inference.</p>`;
 if(s){
 const related=[...(adj.get(s.id)||[])].filter(k=>visible.has(k)).slice(0,12);
 const relatedNames=related.map(id=>byId.get(id)?.s.name).filter(Boolean);
 if(relatedNames.length){
  const section=document.createElement('section');section.className='sky-relationships';
  section.innerHTML='<h4>Connected capabilities ('+relatedNames.length+')</h4><p>Conceptual taxonomy / learning links, not recorded collaboration.</p>'+
    related.map(id=>'<button class="sky-related" type="button" data-related-skill="'+esc(id)+'">'+esc(byId.get(id).s.name)+'</button>').join('');
  detail.appendChild(section);
  section.addEventListener('click',e=>{const btn=e.target.closest('[data-related-skill]');if(btn)onSelect?.(btn.dataset.relatedSkill)});
 }
 detail.querySelector('#graphAction').onclick=()=>onReflect?.(s.id);
}
 legend.innerHTML=`<span class="legend-item"><i style="background:#62e5cf"></i>Rated: brightness by confidence</span><span class="legend-item"><i style="background:#7892a7"></i>Unrated: unknown</span><span class="legend-item">${shape[1]} ${esc(shape[0])} · ${choice==='auto'?'Auto':'Manual'} · ${rank.known}/13 surveyed domains</span>`;
 return {name:shape[0],known:rank.known,matches:rank.results.slice(0,3)};
}
global.SynapseSky={render,stop,rankTemplates,skillBridges,templates:templates.map(([name,glyph])=>({name,glyph}))};
})(window);
