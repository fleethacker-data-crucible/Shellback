(function teamFactory(global){
'use strict';
let ctx=null, selectedPeer=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rnd=()=>{let bytes=new Uint8Array(10);if(global.crypto?.getRandomValues)global.crypto.getRandomValues(bytes);else bytes=bytes.map(()=>Math.floor(Math.random()*256));return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('')};
const id=()=>`sp-${rnd()}`;
const known=id=>ctx.skills.some(s=>s.id===id);
function defaultTeams(){
 const members=ctx.synthetics.map((p,i)=>({id:`demo-${i}`,name:p.name,skills:p.skills.filter(known),surveys:Object.fromEntries(p.skills.filter(known).slice(0,5).map((skill,j)=>[skill,{confidence:(i+j)%3===0?4:3,method:(i+j)%4===0?'ai':'independent'}])),synthetic:true,issued:'2026-10-21'}));
 return {active:'team-demo',items:[{id:'team-demo',name:'Synthetic demo cohort',members,priorities:['aws-architecture','sql-pipelines','qualification-planning']}]};
}
function ensure(){
 let state=ctx.get();if(!state.teams||!Array.isArray(state.teams.items)||!state.teams.items.length)state.teams=defaultTeams();
 if(!state.teams.items.some(t=>t.id===state.teams.active))state.teams.active=state.teams.items[0].id;
}
function current(){ensure();return ctx.get().teams.items.find(t=>t.id===ctx.get().teams.active)}
function note(msg){$('teamExchangeStatus').textContent=msg;ctx.flash(msg)}
function save(){ctx.persist();render()}
function download(obj,name){let url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));let a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),600)}
function personCard(){
 const s=ctx.get(),display=$('shareName').value.trim().slice(0,70);
 if(!display)throw Error('Enter a display name.');
 if(!s.profile.confirmed.length)throw Error('Confirm at least one experience mention before sharing.');
 const shareScores=$('includeSurveyShare').checked,ratings={};
 if(shareScores)for(const [key,r] of Object.entries(s.profile.surveys)){if(known(key)&&Number.isInteger(Number(r.confidence))&&Number(r.confidence)>=0&&Number(r.confidence)<=4)ratings[key]={confidence:Number(r.confidence),method:['independent','ai','guided','none'].includes(r.method)?r.method:'none'}}
 if(!s.profile.shareId)s.profile.shareId=id();
 const extra=s.workforce?.mentorship||{};
 const shareMentor=$('includeMentorShare').checked,shareQualifications=$('includeQualificationShare').checked;
 return {format:'synapse-peer-card',version:1,id:s.profile.shareId,name:display,consent:true,issued:new Date().toISOString().slice(0,10),skills:[...new Set(s.profile.confirmed.filter(known))],surveys:ratings,
  ...(shareMentor?{mentorOptIn:extra.enabled===true,mentorTopics:(extra.topics||[]).filter(known).slice(0,30),availability:['available','limited','unavailable','unknown'].includes(extra.availability)?extra.availability:'unknown',mentorIntro:String(extra.intro||'').slice(0,500)}:{}),
  ...(shareQualifications?{qualificationClaims:(s.profile.credentials||[]).map(c=>String(c.name||'').slice(0,160)).filter(Boolean).slice(0,100),qualificationDisclaimer:'employee-entered, unverified'}:{})};
}
function normalizeCard(value){
 if(!value||value.format!=='synapse-peer-card'||value.version!==1||value.consent!==true)throw Error('Not an opt-in Synapse peer card.');
 if(typeof value.id!=='string'||!/^[a-zA-Z0-9-]{8,70}$/.test(value.id)||typeof value.name!=='string'||!value.name.trim())throw Error('Invalid peer identifier or display name.');
 if(!Array.isArray(value.skills)||value.skills.length>104)throw Error('Invalid confirmed skill list.');
 const skills=[...new Set(value.skills.filter(x=>typeof x==='string'&&known(x)))];
 const surveys={};if(value.surveys&&typeof value.surveys==='object'&&!Array.isArray(value.surveys)){for(let [key,r] of Object.entries(value.surveys).slice(0,104)){if(!known(key)||!r||typeof r!=='object')continue;let v=Number(r.confidence);if(Number.isInteger(v)&&v>=0&&v<=4&&['none','independent','ai','guided'].includes(r.method))surveys[key]={confidence:v,method:r.method}}}
 return {id:value.id,name:value.name.trim().slice(0,70),skills,surveys,synthetic:false,issued:/^\d{4}-\d{2}-\d{2}$/.test(value.issued||'')?value.issued:'Unknown',
 mentorOptIn:value.mentorOptIn===true,mentorTopics:Array.isArray(value.mentorTopics)?[...new Set(value.mentorTopics.filter(known))].slice(0,30):[],
 availability:['available','limited','unavailable','unknown'].includes(value.availability)?value.availability:'unknown',
 mentorIntro:String(value.mentorIntro||'').slice(0,500),
 qualificationClaims:Array.isArray(value.qualificationClaims)?value.qualificationClaims.slice(0,100).filter(x=>typeof x==='string').map(x=>x.slice(0,160)):[]};
}
function participants(team){
 let people=[...(Array.isArray(team.members)?team.members:[])];
 const s=ctx.get();if(s.profile.consent&&s.profile.confirmed.length)people.push({id:'self-current',name:'My profile (local opt-in)',skills:s.profile.confirmed.filter(known),surveys:{},synthetic:false,self:true,mentorOptIn:s.workforce?.mentorship?.enabled===true,mentorTopics:s.workforce?.mentorship?.topics||[],availability:s.workforce?.mentorship?.availability||'unknown',qualificationClaims:(s.profile.credentials||[]).map(c=>c.name)});
 return people;
}
function build(team){
 let people=participants(team),n=people.length,domainCounts=Array(13).fill(0),skillCounts={},benchCounts={};
 for(const skill of ctx.skills){skillCounts[skill.id]=0;benchCounts[skill.id]=0}
 for(const p of people){const unique=[...new Set((p.skills||[]).filter(known))];for(const sid of unique){skillCounts[sid]++;const d=ctx.skills.find(s=>s.id===sid).di;domainCounts[d]++}for(const [sid,r] of Object.entries(p.surveys||{})){if(!known(sid))continue;if(r.method==='independent'&&Number(r.confidence)>=3)benchCounts[sid]++}}
 // domainCounts above counts all skills per person; recompute distinct people per domain.
 domainCounts=ctx.domains.map((_,di)=>people.filter(p=>(p.skills||[]).some(sid=>ctx.skills.some(s=>s.id===sid&&s.di===di))).length);
 return {people,n,domainCounts,skillCounts,benchCounts,allowed:n>=3};
}
function render(){
 if(!ctx)return;const team=current(),s=ctx.get();
 $('teamSelect').innerHTML=s.teams.items.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}${t.id==='team-demo'?' · synthetic':''}</option>`).join('');$('teamSelect').value=team.id;
 const {people,n,domainCounts,skillCounts,benchCounts,allowed}=build(team);
 $('teamStats').innerHTML=`<div><span>VOLUNTARY PROFILES</span><strong>${n}</strong><small>${team.id==='team-demo'?'Synthetic sample':'Local team workspace'}</small></div><div><span>DOMAINS REPRESENTED</span><strong>${allowed?domainCounts.filter(x=>x>0).length:'—'}</strong><small>${allowed?'Employee-declared, not verified':'Suppressed until 3 shared profiles'}</small></div><div><span>PRIORITY SKILLS</span><strong>${(team.priorities||[]).length}</strong><small>Development focus, not ranking</small></div>`;
 $('teamMemberList').innerHTML=people.length?people.map(p=>`<div class="team-member"><button class="text-button" data-peerview="${esc(p.id)}">${esc(p.name)}</button><span class="tiny-pill">${p.synthetic?'SYNTHETIC':p.self?'LOCAL':'SHARED CARD'}</span><span class="muted">${(p.skills||[]).length} reviewed mentions</span>${!p.self&&!p.synthetic?`<button class="danger" data-peerdel="${esc(p.id)}">Remove</button>`:''}</div>`).join(''):'<div class="empty">Empty team. Add peers using their opt-in JSON cards.</div>';
 const peer=people.find(p=>p.id===selectedPeer);
 $('teamPeerDetail').innerHTML=peer?`<div class="eyebrow">EMPLOYEE-SHARED FIELDS ONLY</div><h4>${esc(peer.name)}</h4><p>${peer.synthetic?'Entirely fictional.':peer.self?'Only local profile claims included here.':'Voluntarily shared capability card; not authenticated or verified.'}</p><div>${(peer.skills||[]).map(x=>`<span class="tiny-pill">${esc(ctx.skills.find(s=>s.id===x)?.name||x)}</span>`).join(' ')||'No confirmed skill mentions'}</div><p>${Object.keys(peer.surveys||{}).length} task confidence/execution response(s) voluntarily shared.${peer.synthetic?' (Synthetic responses)':''}</p><div>${Object.entries(peer.surveys||{}).map(([sid,r])=>`<div class="bench-row"><span>${esc(ctx.skills.find(s=>s.id===sid)?.name||sid)}</span><strong>${Number(r.confidence)}/4 · ${esc(r.method)}</strong></div>`).join('')}</div>`:'<p>Select a peer. Only fields they included in their card will appear.</p>';
 if(!allowed){const msg='<div class="empty">At least 3 opt-in profiles are needed for aggregate team analysis. Missing data must not be treated as a personnel gap.</div>';$('teamBars').innerHTML=msg;$('teamBench').innerHTML=msg;$('teamSkillGaps').innerHTML=msg}
 else{
 $('teamBars').innerHTML=ctx.domains.map(([d],i)=>`<div class="team-row"><span>${esc(d)}</span><div class="bar-track"><i style="width:${domainCounts[i]/n*100}%"></i></div><small>${domainCounts[i]} / ${n}</small></div>`).join('');
 const benchSkills=ctx.skills.filter(sk=>skillCounts[sk.id]>0&&benchCounts[sk.id]<=1).sort((a,b)=>benchCounts[a.id]-benchCounts[b.id]||skillCounts[a.id]-skillCounts[b.id]).slice(0,10);
 $('teamBench').innerHTML='<p class="muted">Self-reported independent method and confidence ≥3. “Unconfirmed bench” means no opt-in evidence, not lack of ability.</p>'+benchSkills.map(sk=>`<div class="bench-row"><span>${esc(sk.name)}</span><span>${benchCounts[sk.id]} self-reported independent / ${skillCounts[sk.id]} experience mentions</span></div>`).join('');
 const prioritySet=new Set(team.priorities||[]);const gaps=ctx.skills.filter(sk=>skillCounts[sk.id]<=1).sort((a,b)=>Number(prioritySet.has(b.id))-Number(prioritySet.has(a.id))||skillCounts[a.id]-skillCounts[b.id]).slice(0,16);
 $('teamSkillGaps').innerHTML=gaps.map(sk=>`<div class="bench-row"><span>${prioritySet.has(sk.id)?'★ ':''}${esc(sk.name)} <small class="muted">· ${esc(sk.domain)}</small></span><strong>${skillCounts[sk.id]===0?'No claims':'One contributor'}</strong></div>`).join('')||'<div class="empty">No uncovered or single-contributor skills in the shared dataset.</div>';
 }
 $('criticalSkill').innerHTML=ctx.skills.map(sk=>`<option value="${esc(sk.id)}">${esc(sk.name)}</option>`).join('');
 $('teamCritical').innerHTML=(team.priorities||[]).map(sid=>`<span class="focus-pill">${esc(ctx.skills.find(s=>s.id===sid)?.name||sid)} ${allowed?`· ${skillCounts[sid]||0} declared`:''} <button aria-label="Remove priority" data-criticalremove="${esc(sid)}">×</button></span>`).join('')||'<p class="muted">No priority skills selected.</p>';
 global.SynapseFleet?.render();
}
function init(options){
 ctx=options;ensure();
 $('teamSelect').onchange=e=>{ctx.get().teams.active=e.target.value;selectedPeer=null;save()};
 $('createTeam').onclick=()=>{const n=$('teamName').value.trim().slice(0,80);if(!n)return note('Enter a name for your team.');if(ctx.get().teams.items.length>=25)return note('Limit of 25 local team workspaces reached.');const t={id:'team-'+rnd(),name:n,members:[],priorities:[]};ctx.get().teams.items.push(t);ctx.get().teams.active=t.id;$('teamName').value='';selectedPeer=null;save();note(`Created ${n}. Import peer cards to populate it.`)};
 $('deleteTeam').onclick=()=>{let t=current();if(!confirm(`Delete local team "${t.name}" and its imported copies?`))return;ctx.get().teams.items=ctx.get().teams.items.filter(x=>x.id!==t.id);if(!ctx.get().teams.items.length)ctx.get().teams=defaultTeams();ctx.get().teams.active=ctx.get().teams.items[0].id;selectedPeer=null;save();note('Local team deleted.')};
 $('exportPeer').onclick=()=>{try{const c=personCard();if(!confirm(`Share ${c.skills.length} skill mention(s)${Object.keys(c.surveys).length?', plus '+Object.keys(c.surveys).length+' self-reported task responses':''}${$('includeMentorShare').checked?', mentoring/availability disclosures':''}${$('includeQualificationShare').checked?', employee-entered credential names':''} under the name "${c.name}"? The recipient can retain and redistribute this file.`))return;ctx.persist();download(c,`synapse-peer-${c.issued}.json`);note('Peer card exported. You control where to send it.')}catch(e){note(e.message)}};
 $('importPeerBtn').onclick=()=>$('importPeerFile').click();
 $('importPeerFile').onchange=async e=>{try{let f=e.target.files[0];if(!f)return;if(f.size>256000)throw Error('Peer card exceeds 256 KB.');let c=normalizeCard(JSON.parse(await f.text()));let t=current();if(t.members.length>=100&&!t.members.some(p=>p.id===c.id))throw Error('Team limit of 100 peer cards reached.');if(!confirm(`Import ${c.name}'s opt-in card (${c.skills.length} skills, ${Object.keys(c.surveys).length} optional survey signals${c.mentorOptIn?', mentoring opt-in':''}${c.qualificationClaims.length?', unverified qualification claims':''}) into "${t.name}"?`))return;t.members=t.members.filter(p=>p.id!==c.id);t.members.push(c);selectedPeer=c.id;save();note(`Imported ${c.name}'s card. Information is unverified.`)}catch(err){note('Import blocked: '+err.message)}finally{e.target.value=''}};
 $('teamMemberList').onclick=e=>{let v=e.target.closest('[data-peerview]'),d=e.target.closest('[data-peerdel]');if(v){selectedPeer=v.dataset.peerview;render()}if(d){let t=current();if(!confirm('Remove this imported peer card from your local team?'))return;t.members=t.members.filter(p=>p.id!==d.dataset.peerdel);selectedPeer=null;save()}};
 $('addCritical').onclick=()=>{let t=current(),sid=$('criticalSkill').value;if(!known(sid)||t.priorities.includes(sid))return;t.priorities.push(sid);save()};
 $('teamCritical').onclick=e=>{let b=e.target.closest('[data-criticalremove]');if(b){let t=current();t.priorities=t.priorities.filter(x=>x!==b.dataset.criticalremove);save()}};
 render();
}
global.SynapseTeam={init,render,ensure,normalizeCard,rank:()=>ctx?build(current()):null};
})(window);
