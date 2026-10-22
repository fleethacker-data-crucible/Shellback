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
function layout(skills,profile,pending=[]){
 const pendingSet=new Set(pending),confirmed=new Set(profile.confirmed||[]);
 const hubs=Array.from({length:13},(_,di)=>{
  const angle=di*GOLDEN-.45,rad=64+Math.sqrt((di+.7)/13)*190;
  const group=skills.filter(s=>s.di===di),claims=group.filter(s=>confirmed.has(s.id)).length,suggestions=group.filter(s=>pendingSet.has(s.id)).length,boost=claims*4+suggestions*2;
  return {di,x:475+Math.cos(angle)*(rad*1.37+boost),y:275+Math.sin(angle)*(rad*.88+boost*.38)}
 });
 return skills.map(s=>{
  const h=hubs[s.di],a=(s.si*GOLDEN)+s.di*.37,r=24+Math.sqrt((s.si+1)/8)*52;
  // Slight rebalancing of orbits is driven by volunteered signals, not demographics.
  const claim=profile.confirmed?.includes(s.id),signal=strength(s,profile);
  const x=h.x+Math.cos(a)*(r+(claim?4:0)),y=h.y+Math.sin(a)*r*.78;
  return {s,x,y,homeX:x,homeY:y,signal,confirmed:confirmed.has(s.id),pending:pendingSet.has(s.id)};
 });
}
function render(o){
 stop();
 const {svg,surface,detail,legend,skills,domains,colors,profile,filter='all',query='',selected=null,pending=[],scope='focus',onSelect,onReflect,modeLabel}=o;
 const all=layout(skills,profile,pending),byId=new Map(all.map(p=>[p.s.id,p])),pendingSet=new Set(pending);
 // Before onboarding, exploration displays the full taxonomy. Once the
 // employee attests to skills, only domains with confirmed capabilities are
 // shown by default. A résumé-only draft focuses on pending candidate domains.
 const attested=new Set(profile.confirmed||[]),profileStarted=attested.size>0||pendingSet.size>0;
 const activeDomains=new Set(skills.filter(s=>scope==='all'||!profileStarted||((attested.size?attested:pendingSet).has(s.id))).map(s=>s.di));
 const displayed=new Set(skills.filter(s=>activeDomains.has(s.di)&&(filter==='all'||s.di===Number(filter))&&(!query||`${s.name} ${s.domain}`.toLowerCase().includes(query.toLowerCase()))).map(s=>s.id));
 const adj=new Map,edges=[],seen=new Set;
 function link(a,b,type='local'){
  if(!byId.has(a)||!byId.has(b)||a===b)return;
  const key=[a,b].sort().join('|');if(seen.has(key))return;seen.add(key);
  edges.push({a,b,type});
  for(const [u,v] of [[a,b],[b,a]]){if(!adj.has(u))adj.set(u,new Set);adj.get(u).add(v)}
 }
 for(let di=0;di<13;di++){const arr=skills.filter(s=>s.di===di).sort((a,b)=>a.si-b.si);for(let i=0;i<arr.length-1;i++)link(arr[i].id,arr[i+1].id);for(const idx of [2,4,6,7])link(arr[0]?.id,arr[idx]?.id,'branch')}
 for(const [a,b] of bridges)link(a,b,'semantic');
 const ns=(tag,attrs={},parent=svg)=>{const el=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));parent.appendChild(el);return el};
 svg.replaceChildren();svg.setAttribute('viewBox','0 0 950 550');
 const defs=ns('defs'),nebula=ns('radialGradient',{id:'galaxy-nebula',cx:'50%',cy:'50%',r:'50%'},defs);
 ns('stop',{offset:'0%','stop-color':'#4feacf','stop-opacity':'.16'},nebula);
 ns('stop',{offset:'45%','stop-color':'#537bc2','stop-opacity':'.08'},nebula);
 ns('stop',{offset:'100%','stop-color':'#0b1230','stop-opacity':'0'},nebula);
 const glow=ns('filter',{id:'galaxy-glow',x:'-160%',y:'-160%',width:'420%',height:'420%'},defs);
 ns('feGaussianBlur',{stdDeviation:'5',result:'b'},glow);const merge=ns('feMerge',{},glow);ns('feMergeNode',{in:'b'},merge);ns('feMergeNode',{in:'SourceGraphic'},merge);
 const sky=ns('g',{'aria-hidden':'true'}),hubLayer=ns('g',{'aria-hidden':'true'}),edgeLayer=ns('g',{'aria-hidden':'true'}),starLayer=ns('g');
 ns('ellipse',{cx:475,cy:275,rx:470,ry:277,fill:'url(#galaxy-nebula)'},sky);
 for(let i=0;i<260;i++){let theta=i*GOLDEN,r=10+Math.sqrt(i/260)*273;
  ns('circle',{cx:(475+Math.cos(theta)*r*1.58).toFixed(1),cy:(275+Math.sin(theta)*r*.96).toFixed(1),r:i%17===0?1.2:.55,fill:i%9===0?'#aeafe9':'#a9e5f3',opacity:i%9===0?.27:.11},sky)}
 const countByDomain=Array.from({length:13},(_,di)=>({confirmed:all.filter(p=>p.s.di===di&&p.confirmed).length,pending:all.filter(p=>p.s.di===di&&p.pending).length}));
 for(let di=0;di<13;di++){
  if(!activeDomains.has(di))continue;
  const angle=di*GOLDEN-.45,rad=64+Math.sqrt((di+.7)/13)*190,stats=countByDomain[di],boost=stats.confirmed*4+stats.pending*2;
  const x=475+Math.cos(angle)*(rad*1.37+boost),y=275+Math.sin(angle)*(rad*.88+boost*.38),g=ns('g',{class:'galaxy-domain-hub','data-domain':di},hubLayer);
  ns('circle',{cx:x,cy:y,r:66+stats.confirmed*2+stats.pending,fill:colors[di],opacity:.016+stats.confirmed*.011+stats.pending*.004},g);
  ns('circle',{cx:x,cy:y,r:37+stats.confirmed*1.5,fill:'none',stroke:colors[di],'stroke-width':stats.confirmed?1.35:.75,'stroke-opacity':stats.confirmed?.45:.18,'stroke-dasharray':stats.confirmed?'2 5':'2 8'},g);
  ns('circle',{cx:x,cy:y,r:5+stats.confirmed*1.5,fill:colors[di],opacity:stats.confirmed?.42:.12,filter:'url(#galaxy-glow)'},g);
  const label=ns('text',{class:'galaxy-domain-label',x:x+12,y:y-18},g);
  label.textContent=domains[di][0];
  if(stats.confirmed||stats.pending){const text=ns('text',{class:'galaxy-domain-count',x:x+12,y:y-5},g);text.textContent=[stats.confirmed?stats.confirmed+' confirmed':'',stats.pending?stats.pending+' suggested':''].filter(Boolean).join(' · ')}
 }
 const paths=edges.map(e=>({...e,el:ns('path',{class:`sky-link sky-${e.type}`,'data-relation-type':e.type,'data-relation-a':e.a,'data-relation-b':e.b,fill:'none'},edgeLayer)}));
 const drawn=new Map();
 for(const p of all){if(!displayed.has(p.s.id))continue;
  const g=ns('g',{class:'sky-skill-node'+(p.confirmed?' is-confirmed':'')+(p.pending?' is-pending':''),'data-skill':p.s.id,tabindex:0,role:'button','aria-label':p.s.name},starLayer);
  const halo=ns('circle',{r:p.confirmed?16:14,fill:colors[p.s.di],opacity:p.signal.rated?.14:p.confirmed?.13:.035,filter:'url(#galaxy-glow)'},g);
  const orbit=ns('circle',{r:p.confirmed?11:p.pending?10:7,fill:'none',stroke:p.pending?'#ffca8a':colors[p.s.di],'stroke-width':p.pending?2:p.confirmed?1.8:1,'stroke-opacity':p.pending?.96:p.confirmed?.8:.14,'stroke-dasharray':p.pending?'2 3':'none'},g);
  const star=ns('circle',{r:p.signal.rated?4.6:p.confirmed?4.3:3.3,fill:p.pending?'#f4b874':p.confirmed||p.signal.rated?colors[p.s.di]:'#8195b2',opacity:p.pending?.88:p.confirmed?.96:p.signal.glow},g);
  ns('circle',{r:16,fill:'transparent','pointer-events':'all',class:'sky-hit-target'},g);
  ns('title',{},g).textContent=p.s.name;
  g.addEventListener('click',e=>{if(dragMoved){dragMoved=false;e.preventDefault();return}onSelect?.(p.s.id)});
  g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.(p.s.id)}});
  g.addEventListener('focus',()=>{keyboard=p.s.id;showTip(p.s.id);draw()});
  g.addEventListener('blur',()=>{keyboard=null;if(!hover)hideTip();draw()});
  drawn.set(p.s.id,{g,star,orbit,halo});
 }
 const tooltip=surface.querySelector('#graphHoverTip');let hover=null,keyboard=null,drag=null,dragMoved=false;
 function hideTip(){if(tooltip)tooltip.hidden=true}
 function showTip(id){const p=byId.get(id);if(!p||!displayed.has(id)||!tooltip)return hideTip();
  const cross=edges.filter(e=>e.type==='semantic'&&(e.a===id||e.b===id)).map(e=>e.a===id?e.b:e.a);
  const nearby=[...new Set([...cross,...(adj.get(id)||[])])].filter(x=>displayed.has(x)).slice(0,3).map(x=>byId.get(x).s.name);
  tooltip.innerHTML=`<strong>${esc(p.s.name)}</strong><span>${esc(p.s.domain)}</span><small>${p.signal.rated?'Self-reported confidence '+p.signal.value+'/4':p.confirmed?'Employee-confirmed experience; confidence unanswered':p.pending?'Résumé keyword suggestion · not confirmed':'No confidence or experience response'}</small>${nearby.length?'<small class="sky-tip-related">Linked: '+esc(nearby.join(' · '))+'</small>':''}`;
  tooltip.hidden=false;const box=surface.getBoundingClientRect(),svgBox=svg.getBoundingClientRect(),sc=Math.min(svgBox.width/950,svgBox.height/550);
  const x=svgBox.left-box.left+(svgBox.width-950*sc)/2+p.x*sc,y=svgBox.top-box.top+(svgBox.height-550*sc)/2+p.y*sc;
  tooltip.style.left=clamp(x+19,8,Math.max(8,box.width-(tooltip.offsetWidth||215)-9))+'px';
  tooltip.style.top=clamp(y-(tooltip.offsetHeight||82)-12,8,Math.max(8,box.height-(tooltip.offsetHeight||82)-9))+'px';
 }
 function coords(e){const rect=svg.getBoundingClientRect(),sc=Math.min(rect.width/950,rect.height/550)||1;return {x:(e.clientX-rect.left-(rect.width-950*sc)/2)/sc,y:(e.clientY-rect.top-(rect.height-550*sc)/2)/sc}}
 function near(x,y){let best=null,dist=17;for(const p of all){if(!displayed.has(p.s.id))continue;let d=Math.hypot(p.x-x,p.y-y);if(d<dist){dist=d;best=p.s.id}}return best}
 function draw(){
  for(const p of all){const el=drawn.get(p.s.id);if(el)el.g.setAttribute('transform',`translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`)}
  const focus=drag?.id||keyboard||hover||selected;
  for(const e of paths){const a=byId.get(e.a),b=byId.get(e.b);if(!displayed.has(e.a)||!displayed.has(e.b)){e.el.style.display='none';continue}e.el.style.display='';
   const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,bow=e.type==='semantic'?Math.min(32,len*.13):e.type==='branch'?9:0,mx=(a.x+b.x)/2-dy/len*bow,my=(a.y+b.y)/2+dx/len*bow;
   e.el.setAttribute('d',bow?`M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`:`M${a.x} ${a.y} L${b.x} ${b.y}`);
   e.el.style.strokeOpacity=focus&&(e.a===focus||e.b===focus)?'.95':e.type==='semantic'?'.49':e.type==='branch'?'.40':'.23';
   e.el.style.strokeWidth=focus&&(e.a===focus||e.b===focus)?'2.4':'';
  }
  for(const [id,{g,orbit,star,halo}] of drawn){let on=id===focus,related=focus&&adj.get(focus)?.has(id);
   g.style.opacity=focus&&!on&&!related?.48:'1';orbit.setAttribute('r',on?13:byId.get(id).confirmed?11:byId.get(id).pending?10:7);
   star.setAttribute('r',on?6.8:byId.get(id).signal.rated?4.6:byId.get(id).confirmed?4.3:3.3);
   halo.setAttribute('opacity',on?.48:byId.get(id).confirmed?.15:.04)}
 }
 // Hover only updates labels / selected connection styling. It never moves nodes.
 surface.onpointermove=e=>{
  const p=coords(e);
  if(drag&&drag.pointerId===e.pointerId){
   const diff=Math.hypot(p.x-drag.start.x,p.y-drag.start.y);
   if(diff>3){dragMoved=true;drag.started=true}
   if(drag.started){const center=byId.get(drag.id),dx=p.x-drag.prev.x,dy=p.y-drag.prev.y;
    center.x=clamp(center.x+dx,15,935);center.y=clamp(center.y+dy,15,535);
    // Neighbor movement occurs ONLY while a node is actively being dragged.
    for(const key of adj.get(drag.id)||[]){let q=byId.get(key);if(!q||!displayed.has(key))continue;q.x=clamp(q.x+dx*.13,15,935);q.y=clamp(q.y+dy*.13,15,535)}
    draw();showTip(drag.id)}
   drag.prev=p;return
  }
  const id=near(p.x,p.y);if(id!==hover){hover=id;draw()}if(id)showTip(id);else if(!keyboard)hideTip();
 };
 surface.onpointerdown=e=>{
  if(e.button!==0)return;const pos=coords(e),target=e.target.closest?.('.sky-skill-node'),id=target?.dataset.skill||near(pos.x,pos.y);if(!id)return;
  drag={id,pointerId:e.pointerId,start:pos,prev:pos,started:false};dragMoved=false;hover=id;showTip(id);draw();
  try{surface.setPointerCapture(e.pointerId)}catch{}
 };
 function release(e){if(!drag||e.pointerId!==drag.pointerId)return;const id=drag.id,wasMoved=drag.started;drag=null;draw();try{surface.releasePointerCapture(e.pointerId)}catch{}if(!wasMoved){dragMoved=true;onSelect?.(id)}}
 surface.onpointerup=release;surface.onpointercancel=release;
 surface.onpointerleave=()=>{if(!drag){hover=null;if(!keyboard)hideTip();draw()}};
 draw();
 const chosen=displayed.has(selected)?byId.get(selected)?.s:null,answer=chosen&&profile.surveys?.[chosen.id];
 detail.innerHTML=chosen?`<div class="eyebrow">CAPABILITY DETAIL</div><h3>${esc(chosen.name)}</h3><p>${esc(chosen.task)}</p><dl><dt>Discipline</dt><dd>${esc(chosen.domain)}</dd><dt>Profile signal</dt><dd>${profile.confirmed?.includes(chosen.id)?'Employee confirmed':pendingSet.has(chosen.id)?'Unreviewed résumé candidate':'Not provided'}</dd><dt>Self-reported confidence</dt><dd>${answer?esc(answer.confidence)+'/4':'Not answered'}</dd><dt>Execution mode</dt><dd>${answer?esc(modeLabel(answer.method)):'Not reported'}</dd><dt>Verification</dt><dd>Not established</dd></dl><button class="secondary" id="graphAction">Reflect on this task ↗</button>`:
 `<div class="eyebrow">YOUR CAPABILITY UNIVERSE</div><h3>Read the galaxy at a glance</h3><p>Each visible cluster is a relevant discipline. Only disciplines with attested skills appear once you have a confirmed profile. Use “Show all domains” to explore the full taxonomy.</p><p><b>Mint ring</b> = you confirmed experience. <b>Amber dotted ring</b> = awaiting review after résumé intake. Brightness inside a star = voluntary confidence reflection.</p><p><b>Hover</b> to identify a skill without moving anything. <b>Click</b> to pin its relationships. <b>Click, hold and drag</b> a star to rearrange its network.</p><p class="muted">No inferred proficiency, qualification or personnel fitness score.</p>`;
 if(chosen){
  const next=[...(adj.get(chosen.id)||[])].filter(x=>displayed.has(x)).slice(0,12);
  if(next.length){const section=document.createElement('section');section.className='sky-relationships';section.innerHTML='<h4>Linked capabilities</h4><p>Conceptual learning pathways, not observed coworker interactions.</p>'+next.map(k=>`<button class="sky-related" data-related-skill="${esc(k)}">${esc(byId.get(k).s.name)}</button>`).join('');detail.appendChild(section);section.onclick=e=>{const b=e.target.closest('[data-related-skill]');if(b)onSelect?.(b.dataset.relatedSkill)}}
  detail.querySelector('#graphAction').onclick=()=>onReflect?.(chosen.id);
 }
 const c=all.filter(p=>p.confirmed).length,a=all.filter(p=>p.pending).length;
 legend.innerHTML=`<span class="legend-item"><i style="background:#5de7d2"></i>${c} confirmed experience</span><span class="legend-item"><i style="background:#f3bd76"></i>${a} résumé candidates</span><span class="legend-item"><i style="background:#98aec6"></i>Grey = no response</span><span class="legend-item"><i style="background:#e0ad79"></i>Cross-domain links</span>`;
 return {name:'Capability galaxy',known:Object.keys(profile.surveys||{}).filter(id=>attested.has(id)).length,clusters:activeDomains.size,relations:edges.length,confirmed:c,pending:a,visible:displayed.size,focused:scope!=='all'&&profileStarted};
}
global.SynapseSky={render,stop,layout,strength,bridges};
})(window);
