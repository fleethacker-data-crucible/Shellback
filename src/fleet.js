(function fleetFactory(global){
'use strict';
let ctx=null,tab='compose';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&#39;'}[c]));
const skillName=id=>ctx.skills.find(s=>s.id===id)?.name||id;
const known=id=>ctx.skills.some(s=>s.id===id);
const activeTeam=()=>{let s=ctx.get();return s.teams?.items?.find(t=>t.id===s.teams.active)};
const allPeople=t=>[...(t?.members||[]),...(ctx.get().profile.consent&&ctx.get().profile.confirmed.length?[{
id:'my-local-self',name:'My local profile',skills:ctx.get().profile.confirmed, surveys:{},self:true
}]:[])];
const distinct=x=>[...new Set(x)];
function getState(){
 const s=ctx.get();if(!s.fleetPlans||typeof s.fleetPlans!=='object'||Array.isArray(s.fleetPlans))s.fleetPlans={};
 const t=activeTeam();if(!t)return {people:[],members:[],mission:[],selected:[],team:null};
 const p=s.fleetPlans[t.id]||{};
 const people=allPeople(t),ids=new Set(people.map(x=>x.id));
 const mission=distinct(Array.isArray(p.mission)?p.mission.filter(known):(t.priorities||[]).filter(known)).slice(0,25);
 const selected=distinct(Array.isArray(p.selected)?p.selected.filter(id=>ids.has(id)):people.map(x=>x.id));
 const normalized={mission,selected};s.fleetPlans[t.id]=normalized;
 return {people,mission,selected,team:t};
}
function save(fn){const m=getState(),p=ctx.get().fleetPlans[m.team?.id];if(!p)return;fn(p);ctx.persist();render()}
function scores(people,mission){
 return mission.map(id=>{
  const claimed=people.filter(p=>p.skills?.includes(id));
  const independent=people.filter(p=>p.surveys?.[id]?.method==='independent'&&Number(p.surveys[id].confidence)>=3);
  const guided=people.filter(p=>['guided','ai'].includes(p.surveys?.[id]?.method));
  return {id,claimed,independent,guided};
 })
}
function open(tabname){
 tab=tabname;
 for(const [key,id] of [['compose','fleetComposer'],['mentors','fleetMentors'],['relay','fleetRelay']])$(id).hidden=key!==tabname;
 document.querySelectorAll('[data-fleet-tab]').forEach(el=>{const on=el.dataset.fleetTab===tabname;el.setAttribute('aria-pressed',String(on));el.classList.toggle('fleet-tab-active',on)});
 render();
}
function render(){
 if(!ctx||!$('fleetLab'))return;
 const {people,mission,selected,team}=getState();if(!team)return;
 const chosen=people.filter(p=>selected.includes(p.id));
 $('fleetMissionSkills').innerHTML=mission.length?mission.map(id=>`<span class="focus-pill">${esc(skillName(id))}<button type="button" data-fleetremove="${esc(id)}" aria-label="Remove mission skill">×</button></span>`).join(''):'<p class="empty">No mission needs yet. Add a capability to explore team coverage.</p>';
 const add=$('fleetAddSkill'),val=add.value;
 add.innerHTML=ctx.skills.map(sk=>`<option value="${esc(sk.id)}">${esc(sk.name)}</option>`).join('');
 if(known(val))add.value=val;
 $('fleetRoster').innerHTML=people.length?people.map(p=>`<label class="fleet-roster-entry"><input type="checkbox" data-fleetperson="${esc(p.id)}" ${selected.includes(p.id)?'checked':''}><span><strong>${esc(p.name)}</strong><small>${p.synthetic?'Synthetic sample':p.self?'Local profile':'Voluntarily imported card'} · ${(p.skills||[]).length} self-declared mentions</small></span></label>`).join(''):'<div class="empty">Import voluntary peer cards into this team first.</div>';
 const coverage=scores(chosen,mission);
 $('fleetCompositionResult').innerHTML=mission.length?`<h4>Proposed team coverage (${chosen.length} opted-in profiles selected)</h4>
 <p class="muted">This planning comparison deliberately does not assign individuals any fit, readiness, or performance score.</p>`+
 coverage.map(r=>`<div class="fleet-skill-result"><div><strong>${esc(skillName(r.id))}</strong><small>${r.claimed.length} declared experience mention(s) · ${r.independent.length} optional independent task response(s)</small></div><span class="tiny-pill">${r.claimed.length===0?'NO SHARED EVIDENCE':r.claimed.length===1?'SINGLE SOURCE':'SHARED COVERAGE'}</span></div>`).join(''):'<div class="empty">Select or add mission skills to begin team composition.</div>';
 const mentor=$('fleetMentorSkill'),mentVal=mentor.value;mentor.innerHTML=ctx.skills.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
 if(known(mentVal))mentor.value=mentVal;const id=mentor.value;
 const matched=people.filter(p=>p.skills?.includes(id));
 $('fleetMentorMatches').innerHTML=matched.length?matched.map(p=>{
  const response=p.surveys?.[id];return `<div class="fleet-skill-result"><div><strong>${esc(p.name)}</strong><small>${esc(skillName(id))} · reviewed mention${p.synthetic?' · SYNTHETIC':''}</small></div><span class="tiny-pill">${response?`Shared self-report ${response.confidence}/4 · ${esc(response.method)}`:'CONFIDENCE NOT SHARED'}</span></div>`;
 }).join(''):'<div class="empty">No peer has voluntarily shared a confirmed mention for this skill. This does not mean no expert exists.</div>';
 const relayIds=distinct([...mission,...(team.priorities||[])]);
 const allCovered=scores(people,relayIds);
 const single=allCovered.filter(x=>x.claimed.length<=1);
 const watch=single.length?single:allCovered;
 $('fleetRelayList').innerHTML=watch.length?watch.map(r=>{
  const names=r.claimed.map(p=>p.name),issue=r.claimed.length===0?'Unrepresented in shared cards':r.claimed.length===1?'Only one person has shared this skill':'Multiple shared mentions';
  return `<div class="fleet-skill-result"><div><strong>${esc(skillName(r.id))}</strong><small>${esc(issue)}${names.length?' · '+esc(names.join(', ')):''}</small></div><span class="tiny-pill">${r.independent.length} optional independent responses</span></div>`;
 }).join(''):'<div class="empty">Set priority capabilities in the team area or add mission skills in Team composer to build a transfer watchlist.</div>';
}
function init(options){
 ctx=options;
 document.querySelectorAll('[data-fleet-tab]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.fleetTab)));
 $('fleetAddSkillBtn').onclick=()=>{const id=$('fleetAddSkill').value;if(!known(id))return;save(p=>{if(!p.mission.includes(id))p.mission.push(id)})};
 $('fleetMissionSkills').onclick=e=>{const b=e.target.closest('[data-fleetremove]');if(b)save(p=>p.mission=p.mission.filter(id=>id!==b.dataset.fleetremove))};
 $('fleetRoster').onchange=e=>{const box=e.target.closest('[data-fleetperson]');if(!box)return;save(p=>{p.selected=box.checked?distinct([...p.selected,box.dataset.fleetperson]):p.selected.filter(id=>id!==box.dataset.fleetperson)})};
 $('fleetMentorSkill').onchange=render;
 $('teamSelect')?.addEventListener('change',()=>queueMicrotask(render));
 render();
}
global.SynapseFleet={init,render,open,scores};
})(window);
