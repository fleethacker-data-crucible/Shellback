(function galaxyFactory(global){
'use strict';
/* The skill galaxy encodes relationships and employee-chosen self-report only.
   The domain orbit/spiral is decorative, not a horoscope or personnel score. */
let active=null;
const svgNS='http://www.w3.org/2000/svg',GOLDEN=2.399963229728653;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const bridges=[
 ['sql-pipelines','power-bi'],['sql-pipelines','data-quality'],['aws-architecture','identity-access'],
 ['aws-architecture','infrastructure-as-code'],['powershell-automation','workflow-automation'],
 ['git-workflows','ci-cd-pipelines'],['ai-orchestration','ai-outcome-validation'],
 ['shipyard-process-mapping','qualification-planning'],['root-cause-analysis','data-quality'],
 ['knowledge-transfer','mentoring'],['systems-thinking','systems-integration'],
 ['responsible-ai-use','security-controls'],['rapid-prototyping','frontend-engineering'],
 ['requirements-analysis','acceptance-criteria'],['threat-modeling','risk-assessment'],
 ['cloud-observability','monitoring-alerting'],['dashboard-design','metrics-definition'],
 ['technical-writing','technical-work-instructions'],['test-automation','regression-testing'],
 ['product-judgment','stakeholder-alignment'],['cross-team-facilitation','agile-facilitation'],
 ['data-governance','audit-evidence'],['incident-readiness','resilience-recovery'],
 ['ai-outcome-validation','quality-assurance']
];
function stop(){if(active){active.stopped=true;global.cancelAnimationFrame?.(active.raf);active=null}}
function strength(s,profile){
 const answer=profile.surveys?.[s.id];
 if(answer&&Number.isInteger(Number(answer.confidence))&&Number(answer.confidence)>=0&&Number(answer.confidence)<=4){
  return {rated:true,value:Number(answer.confidence),glow:.20+Number(answer.confidence)*.20}
 }
 if(profile.confirmed?.includes(s.id))return {rated:false,claimed:true,glow:.39};
 return {rated:false,claimed:false,glow:.15};
}
function layout(skills,profile){
 const hubs=Array.from({length:13},(_,di)=>{
  const angle=di*GOLDEN-.45,rad=64+Math.sqrt((di+.7)/13)*190;
  return {di,x:475+Math.cos(angle)*rad*1.37,y:275+Math.sin(angle)*rad*.88}
 });
 return skills.map(s=>{
  const h=hubs[s.di],a=(s.si*GOLDEN)+s.di*.37,r=24+Math.sqrt((s.si+1)/8)*52;
  // Slight rebalancing of orbits is driven by volunteered signals, not demographics.
  const claim=profile.confirmed?.includes(s.id),signal=strength(s,profile);
  const x=h.x+Math.cos(a)*(r+(claim?4:0)),y=h.y+Math.sin(a)*r*.78;
  return {s,x,y,homeX:x,homeY:y,vx:0,vy:0,signal};
 });
}
function render(o){
 stop();
 const {svg,surface,detail,legend,skills,domains,colors,profile,filter='all',query='',selected=null,onSelect,onReflect,modeLabel}=o;
 const all=layout(skills,profile),byId=new Map(all.map(p=>[p.s.id,p])),shown=new Set(skills.filter(s=>
  (filter==='all'||s.di===Number(filter))&&(!query||`${s.name} ${s.domain}`.toLowerCase().includes(query.toLowerCase()))
 ).map(s=>s.id));
 const edges=[],adj=new Map(),seen=new Set;
 function link(a,b,type='local'){
  if(!byId.has(a)||!byId.has(b)||a===b)return;
  const k=[a,b].sort().join('|');if(seen.has(k))return;seen.add(k);
  edges.push({a,b,type});for(const [u,v] of [[a,b],[b,a]]){if(!adj.has(u))adj.set(u,new Set);adj.get(u).add(v)}
 }
 for(let di=0;di<13;di++){
  const arr=skills.filter(s=>s.di===di).sort((a,b)=>a.si-b.si);
  for(let i=0;i<arr.length-1;i++)link(arr[i].id,arr[i+1].id);
  for(let i of [2,4,6,7])link(arr[0]?.id,arr[i]?.id,'branch');
 }
 // Connect clusters across disciplines, preserving the original meaningful bridges.
 for(const [a,b] of bridges)link(a,b,'semantic');
 const ns=(tag,attributes={},parent=svg)=>{const el=document.createElementNS(svgNS,tag);for(const [a,b] of Object.entries(attributes))el.setAttribute(a,String(b));parent.appendChild(el);return el};
 svg.replaceChildren();svg.setAttribute('viewBox','0 0 950 550');
 const defs=ns('defs');
 const nebula=ns('radialGradient',{id:'synapse-galaxy-core',cx:'50%',cy:'50%',r:'50%'},defs);
 ns('stop',{offset:'0%', 'stop-color':'#5cf1ce','stop-opacity':'.25'},nebula);
 ns('stop',{offset:'35%', 'stop-color':'#2478c2','stop-opacity':'.11'},nebula);
 ns('stop',{offset:'100%','stop-color':'#1b2353','stop-opacity':'0'},nebula);
 const halo=ns('filter',{id:'synapse-galaxy-glow',x:'-130%',y:'-130%',width:'360%',height:'360%'},defs);
 ns('feGaussianBlur',{stdDeviation:'4.5',result:'blur'},halo);const merge=ns('feMerge',{},halo);
 ns('feMergeNode',{in:'blur'},merge);ns('feMergeNode',{in:'SourceGraphic'},merge);
 const field=ns('g',{'aria-hidden':'true'}),fibrils=ns('g',{'aria-hidden':'true'}),lineLayer=ns('g',{'aria-hidden':'true'}),nodeLayer=ns('g'),trailLayer=ns('g',{'pointer-events':'none'});
 ns('ellipse',{cx:475,cy:276,rx:450,ry:275,fill:'url(#synapse-galaxy-core)'},field);
 // Seeded tiny stars: no runtime randomness, so galaxy remains stable between visits.
 for(let i=0;i<240;i++){
  const theta=i*GOLDEN,rad=10+Math.sqrt(i/240)*268;
  const x=475+Math.cos(theta)*rad*1.58,y=272+Math.sin(theta)*rad*.92;
  const c=i%6===0?'#9b9ef3':i%5===0?'#73e8cb':'#d5eafa';
  ns('circle',{cx:x.toFixed(2),cy:y.toFixed(2),r:i%19===0?'1.2':'.57',fill:c,opacity:i%7===0?'.34':'.12'},field);
 }
 const centers=Array.from({length:13},(_,di)=>{
  const p=all.find(p=>p.s.di===di);
  const h=(()=>{const a=di*GOLDEN-.45,r=64+Math.sqrt((di+.7)/13)*190;return {x:475+Math.cos(a)*r*1.37,y:275+Math.sin(a)*r*.88}})();
  const group=ns('g',{class:'galaxy-domain-hub','data-domain':di},fibrils);
  ns('circle',{cx:h.x,cy:h.y,r:72,fill:colors[di],opacity:'.028'},group);
  ns('circle',{cx:h.x,cy:h.y,r:46,fill:'none',stroke:colors[di],'stroke-opacity':'.19','stroke-width':'.75','stroke-dasharray':'2 7'},group);
  ns('circle',{cx:h.x,cy:h.y,r:9,fill:colors[di],opacity:'.16',filter:'url(#synapse-galaxy-glow)'},group);
  let label=ns('text',{x:h.x+14,y:h.y-12,class:'galaxy-domain-label'},group);
  label.textContent=domains?.[di]?.[0]||p?.s.domain||'Domain';
  return h;
 });
 const paths=edges.map(e=>({...e,el:ns('path',{class:`sky-link sky-${e.type}`,fill:'none','data-relation-a':e.a,'data-relation-b':e.b,'data-relation-type':e.type},lineLayer)}));
 const elements=new Map;
 for(const p of all){
  if(!shown.has(p.s.id))continue;
  let g=ns('g',{class:'sky-skill-node','data-skill':p.s.id,role:'button',tabindex:0,'aria-label':p.s.name},nodeLayer);
  let glow=ns('circle',{r:12,fill:colors[p.s.di],filter:'url(#synapse-galaxy-glow)',opacity:0},g);
  let ring=ns('circle',{r:7,fill:'none',stroke:colors[p.s.di],'stroke-opacity':'.17'},g);
  let star=ns('circle',{r:3,fill:p.signal.rated?colors[p.s.di]:'#8ca3b8',opacity:p.signal.glow},g);
  ns('circle',{r:16,fill:'transparent','pointer-events':'all',class:'sky-hit-target'},g);
  ns('title',{},g).textContent=`${p.s.name} · ${p.signal.rated?`${p.signal.value}/4 self-reported confidence`:p.signal.claimed?'Experience mention, unrated':'Unknown confidence'}`;
  g.addEventListener('click',()=>onSelect?.(p.s.id));
  g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.(p.s.id)}});
  g.addEventListener('focus',()=>{keyboard=p.s.id;showTip(p.s.id)});
  g.addEventListener('blur',()=>{keyboard=null;if(!locked)hideTip()});
  elements.set(p.s.id,{g,glow,ring,star,p});
 }
 const tooltip=surface.querySelector('#graphHoverTip');
 let pointer={x:0,y:0,active:false},locked=null,keyboard=null,tipId=null,trail=[],lastTime=0;
 const reduce=!!global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 function hideTip(){if(tooltip){tooltip.hidden=true;tooltip.classList.remove('visible')}tipId=null}
 function showTip(id){
  const p=byId.get(id);if(!shown.has(id)||!p||!tooltip)return hideTip();
  if(tipId!==id){
   const related=[...(adj.get(id)||[])].filter(k=>shown.has(k));
   const cross=edges.filter(e=>e.type==='semantic'&&(e.a===id||e.b===id)).map(e=>e.a===id?e.b:e.a).filter(k=>shown.has(k));
   const recommended=[...new Set([...cross,...related])].slice(0,3).map(k=>byId.get(k)?.s.name).filter(Boolean);
   tooltip.innerHTML='<strong>'+esc(p.s.name)+'</strong><span>'+esc(p.s.domain)+'</span><small>'+
    (p.signal.rated?'Self-reported confidence '+p.signal.value+'/4':p.signal.claimed?'Experience confirmed; confidence unrated':'Confidence unknown (unanswered)')+
    '</small>'+(recommended.length?'<small class="sky-tip-related">Linked: '+esc(recommended.join(' · '))+'</small>':'');
   tipId=id;
  }tooltip.hidden=false;tooltip.classList.add('visible');
 }
 function tipAt(p){
  if(!p||!tooltip||tooltip.hidden)return;
  const r=svg.getBoundingClientRect(),box=surface.getBoundingClientRect(),scale=Math.min(r.width/950,r.height/550);
  const x=r.left-box.left+(r.width-950*scale)/2+p.x*scale,y=r.top-box.top+(r.height-550*scale)/2+p.y*scale;
  const tw=tooltip.offsetWidth||205,th=tooltip.offsetHeight||75;
  tooltip.style.left=clamp(x+17,8,Math.max(8,box.width-tw-8))+'px';
  tooltip.style.top=clamp(y-th-14,8,Math.max(8,box.height-th-8))+'px';
 }
 function capture(){
  if(!pointer.active){locked=null;return}
  if(locked){
   const p=byId.get(locked);
   if(!p||!shown.has(locked)||Math.hypot(pointer.x-p.x,pointer.y-p.y)>55||Math.hypot(pointer.x-p.homeX,pointer.y-p.homeY)>82)locked=null;
  }
  if(!locked){let nearest=29;for(const p of all){if(!shown.has(p.s.id))continue;let d=Math.hypot(pointer.x-p.x,pointer.y-p.y);if(d<nearest){nearest=d;locked=p.s.id}}}
 }
 surface.onpointermove=e=>{
  const r=svg.getBoundingClientRect();if(!r.width||!r.height)return;
  const scale=Math.min(r.width/950,r.height/550);
  pointer={active:true,x:(e.clientX-r.left-(r.width-950*scale)/2)/scale,y:(e.clientY-r.top-(r.height-550*scale)/2)/scale};
  capture();if(!reduce){trail.push({x:pointer.x,y:pointer.y,life:16});if(trail.length>10)trail.shift()}
 };
 surface.onpointerleave=()=>{pointer.active=false;locked=null;if(!keyboard)hideTip()};
 surface.onpointercancel=()=>{pointer.active=false;locked=null;if(!keyboard)hideTip()};
 const instance={stopped:false,raf:0};active=instance;
 function tick(ms){
  if(instance.stopped)return;
  if(!svg.closest('.view.active')){instance.raf=global.requestAnimationFrame(tick);return}
  const dt=clamp((ms-(lastTime||ms))/16.7,.45,2);lastTime=ms;
  const focus=keyboard||locked;
  for(const p of all){if(!shown.has(p.s.id))continue;const caught=pointer.active&&locked===p.s.id;
   let fx=(p.homeX-p.x)*.035,fy=(p.homeY-p.y)*.035;
   if(caught&&!reduce){fx=(pointer.x-p.x)*.15;fy=(pointer.y-p.y)*.15}
   else if(pointer.active&&!reduce){
    const dx=p.x-pointer.x,dy=p.y-pointer.y,d=Math.hypot(dx,dy)||1;
    if(d<90){const f=(1-d/90)**2*.44;fx+=dx/d*f;fy+=dy/d*f}
   }
   if(focus!==null&&focus!==undefined&&focus!==p.s.id&&adj.get(focus)?.has(p.s.id)&&!reduce){
    const center=byId.get(focus),dx=p.homeX-center.homeX,dy=p.homeY-center.homeY,d=Math.hypot(dx,dy)||1;
    fx+=dx/d*.23;fy+=dy/d*.23;
   }
   if(!caught&&!reduce){fx+=.0019*Math.sin(ms*.0008+p.s.si);fy+=.0019*Math.cos(ms*.0007+p.s.di)}
   p.vx=reduce?0:(p.vx+fx*dt)*Math.pow(caught?.54:.85,dt);
   p.vy=reduce?0:(p.vy+fy*dt)*Math.pow(caught?.54:.85,dt);
   p.x=reduce?p.homeX:p.x+p.vx*dt;p.y=reduce?p.homeY:p.y+p.vy*dt;
   elements.get(p.s.id).g.setAttribute('transform',`translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`);
  }
  for(const e of paths){const a=byId.get(e.a),b=byId.get(e.b);
   if(!shown.has(e.a)||!shown.has(e.b)){e.el.style.display='none';continue}e.el.style.display='';
   const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
   const bow=e.type==='semantic'?Math.min(38,d*.16):e.type==='branch'?11:0;
   const mx=(a.x+b.x)/2-dy/d*bow,my=(a.y+b.y)/2+dx/d*bow;
   e.el.setAttribute('d',bow?`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`:`M ${a.x} ${a.y} L ${b.x} ${b.y}`);
   const highlighted=[focus,selected].some(id=>id&&(e.a===id||e.b===id));
   e.el.style.strokeOpacity=highlighted?'.95':e.type==='semantic'?'.53':e.type==='branch'?'.46':'.27';
   e.el.style.strokeWidth=highlighted?'2.5':'';
  }
  for(const [id,el] of elements){const highlight=id===focus||id===selected;
   const dim=(focus||selected)&&!highlight&&!adj.get(focus||selected)?.has(id);
   el.g.style.opacity=dim?'.33':'1';
   el.star.setAttribute('r',highlight?7:el.p.signal.rated?4.25:3);
   el.star.setAttribute('opacity',highlight?'1':el.p.signal.glow);
   el.glow.setAttribute('opacity',highlight?'.6':el.p.signal.rated?String(el.p.signal.glow*.16):'0');
   el.ring.setAttribute('r',highlight?12:7);
   el.ring.setAttribute('stroke-opacity',highlight?'.95':el.p.signal.rated?'.55':'.16');
  }
  if(focus){showTip(focus);tipAt(byId.get(focus))}else hideTip();
  trailLayer.replaceChildren();if(pointer.active&&!reduce){
   trail=trail.filter(v=>v.life-->0);
   for(const p of trail)ns('circle',{cx:p.x,cy:p.y,r:1+p.life/12,fill:'#72e9d6',opacity:p.life/190},trailLayer);
  }
  instance.raf=global.requestAnimationFrame(tick);
 }
 tick(0);
 const chosen=byId.get(selected)?.s,answer=chosen&&profile.surveys?.[chosen.id];
 detail.innerHTML=chosen?`<div class="eyebrow">SKILL SIGNAL</div><h3>${esc(chosen.name)}</h3><p>${esc(chosen.task)}</p>
 <dl><dt>Domain</dt><dd>${esc(chosen.domain)}</dd><dt>Self-reported confidence</dt><dd>${answer?esc(answer.confidence)+'/4':'Unanswered / unknown'}</dd><dt>Execution mode</dt><dd>${answer?esc(modeLabel(answer.method)):'Not reported'}</dd><dt>Experience mention</dt><dd>${profile.confirmed.includes(chosen.id)?'Employee confirmed':'Not confirmed'}</dd><dt>Qualifications</dt><dd>Not verified in the MVP</dd></dl>
 <button class="secondary" id="graphAction">Reflect on task ↗</button>`:
 `<div class="eyebrow">SKILL GALAXY</div><h3>Connected human capability</h3><p>Each colored cluster is a skill domain. Branches connect skills within a discipline; amber bridges connect related capabilities across disciplines.</p><p>Brighter stars reflect higher self-reported task confidence. Grey stars are unrated, not incapable. Move near a star to identify and catch it.</p><p>No astrology or personnel proficiency ranking.</p>`;
 if(chosen){
  const next=[...(adj.get(chosen.id)||[])].filter(k=>shown.has(k)).slice(0,12);
  if(next.length){
   const section=document.createElement('section');section.className='sky-relationships';
   section.innerHTML='<h4>Connected capabilities ('+next.length+')</h4><p>Conceptual skill links—not recorded employee collaboration or authoritative prerequisites.</p>'+
    next.map(k=>'<button class="sky-related" data-related-skill="'+esc(k)+'">'+esc(byId.get(k).s.name)+'</button>').join('');
   detail.appendChild(section);section.addEventListener('click',e=>{const b=e.target.closest('[data-related-skill]');if(b)onSelect?.(b.dataset.relatedSkill)});
  }
  detail.querySelector('#graphAction').onclick=()=>onReflect?.(chosen.id);
 }
 legend.innerHTML='<span class="legend-item"><i style="background:#5fe8c5"></i>Rated: confidence brightness</span>'+
  '<span class="legend-item"><i style="background:#8096b7"></i>Unrated / unknown</span>'+
  '<span class="legend-item"><i style="background:#dfad79"></i>Cross-domain knowledge bridges</span>'+
  '<span class="legend-item"><i style="background:#65e0c9"></i>Within-domain branches</span>';
 return {name:'Capability galaxy',known:Object.keys(profile.surveys||{}).length,clusters:13,relations:edges.length};
}
global.SynapseSky={render,stop,layout,strength,bridges};
})(window);
