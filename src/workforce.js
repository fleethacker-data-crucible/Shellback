(function workforceFactory(global){
'use strict';
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const U=()=>global.crypto?.randomUUID?.()||`wf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now=()=>new Date().toISOString().slice(0,10);
const modes=['unknown','available','limited','unavailable'];
const trim=(v,n=240)=>String(v??'').trim().slice(0,n);
let ctx,tab='qualforge',revealed=false,selectedModule=null,filterSkill='all';
function fresh(){return {modules:[],attempts:[],goals:[],mentorship:{enabled:false,topics:[],availability:'unknown',intro:''},knowledge:[],mission:{requirements:[],selected:[],teamId:''}}}
function normalize(value,known){
 let w=fresh();if(!value||typeof value!=='object'||Array.isArray(value))return w;
 const list=(xs,n)=>Array.isArray(xs)?xs.slice(0,n):[];
 w.modules=list(value.modules,100).map(m=>({id:trim(m?.id,64)||U(),title:trim(m?.title,120),skill:known(m?.skill)?m.skill:'',source:trim(m?.source,220),question:trim(m?.question,1000),answer:trim(m?.answer,1600),scenario:trim(m?.scenario,1200),created:/^\d{4}-\d{2}-\d{2}$/.test(m?.created||'')?m.created:now()})).filter(m=>m.title&&m.question&&m.skill);
 const moduleIds=new Set(w.modules.map(m=>m.id));
 w.attempts=list(value.attempts,1000).map(a=>({moduleId:trim(a?.moduleId,64),result:a?.result==='reviewed'?'reviewed':'practice',date:/^\d{4}-\d{2}-\d{2}$/.test(a?.date||'')?a.date:now()})).filter(a=>moduleIds.has(a.moduleId));
 w.goals=list(value.goals,120).map(g=>({id:trim(g?.id,64)||U(),skill:known(g?.skill)?g.skill:'',target:trim(g?.target,250),due:/^\d{4}-\d{2}-\d{2}$/.test(g?.due||'')?g.due:'',status:g?.status==='done'?'done':'planned'})).filter(g=>g.skill&&g.target);
 const m=value.mentorship||{};w.mentorship={enabled:m.enabled===true,topics:list(m.topics,30).filter(known),availability:modes.includes(m.availability)?m.availability:'unknown',intro:trim(m.intro,500)};
 w.knowledge=list(value.knowledge,250).map(k=>({id:trim(k?.id,64)||U(),topic:trim(k?.topic,150),skill:known(k?.skill)?k.skill:'',owner:trim(k?.owner,90),context:trim(k?.context,1200),steps:trim(k?.steps,3000),handoff:trim(k?.handoff,1500),source:trim(k?.source,250),approved:k?.approved===true,created:/^\d{4}-\d{2}-\d{2}$/.test(k?.created||'')?k.created:now()})).filter(k=>k.topic&&k.skill);
 const mission=value.mission||{};w.mission={requirements:list(mission.requirements,40).map(r=>({id:trim(r?.id,64)||U(),skill:known(r?.skill)?r.skill:'',min:Math.max(1,Math.min(20,Math.round(Number(r?.min)||1))),credential:trim(r?.credential,100)})).filter(r=>r.skill),selected:list(mission.selected,100).filter(x=>typeof x==='string'&&x.length<=80),teamId:trim(mission.teamId,80)};
 return w
}
function data(){let s=ctx.get();if(!s.workforce||typeof s.workforce!=='object'||Array.isArray(s.workforce)||!Array.isArray(s.workforce.modules)||!Array.isArray(s.workforce.attempts)||!Array.isArray(s.workforce.goals)||!Array.isArray(s.workforce.knowledge)||!s.workforce.mentorship||!s.workforce.mission)s.workforce=normalize(s.workforce,id=>ctx.skills.some(x=>x.id===id));return s.workforce}
function team(){const s=ctx.get();return s.teams?.items?.find(t=>t.id===s.teams.active)}
function people(){const t=team(),p=[...(t?.members||[])];const s=ctx.get();if(s.profile.consent&&s.profile.confirmed.length)p.push({id:'self-current',name:'My local profile',skills:s.profile.confirmed,surveys:{},availability:data().mentorship.availability,mentorOptIn:data().mentorship.enabled,mentorTopics:data().mentorship.topics,qualificationClaims:(s.profile.credentials||[]).map(c=>c.name),self:true});return p}
function skill(id){return ctx.skills.find(x=>x.id===id)}
function name(id){return skill(id)?.name||id}
function options(selected='',all=false){return (all?'<option value="all">All capabilities</option>':'')+ctx.skills.map(s=>`<option value="${E(s.id)}"${selected===s.id?' selected':''}>${E(s.name)}</option>`).join('')}
function save(){ctx.persist();render();ctx.flash('Updated local Synapse workforce workspace.')}
function message(text){const el=$('workforceMessage');if(el)el.textContent=text;ctx.flash(text)}
function pane(id){tab=id;document.querySelectorAll('[data-workforce-tab]').forEach(b=>{const active=b.dataset.workforceTab===id;b.classList.toggle('wf-active',active);b.setAttribute('aria-pressed',String(active))});document.querySelectorAll('[data-workforce-pane]').forEach(p=>{p.hidden=p.dataset.workforcePane!==id});render()}
function moduleSelected(){let w=data();if(!w.modules.find(m=>m.id===selectedModule))selectedModule=w.modules[0]?.id||null;return w.modules.find(m=>m.id===selectedModule)}
function renderQual(){
 const w=data(),sel=$('wfModuleSelect'),prev=selectedModule;
 sel.innerHTML=w.modules.map(m=>`<option value="${E(m.id)}"${m.id===prev?' selected':''}>${E(m.title)}</option>`).join('');
 const m=moduleSelected();if(m)sel.value=m.id;
 $('wfModuleSkill').innerHTML=options();$('wfOutlineSkill').innerHTML=options();
 $('wfQualStats').innerHTML=`<div><span>STUDY GUIDES</span><strong>${w.modules.length}</strong></div><div><span>SELF-REVIEW ATTEMPTS</span><strong>${w.attempts.length}</strong></div><div><span>NEEDS REVISIT</span><strong>${w.modules.filter(m=>{const a=[...w.attempts].reverse().find(a=>a.moduleId===m.id);return a&&a.result==='practice'}).length}</strong></div>`;
 $('wfStudyArea').innerHTML=m?`<div class="eyebrow">LOCAL STUDY / UNVERIFIED</div><h4>${E(m.title)}</h4><p class="muted">${E(name(m.skill))} · Source: ${E(m.source||'Unspecified employee-supplied reference')}</p><h4>Knowledge check</h4><p>${E(m.question)}</p>${m.answer?'<div id="wfStudyAnswer" class="wf-answer" '+(revealed?'':'hidden')+'><strong>Employee-supplied reference answer</strong><p>'+E(m.answer)+'</p></div><button class="secondary" id="wfReveal">'+(revealed?'Hide reference':'Show reference')+'</button>':'<div class="notice">REVIEW REQUIRED — outline intake does not generate answer keys or validate official content. Add an answer checked against the approved source before recording self-practice.</div><label for="wfDraftReference">Employee-reviewed reference answer</label><textarea id="wfDraftReference" rows="4" maxlength="1600"></textarea><button id="wfDraftSave" class="primary">Complete study draft</button>'}<h4>Scenario reflection</h4><p>${E(m.scenario||'Explain when and how you would apply this task, and who would verify completion.')}</p><div class="button-row"><button id="wfReviewed" class="primary" ${m.answer?"":"disabled"}>I reviewed this task</button><button id="wfPractice" class="secondary" ${m.answer?"":"disabled"}>Needs more practice</button><button id="wfDeleteModule" class="danger">Delete guide</button></div><p class="note">Self-review records are learning activity only. No PQS sign-off, demonstration verification or readiness prediction is created.</p>`:'<div class="empty">Create a study guide using approved, nonsensitive learning material. No official PQS content is bundled or generated.</div>';
 if(m){if(m.answer){$('wfReveal').onclick=()=>{revealed=!revealed;renderQual()}}else{$('wfDraftSave').onclick=()=>{const answer=trim($('wfDraftReference').value,1600);if(!answer)return message('Review the approved source and supply the reference answer.');m.answer=answer;revealed=false;save()}};for(const [id,result] of [['wfReviewed','reviewed'],['wfPractice','practice']])$(id).onclick=()=>{w.attempts.push({moduleId:m.id,result,date:now()});if(w.attempts.length>1000)w.attempts.shift();save()};$('wfDeleteModule').onclick=()=>{if(!confirm('Delete this local study guide and its practice history?'))return;w.modules=w.modules.filter(x=>x.id!==m.id);w.attempts=w.attempts.filter(a=>a.moduleId!==m.id);selectedModule=null;revealed=false;save()}}
 $('wfStudyHistory').innerHTML=w.attempts.length?[...w.attempts].reverse().slice(0,12).map(a=>`<div class="wf-detail-line"><span>${E(w.modules.find(m=>m.id===a.moduleId)?.title||'Retired guide')}</span><small>${E(a.result==='reviewed'?'Self-reviewed':'Needs practice')} · ${E(a.date)}</small></div>`).join(''):'<p class="muted">No study history yet.</p>';
}
function renderSkillfleet(){
 const w=data(),p=people(),n=p.length,avail=n>=3,counts=Array.from({length:13},(_,di)=>p.filter(x=>(x.skills||[]).some(id=>skill(id)?.di===di)).length);
 $('wfFleetSummary').innerHTML=`<div><span>CONSENTED PROFILES</span><strong>${n}</strong></div><div><span>DOMAINS COVERED</span><strong>${avail?counts.filter(v=>v>0).length:'—'}</strong></div><div><span>ACTIVE GROWTH GOALS</span><strong>${w.goals.filter(g=>g.status!=='done').length}</strong></div>`;
 $('wfSkillfleetHeatmap').innerHTML=avail?ctx.domains.map(([d],di)=>`<div class="wf-domain-row"><span>${E(d)}</span><div class="bar-track"><i style="width:${Math.round(counts[di]/n*100)}%"></i></div><strong>${counts[di]}/${n}</strong><small>${counts[di]===0?'No shared mention':counts[di]===1?'Single source':'Multiple mentions'}</small></div>`).join(''):'<div class="empty">Team-level coverage requires at least three consenting profiles. Use the synthetic demo team or import voluntary peer cards.</div>';
 $('wfGoalSkill').innerHTML=options();
 $('wfGoalRows').innerHTML=w.goals.length?w.goals.map(g=>`<div class="wf-detail-line"><div><strong>${E(name(g.skill))}</strong><small>${E(g.target)}${g.due?' · target '+E(g.due):''}</small></div><div class="button-row"><button class="secondary" data-wfgoal="${E(g.id)}">${g.status==='done'?'Reopen':'Mark reviewed'}</button><button class="danger" data-wfgoaldel="${E(g.id)}">×</button></div></div>`).join(''):'<p class="muted">Add voluntary learning or cross-training goals to make capability development visible without rankings.</p>';
 const credentials=ctx.get().profile.credentials||[];
 $('wfCredentialStatus').innerHTML=credentials.length?credentials.map(c=>{
  let days=c.expiry?Math.round((Date.parse(c.expiry+'T00:00:00Z')-Date.now())/86400000):null;
  return `<div class="wf-detail-line"><strong>${E(c.name)}</strong><small>${days===null?'No expiry supplied':days<0?'Past reported renewal date':days<90?'Renewal within 90 days':'Future renewal'} · Self-entered, NOT verified</small></div>`
 }).join(''):'<p class="muted">No self-entered credentials yet. Use Credential desk for optional renewal reminders.</p>';
}
function renderTeamforge(){
 const w=data(),p=people(),req=w.mission.requirements,ids=new Set(p.map(x=>x.id));
 // Selection belongs to the currently active team; do not carry a roster from
 // the synthetic cohort into a newly created or imported peer team.
 const activeId=team()?.id||'';
 if(w.mission.teamId!==activeId){w.mission.teamId=activeId;w.mission.selected=p.map(x=>x.id)}
 const selected=w.mission.selected.filter(id=>ids.has(id));
 const roster=p.filter(x=>selected.includes(x.id));
 $('wfMissionSkill').innerHTML=options();
 $('wfMissionRequirements').innerHTML=req.length?req.map(r=>`<div class="wf-detail-line"><div><strong>${E(name(r.skill))}</strong><small>${r.min} contributors · ${r.credential?'Qualification text: '+E(r.credential):'No qualification requirement specified'}</small></div><button class="danger" data-wfneeddelete="${E(r.id)}">×</button></div>`).join(''):'<p class="muted">Add mission requirements to compare declared coverage and optional qualification claims.</p>';
 $('wfMissionRoster').innerHTML=p.length?p.map(x=>`<label class="fleet-roster-entry"><input type="checkbox" data-wfstaff="${E(x.id)}"${selected.includes(x.id)?' checked':''}><span><strong>${E(x.name)}</strong><small>${E(x.availability||'Availability unknown')} · ${x.synthetic?'Synthetic example':x.self?'Local opt-in':'Voluntarily shared card'}</small></span></label>`).join(''):'<p class="empty">No opt-in contributors have been shared with this team.</p>';
 $('wfMissionResults').innerHTML=req.length?req.map(r=>{
  const covered=roster.filter(x=>(x.skills||[]).includes(r.skill)),available=covered.filter(x=>x.availability==='available'),limited=covered.filter(x=>x.availability==='limited'),unknown=covered.filter(x=>!x.availability||x.availability==='unknown');
  const qual=covered.filter(x=>r.credential&&(x.qualificationClaims||[]).some(q=>String(q).toLowerCase().includes(r.credential.toLowerCase())));
  const readiness=r.credential?`${qual.length} self-declared qualification match(es) (unverified)`:'No formal qualification requirement entered';
  return `<div class="wf-requirement-result"><strong>${E(name(r.skill))}</strong><span class="tiny-pill">${covered.length}/${r.min} shared mentions</span><p>${E(readiness)} · ${available.length} explicitly available · ${limited.length} limited · ${unknown.length} unknown availability</p><p class="muted">${covered.length<r.min?'Potential coverage gap; consider cross-training or outreach.':'Declared skill mentions meet the requested count; operational eligibility remains unverified.'}</p></div>`
 }).join(''):'<p class="empty">Add a task requirement to generate a transparent team coverage comparison.</p>';
}
function renderMentors(){
 const w=data(),p=people(),selected=$('wfMentorSearch').value||filterSkill;
 $('wfMentorSearch').innerHTML=options(selected,true);
 if(selected==='all'||!skill(selected))$('wfMentorSearch').value='all';else $('wfMentorSearch').value=selected;
 $('wfMentorEnabled').checked=w.mentorship.enabled;
 $('wfMentorAvailability').value=w.mentorship.availability;
 $('wfMentorIntro').value=w.mentorship.intro;
 $('wfMentorTopics').innerHTML=ctx.skills.filter(s=>w.mentorship.topics.includes(s.id)).map(s=>`<span class="focus-pill">${E(s.name)}<button data-wfmentordel="${E(s.id)}">×</button></span>`).join('')||'<p class="muted">No mentoring topics selected.</p>';
 $('wfMentorAdd').innerHTML=options();
 const topic=$('wfMentorSearch').value;
 const matched=p.filter(x=>x.mentorOptIn===true&&(topic==='all'||(x.mentorTopics||[]).includes(topic)));
 $('wfMentorMatches').innerHTML=matched.length?matched.map(x=>`<div class="wf-detail-line"><div><strong>${E(x.name)}</strong><small>Opt-in · ${E(x.availability||'availability unknown')}${x.mentorIntro?' · '+E(x.mentorIntro):''} · ${E(x.synthetic?'Synthetic example':x.self?'Local':'Imported card')}</small></div><span class="tiny-pill">${(x.mentorTopics||[]).length} offered topic(s)</span></div>`).join(''):'<p class="empty">No peers have shared mentoring opt-in for this topic. Self-reported skill mentions alone do not imply willingness to mentor.</p>';
 const problem=$('wfMentorProblem').value.trim();const target=topic==='all'?'a relevant capability':name(topic);
 $('wfMentorDraft').value=`Hello, I'm looking to learn about ${target.toLowerCase()}.${problem?'\nSpecifically: '+problem:''}\nWould you be open to a voluntary knowledge-sharing conversation? I understand that this request does not imply an assigned mentoring role.`;
}
function renderKnowledge(){
 const w=data(),query=trim($('wfKnowledgeSearch').value,120).toLowerCase(),approvedOnly=$('wfApprovedOnly').checked;
 $('wfKnowledgeSkill').innerHTML=options();
 $('wfKnowledgeRecords').innerHTML=w.knowledge.filter(k=>(!approvedOnly||k.approved)&&(!query||`${k.topic} ${name(k.skill)} ${k.context} ${k.steps} ${k.owner}`.toLowerCase().includes(query))).map(k=>`<article class="wf-knowledge-record"><div class="row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h4>${E(k.topic)}</h4><span class="tiny-pill">${k.approved?'OWNER-MARKED APPROVED':'DRAFT / UNREVIEWED'}</span></div><p class="muted">${E(name(k.skill))} · ${E(k.owner||'Owner not supplied')} · ${E(k.created)}</p><p><strong>Situation / context:</strong> ${E(k.context||'Not supplied')}</p><p><strong>Transfer steps:</strong> ${E(k.steps||'Not supplied')}</p><p><strong>Next handoff:</strong> ${E(k.handoff||'Not supplied')}</p><p class="muted">Source reference: ${E(k.source||'Unspecified')}</p><div class="button-row"><button class="secondary" data-wfapprove="${E(k.id)}">${k.approved?'Return to draft':'Mark approved (owner-reviewed)'}</button><button class="danger" data-wfknowdel="${E(k.id)}">Delete</button></div></article>`).join('')||'<div class="empty">No matching knowledge-transfer records. Capture an approved, nonsensitive lesson or start with a synthetic example.</div>';
 const p=people(),t=team(),ids=[...new Set([...(t?.priorities||[]),...w.mission.requirements.map(r=>r.skill)])];
 $('wfOwnershipWatch').innerHTML=ids.length?ids.map(id=>{const n=p.filter(x=>(x.skills||[]).includes(id)).length;return `<div class="wf-detail-line"><span>${E(name(id))}</span><strong>${n===0?'No shared knowledge owner':n===1?'Single contributor':'Multiple contributors'}</strong></div>`}).join(''):'<p class="muted">Mark priority skills or mission needs to generate an expertise-concentration watchlist.</p>';
}
function render(){if(!ctx||!$('workforce'))return;data();renderQual();renderSkillfleet();renderTeamforge();renderMentors();renderKnowledge()}
function init(options){
 ctx=options;data();
 document.querySelectorAll('[data-workforce-tab]').forEach(b=>b.onclick=()=>pane(b.dataset.workforceTab));
 $('wfModuleCreate').onclick=()=>{const w=data(),m={id:U(),title:trim($('wfModuleTitle').value,120),skill:$('wfModuleSkill').value,source:trim($('wfModuleSource').value,220),question:trim($('wfModuleQuestion').value,1000),answer:trim($('wfModuleAnswer').value,1600),scenario:trim($('wfModuleScenario').value,1200),created:now()};if(!m.title||!m.question||!m.answer)return message('Enter guide title, question, and reference answer.');if(w.modules.length>=100)return message('Local limit: 100 study guides.');w.modules.push(m);selectedModule=m.id;revealed=false;for(const id of ['wfModuleTitle','wfModuleSource','wfModuleQuestion','wfModuleAnswer','wfModuleScenario'])$(id).value='';save()};
 $('wfOutlineImport').onclick=()=>{
  const raw=$('wfOutlineText').value.slice(0,12000),rows=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const tasks=[];
  for(const row of rows){
   const m=row.match(/^(?:TASK\s*)?(?:(?:\d+(?:\.\d+)*[.)]?|[A-Z][.)])\s+)(.{8,220})$/i);
   if(!m)continue;const title=trim(m[1].replace(/\s+\.{3,}$/,''),120);
   if(title&&!tasks.includes(title))tasks.push(title);
   if(tasks.length>=50)break
  }
  if(!tasks.length)return message('No numbered task lines recognized. Example: 1.1 Explain the turnover process.');
  const w=data(),count=Math.min(tasks.length,100-w.modules.length);if(count<=0)return message('Guide limit reached.');
  if(!confirm('Create '+count+' unreviewed study drafts from your supplied outline? No answers or qualification results will be generated.'))return;
  const skill=$('wfOutlineSkill').value;for(const title of tasks.slice(0,count))w.modules.push({id:U(),title,skill,source:'Employee-supplied approved outline (local; unverified)',question:'Explain the approved steps, checks, and limitations for: '+title,answer:'',scenario:'Describe a practice situation where this task would apply and how you would validate its completion.',created:now()});
  selectedModule=w.modules[w.modules.length-count].id;revealed=false;$('wfOutlineText').value='';save();message('Created '+count+' review-required study drafts. Supply the source-checked answer for each before recording practice.');
 };
 $('wfModuleSelect').onchange=e=>{selectedModule=e.target.value;revealed=false;renderQual()};
 $('wfGoalAdd').onclick=()=>{const w=data(),target=trim($('wfGoalTarget').value,250);if(!target)return message('Enter an intended learning or cross-training outcome.');w.goals.push({id:U(),skill:$('wfGoalSkill').value,target,due:$('wfGoalDue').value||'',status:'planned'});$('wfGoalTarget').value='';save()};
 $('wfGoalRows').onclick=e=>{const row=e.target.closest('[data-wfgoal],[data-wfgoaldel]');if(!row)return;const w=data(),id=row.dataset.wfgoal||row.dataset.wfgoaldel;if(row.dataset.wfgoaldel)w.goals=w.goals.filter(g=>g.id!==id);else{const g=w.goals.find(g=>g.id===id);if(g)g.status=g.status==='done'?'planned':'done'}save()};
 $('wfMissionAdd').onclick=()=>{const w=data(),credential=trim($('wfMissionQualification').value,100),min=clampNum($('wfMissionMin').value,1,20);if(w.mission.requirements.length>=40)return message('Local limit: 40 mission requirements.');w.mission.requirements.push({id:U(),skill:$('wfMissionSkill').value,min,credential});$('wfMissionQualification').value='';save()};
 $('wfMissionRequirements').onclick=e=>{const b=e.target.closest('[data-wfneeddelete]');if(!b)return;data().mission.requirements=data().mission.requirements.filter(x=>x.id!==b.dataset.wfneeddelete);save()};
 $('wfMissionRoster').onchange=e=>{const inp=e.target.closest('[data-wfstaff]');if(!inp)return;const w=data(),id=inp.dataset.wfstaff;w.mission.selected=inp.checked?[...new Set([...w.mission.selected,id])]:w.mission.selected.filter(x=>x!==id);save()};
 $('wfMentorEnabled').onchange=e=>{data().mentorship.enabled=e.target.checked;save()};
 $('wfMentorAvailability').onchange=e=>{data().mentorship.availability=e.target.value;save()};
 $('wfMentorIntro').onchange=e=>{data().mentorship.intro=trim(e.target.value,500);save()};
 $('wfMentorTopicAdd').onclick=()=>{const m=data().mentorship,t=$('wfMentorAdd').value;if(!m.topics.includes(t))m.topics.push(t);save()};
 $('wfMentorTopics').onclick=e=>{const b=e.target.closest('[data-wfmentordel]');if(!b)return;data().mentorship.topics=data().mentorship.topics.filter(x=>x!==b.dataset.wfmentordel);save()};
 $('wfMentorSearch').onchange=e=>{filterSkill=e.target.value;renderMentors()};
 $('wfMentorProblem').oninput=()=>renderMentors();
 $('wfKnowledgeAdd').onclick=()=>{const w=data(),topic=trim($('wfKnowledgeTopic').value,150),steps=trim($('wfKnowledgeSteps').value,3000);if(!topic||!steps)return message('Enter a topic and transferable practice steps.');if(w.knowledge.length>=250)return message('Local limit: 250 knowledge records.');w.knowledge.push({id:U(),topic,skill:$('wfKnowledgeSkill').value,owner:trim($('wfKnowledgeOwner').value,90),context:trim($('wfKnowledgeContext').value,1200),steps,handoff:trim($('wfKnowledgeHandoff').value,1500),source:trim($('wfKnowledgeSource').value,250),approved:false,created:now()});for(const id of ['wfKnowledgeTopic','wfKnowledgeOwner','wfKnowledgeContext','wfKnowledgeSteps','wfKnowledgeHandoff','wfKnowledgeSource'])$(id).value='';save()};
 $('wfKnowledgeRecords').onclick=e=>{const b=e.target.closest('[data-wfapprove],[data-wfknowdel]');if(!b)return;const w=data(),id=b.dataset.wfapprove||b.dataset.wfknowdel;if(b.dataset.wfknowdel){if(!confirm('Delete this local knowledge record?'))return;w.knowledge=w.knowledge.filter(x=>x.id!==id)}else{const k=w.knowledge.find(x=>x.id===id);if(k)k.approved=!k.approved}save()};
 $('wfKnowledgeSearch').oninput=renderKnowledge;$('wfApprovedOnly').onchange=renderKnowledge;
 $('wfKnowledgeExport').onclick=()=>{const records=data().knowledge.filter(x=>x.approved);if(!records.length)return message('Mark reviewed and approved records before exporting.');const file={format:'synapse-knowledge-relay',version:1,exported:now(),records:records.map(({id,topic,skill,owner,context,steps,handoff,source,approved,created})=>({id,topic,skill,owner,context,steps,handoff,source,approved,created}))};const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json'}));let a=document.createElement('a');a.href=url;a.download='synapse-approved-knowledge-'+now()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);message('Exported owner-marked reviewed records only. This is not an authority accreditation.')};
 pane('qualforge');
}
const clampNum=(v,min,max)=>Math.min(max,Math.max(min,Math.round(Number(v)||min)));
global.SynapseWorkforce={init,render,normalize,fresh,open:pane};
})(window);
