/* Synapse MVP — no packages, trackers, remote calls, or hidden HR scoring. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const dateToday=()=>new Date().toISOString().slice(0,10);
const domainDefs=[
 ['Data Engineering',['SQL Pipelines','Data Modeling','ETL / ELT','Data Quality','Database Design','Data Governance','Streaming Data','Data Integration']],
 ['Cloud & Infrastructure',['AWS Architecture','Infrastructure as Code','Cloud Networking','Identity & Access','Cost Optimization','Resilience & Recovery','Container Platforms','Cloud Observability']],
 ['Cybersecurity & Compliance',['Security Controls','Threat Modeling','Vulnerability Triage','Security Documentation','Access Reviews','Zero Trust Design','Incident Readiness','Risk Assessment']],
 ['Software Development',['JavaScript Development','PowerShell Automation','Python Development','API Design','Frontend Engineering','Backend Services','Code Reviews','Application Architecture']],
 ['Analytics & BI',['Power BI','Dashboard Design','Statistical Analysis','Metrics Definition','Data Storytelling','Forecasting','Data Visualization','Exploratory Analysis']],
 ['Systems Engineering',['Requirements Analysis','Systems Integration','Interface Control','Architecture Modeling','Trade Studies','Configuration Management','Reliability Analysis','Verification Planning']],
 ['DevOps & Automation',['CI/CD Pipelines','Git Workflows','Test Automation','Release Engineering','Monitoring & Alerting','Build Tooling','Environment Management','Workflow Automation']],
 ['Project & Program Delivery',['Agile Facilitation','Roadmap Planning','Stakeholder Alignment','Risk Register','Resource Planning','Milestone Tracking','Backlog Refinement','Outcome Measurement']],
 ['Shipyard & Mission Operations',['Qualification Planning','Work Package Readiness','Fleet Sustainment','Shipyard Process Mapping','Technical Work Instructions','Maintenance Coordination','Mission Continuity','Safety Process Awareness']],
 ['Quality & Testing',['Test Strategy','Acceptance Criteria','Defect Triage','Quality Assurance','Regression Testing','Root Cause Analysis','Process Improvement','Audit Evidence']],
 ['Knowledge & Training',['Knowledge Transfer','Mentoring','Technical Writing','Curriculum Design','Training Facilitation','Skills Taxonomy Design','Onboarding Plans','Documentation Stewardship']],
 ['Collaboration & Leadership',['Cross-Team Facilitation','Technical Communication','Conflict Navigation','Decision Framing','Peer Coaching','Change Management','Customer Discovery','Inclusive Collaboration']],
 ['Innovation, Vision & AI Orchestration',['Problem Framing','Creative Vision','Product Judgment','Systems Thinking','AI Orchestration','AI Outcome Validation','Rapid Prototyping','Responsible AI Use']]
];
const colors=['#56e3ce','#70b4ff','#bb91f8','#ffc278','#f485af','#7de0a3','#f2a379','#96a5ff','#e7cd75','#5ac6e7','#bfdd7c','#e497e7','#6af1ff'];
const tasks={
 'SQL Pipelines':'Diagnose a failed SQL pipeline and validate its corrected output.',
 'AWS Architecture':'Plan and implement a basic AWS infrastructure change using approved procedures.',
 'AI Orchestration':'Direct an approved AI-enabled workflow and independently validate its result.',
 'Problem Framing':'Turn an ambiguous workflow problem into testable objectives and success criteria.',
 'PowerShell Automation':'Build, review, and safely test a PowerShell automation script.',
 'Qualification Planning':'Identify upcoming qualification renewals and coordinate a timely action plan.',
 'Power BI':'Build a dashboard with traceable measures and check source-data quality.',
 'Agile Facilitation':'Facilitate a focused sprint review and capture decisions and follow-ups.',
 'Threat Modeling':'Identify likely system threats and recommend practical mitigations.',
 'Technical Writing':'Create work instructions that another team member can safely follow.',
 'AI Outcome Validation':'Check an AI-produced recommendation against evidence, tests, and requirements.',
 'Data Quality':'Define and test checks for missing, duplicated, or inconsistent records.'
};
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const SKILLS=domainDefs.flatMap(([domain,labels],di)=>labels.map((name,si)=>({id:slug(name),name,domain,di,si,task:tasks[name]||`Apply ${name.toLowerCase()} to a clearly defined, reviewable work task using approved procedures.`})));
const skillById=Object.fromEntries(SKILLS.map(s=>[s.id,s]));
const roiDefaults={employees:100,trainingCost:2000,trainingAvoidance:15,trainingHours:8,hourlyRate:75,externalSpend:100000,externalAvoidance:10,minutesSaved:55,weeks:46,realization:70,adoption:75,overlap:25,annualCost:60000};
const STORAGE_KEY='synapse-mvp-v1';
const newState=()=>({version:1,profile:{confirmed:[],surveys:{},credentials:[],consent:false,candidates:[],credentialCandidates:[],credentialDismissed:[],displayName:'',demoPersona:''},roi:{...roiDefaults},fleetPlans:{},workforce:{}});
let state;
try{const loaded=JSON.parse(localStorage.getItem(STORAGE_KEY));state=validateState(loaded)?loaded:newState()}catch{state=newState()}
state.profile.credentialCandidates=Array.isArray(state.profile.credentialCandidates)?state.profile.credentialCandidates:[];
state.profile.credentialDismissed=Array.isArray(state.profile.credentialDismissed)?state.profile.credentialDismissed:[];
let credentialReviewKey=null;
let candidateIds=Array.isArray(state.profile.candidates)?state.profile.candidates.filter(id=>!!skillById[id]&&!state.profile.confirmed.includes(id)):[];let radarDomain=null;let graphSelected=null;let graphFilter='all';let graphScope='confirmed';let graphSearch='';let noticeTimer;
const synthetics=[
 {name:'Demo participant A',skills:['sql-pipelines','data-modeling','aws-architecture','data-quality','power-bi','api-design','knowledge-transfer','problem-framing','ai-orchestration']},
 {name:'Demo participant B',skills:['aws-architecture','cloud-networking','security-controls','incident-readiness','ci-cd-pipelines','git-workflows','agile-facilitation','qualification-planning','technical-writing']},
 {name:'Demo participant C',skills:['requirements-analysis','systems-integration','trade-studies','shipyard-process-mapping','technical-work-instructions','risk-register','test-strategy','root-cause-analysis','mentoring']},
 {name:'Demo participant D',skills:['sql-pipelines','data-governance','power-bi','dashboard-design','forecasting','metrics-definition','data-storytelling','training-facilitation','product-judgment']},
 {name:'Demo participant E',skills:['powershell-automation','frontend-engineering','backend-services','test-automation','workflow-automation','knowledge-transfer','rapid-prototyping','ai-outcome-validation','quality-assurance']},
 {name:'Demo participant F',skills:['cloud-observability','aws-architecture','configuration-management','shipyard-process-mapping','qualification-planning','milestone-tracking','peer-coaching','systems-thinking','responsible-ai-use']}
];
const sampleResume='Cloud solutions architect who designed AWS architecture and infrastructure as code. Developed SQL pipelines, ETL / ELT, Power BI dashboards, PowerShell automation, API design, Git workflows, rapid prototyping, and responsible AI use. Facilitated knowledge transfer and agile delivery.\nCertifications: AWS Certified Solutions Architect - Professional; CompTIA Security+; PMP.\nPursuing CISSP.';
const keywordAliases={
 'sql-pipelines':['sql','postgresql','t-sql','sql server'],'data-modeling':['data model','schema design'],'etl-elt':['etl','elt','extract transform'],'aws-architecture':['aws','amazon web services'],'infrastructure-as-code':['terraform','cloudformation','iac'],'cloud-networking':['vpc','route53'],'identity-access':['iam','sso'], 'javascript-development':['javascript','typescript','js'],'powershell-automation':['powershell','ps1'],'python-development':['python'],'api-design':['rest api','restful','api development'], 'power-bi':['power bi','powerbi'],'ci-cd-pipelines':['ci/cd','github actions','azure pipelines'],'git-workflows':['git','github','gitlab'],'agile-facilitation':['agile','scrum','sprint'],'ai-orchestration':['llm','ai agent','agentic','prompt engineering'],'ai-outcome-validation':['ai validation','ai evaluation'],'responsible-ai-use':['responsible ai','ai governance'],'rapid-prototyping':['prototyp','proof of concept'],'knowledge-transfer':['knowledge transfer','cross-training'],'systems-thinking':['systems thinking']
};
function validateState(x){return !!(x&&x.version===1&&x.profile&&Array.isArray(x.profile.confirmed)&&x.profile.surveys&&typeof x.profile.surveys==='object'&&Array.isArray(x.profile.credentials)&&typeof x.profile.consent==='boolean'&&x.roi&&typeof x.roi==='object')}
function safeStateImport(x){if(!validateState(x))throw Error('This is not a valid Synapse v1 export.');const confirmed=[...new Set(x.profile.confirmed.filter(v=>typeof v==='string'&&skillById[v]))];const surveys={};for(const [id,v] of Object.entries(x.profile.surveys)){if(!skillById[id]||!v||!Number.isInteger(Number(v.confidence))||Number(v.confidence)<0||Number(v.confidence)>4)continue;surveys[id]={confidence:Number(v.confidence),performed:['never','before','recent'].includes(v.performed)?v.performed:'never',method:['none','independent','guided','ai'].includes(v.method)?v.method:'none',note:String(v.note??'').slice(0,1000),updated:String(v.updated??dateToday()).slice(0,10)}}const credentials=x.profile.credentials.slice(0,100).map(c=>({id:String(c.id??cryptoRandom()).slice(0,50),name:String(c.name??'').slice(0,160),authority:String(c.authority??'').slice(0,160),expiry:/^\d{4}-\d{2}-\d{2}$/.test(c.expiry||'')?c.expiry:'',created:String(c.created??dateToday()).slice(0,10),source:c.source==='resume-reviewed'?'resume-reviewed':'self-entered'})).filter(c=>c.name);const roi={...roiDefaults};for(const k of Object.keys(roi)){let n=Number(x.roi[k]);if(Number.isFinite(n)&&n>=0&&n<=100000000)roi[k]=n}const teams=(x.teams&&Array.isArray(x.teams.items))?{active:String(x.teams.active||'').slice(0,80),items:x.teams.items.slice(0,25).map(t=>({id:String(t.id||'').slice(0,80),name:String(t.name||'Imported team').slice(0,80),priorities:Array.isArray(t.priorities)?t.priorities.filter(id=>skillById[id]).slice(0,104):[],members:Array.isArray(t.members)?t.members.slice(0,100).map(m=>({id:String(m.id||'').slice(0,70),name:String(m.name||'Peer').slice(0,70),synthetic:m.synthetic===true,issued:String(m.issued||'').slice(0,10),skills:Array.isArray(m.skills)?m.skills.filter(id=>skillById[id]).slice(0,104):[],surveys:Object.fromEntries(Object.entries(m.surveys||{}).filter(([id,r])=>skillById[id]&&r&&Number.isInteger(Number(r.confidence))&&Number(r.confidence)>=0&&Number(r.confidence)<=4&&['none','guided','independent','ai'].includes(r.method)).slice(0,104).map(([id,r])=>[id,{confidence:Number(r.confidence),method:r.method}])),mentorOptIn:m.mentorOptIn===true,mentorTopics:Array.isArray(m.mentorTopics)?m.mentorTopics.filter(id=>skillById[id]).slice(0,30):[],availability:['unknown','available','limited','unavailable'].includes(m.availability)?m.availability:'unknown',mentorIntro:String(m.mentorIntro||'').slice(0,500),qualificationClaims:Array.isArray(m.qualificationClaims)?m.qualificationClaims.slice(0,100).filter(x=>typeof x==='string').map(x=>x.slice(0,160)):[]})):[]})).filter(t=>t.id&&t.name)}:undefined;return {version:1,profile:{confirmed,surveys,credentials,credentialCandidates:Array.isArray(x.profile.credentialCandidates)?x.profile.credentialCandidates.slice(0,100).filter(c=>c&&typeof c==='object'&&typeof c.key==='string'&&c.key.length<=65).map(c=>({key:String(c.key).slice(0,65),name:String(c.name||'').slice(0,160),authority:String(c.authority||'').slice(0,160),matched:String(c.matched||'').slice(0,100)})):[],credentialDismissed:Array.isArray(x.profile.credentialDismissed)?x.profile.credentialDismissed.filter(k=>typeof k==='string'&&k.length<=65).slice(0,100):[],candidates:Array.isArray(x.profile.candidates)?x.profile.candidates.filter(id=>!!skillById[id]&&!confirmed.includes(id)).slice(0,104):[],consent:x.profile.consent===true,displayName:typeof x.profile.displayName==='string'?x.profile.displayName.slice(0,90):'',demoPersona:typeof x.profile.demoPersona==='string'?x.profile.demoPersona.slice(0,60):'',shareId:typeof x.profile.shareId==='string'?x.profile.shareId.slice(0,70):undefined},roi,teams,workforce:window.SynapseWorkforce.normalize(x.workforce,id=>!!skillById[id]),fleetPlans:Object.fromEntries(Object.entries(x.fleetPlans&&typeof x.fleetPlans==='object'&&!Array.isArray(x.fleetPlans)?x.fleetPlans:{}).slice(0,25).filter(([id,p])=>id.length<=90&&p&&typeof p==='object').map(([id,p])=>[id,{mission:Array.isArray(p.mission)?p.mission.filter(k=>skillById[k]).slice(0,25):[],selected:Array.isArray(p.selected)?p.selected.filter(k=>typeof k==='string'&&k.length<=70).slice(0,100):[]}]))}}
function cryptoRandom(){return 'cred-'+Math.random().toString(36).slice(2,11)}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch{flash('Browser storage is unavailable. Export to keep your changes.')}}
function flash(message){const el=$('flash');el.textContent=message;el.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.classList.remove('show'),4200)}
function navigate(view){if(!$(view))return;if(view!=='graph')window.SynapseSky?.stop();document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===view));document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));const titles={overview:'Mission capability, made visible.',radar:'Skills spider web',graph:'Skills galaxy',profile:'My capability profile',credentials:'Credential desk',team:'Team intelligence',workforce:'FLEETHACKER workforce',roi:'ROI laboratory',trust:'Trust & governance'};$('pageTitle').textContent=titles[view];if(view==='radar')renderRadar();if(view==='graph')renderGraph();if(view==='team')renderTeam();if(view==='workforce')window.SynapseWorkforce?.render();if(view==='roi')renderRoi();window.scrollTo(0,0)}
function init(){document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));$('exportBtn').onclick=exportJson;$('downloadJson').onclick=exportJson;$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=importJson;$('loadDemoProfile').onclick=loadDemoProfile;$('scanResume').onclick=scanResume;$('loadResumeSample').onclick=()=>{$('resumeText').value=sampleResume;scanResume()};$('resumeFile').onchange=readResumeFile;$('surveySkill').onchange=()=>{renderSurveyQuestion();loadPreviousSurvey()};$('saveSurvey').onclick=saveSurvey;$('pulseNext').onclick=nextUnratedPulse;$('openPulseFromProfile').onclick=()=>openPulse();$('manualAdd').onclick=addManualSkill;$('refreshRadar').onclick=()=>{renderRadar();renderOverviewRadar();flash('Spider web refreshed from attested capabilities and optional confidence pulses.')};$('shareToggle').onchange=e=>{state.profile.consent=e.target.checked;persist();renderAll();flash(state.profile.consent?'Aggregate contribution enabled.':'Aggregate contribution withdrawn.')};$('clearMyData').onclick=()=>{if(!confirm('Clear your confirmed skills, surveys, and credentials? This cannot be undone without a backup.'))return;state.profile={confirmed:[],surveys:{},credentials:[],credentialCandidates:[],credentialDismissed:[],candidates:[],consent:false};credentialReviewKey=null;persist();candidateIds=[];renderAll();flash('Your local profile was cleared.')};$('addCredential').onclick=addCredential;$('credClearForm').onclick=clearCredentialForm;$('scanCredentialsFromDesk').onclick=()=>{if(!$('resumeText').value.trim()){navigate('profile');$('resumeFile').focus();flash('Paste or upload a text résumé first.');return}scanResume();navigate('credentials')};$('resetRoi').onclick=()=>{state.roi={...roiDefaults};persist();renderRoi();flash('Scenario restored to illustrative defaults.')};$('resetDemo').onclick=()=>{if(!confirm('Reset the local Synapse workspace? Export first if you need a backup.'))return;state=newState();credentialReviewKey=null;persist();candidateIds=[];renderAll();navigate('overview');flash('Reset complete.')};document.querySelectorAll('button[data-galaxy-mode]').forEach(b=>b.addEventListener('click',()=>{graphScope=b.dataset.galaxyMode==='pathways'?'pathways':'confirmed';graphSelected=null;renderGraph()}));$('graphFilter').onchange=e=>{graphFilter=e.target.value;graphSelected=null;renderGraph()};$('graphSearch').oninput=e=>{graphSearch=e.target.value.trim().toLowerCase();renderGraph()};$('graphReset').onclick=()=>{graphFilter='all';graphSearch='';graphSelected=null;graphScope='confirmed';$('graphFilter').value='all';$('graphSearch').value='';renderGraph()};domainDefs.forEach(([n],di)=>{const opt=document.createElement('option');opt.value=String(di);opt.textContent=n;$('graphFilter').appendChild(opt)});window.SynapseTeam.init({get:()=>state,persist,flash,skills:SKILLS,domains:domainDefs,synthetics});window.SynapseFleet.init({get:()=>state,persist,flash,skills:SKILLS,domains:domainDefs});window.SynapseWorkforce.init({get:()=>state,persist,flash,skills:SKILLS,domains:domainDefs});
 document.querySelectorAll('[data-workforce-open]').forEach(b=>b.addEventListener('click',()=>{navigate('workforce');window.SynapseWorkforce.open(b.dataset.workforceOpen)}));
 const samples=window.SynapseDemoProfiles||[];
 $('demoPersona').innerHTML='<option value="">Choose a fictional employee</option>'+samples.map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} · ${escapeHTML(p.role)}</option>`).join('');
 $('loadPersona').onclick=()=>{
  const id=$('demoPersona').value,p=samples.find(x=>x.id===id);
  if(!p)return flash('Choose a fictional employee.');
  if(!confirm('Replace the current local workspace with '+p.name+' (fictional)? Export your current profile first if you need it.'))return;
  state=safeStateImport(p.workspace);candidateIds=[...state.profile.candidates];credentialReviewKey=null;radarDomain=null;graphSelected=null;graphFilter='all';graphScope='confirmed';graphSearch='';$('graphFilter').value='all';$('graphSearch').value='';
  persist();renderAll();renderCandidates();$('shareName').value=p.name;navigate('radar');
  flash('Loaded fictional '+p.role+' profile. The spider web now shows this employee\'s attested skills.');
 };
 renderAll();renderCandidates();navigate('overview')}
function renderAll(){window.SynapseWorkforce?.render();renderMetrics();renderSurveyOptions();renderConfirmed();renderCredentials();renderCredentialCandidates();renderTeam();renderRoi();renderRadar();renderOverviewRadar();renderGraph()}
function renderMetrics(){
 const who=String(state.profile.displayName||'').trim();
 const demoId=state.profile.demoPersona||'';
 $('demoPersonaState').textContent=demoId&&who?`Viewing fictional profile: ${who}. This is a local demo, not a signed-in user.`:'Viewing this browser\'s local profile. No authenticated account is active.';
 $('demoPersona').value=demoId&&window.SynapseDemoProfiles?.some(p=>p.id===demoId)?demoId:'';
 const c=state.profile.confirmed.length;const s=Object.keys(state.profile.surveys).filter(id=>state.profile.confirmed.includes(id)).length;$('metricDomains').textContent=domainDefs.length;$('metricSkills').textContent=SKILLS.length;$('metricMine').textContent=c;$('metricSurveys').textContent=s;$('profileCount').textContent=c;$('surveyCount').textContent=s;$('sharingState').textContent=state.profile.consent?'ON':'OFF';$('shareToggle').checked=state.profile.consent;$('shareText').textContent=state.profile.consent?'On':'Off';$('storageStatus').textContent='Storage: local browser only (localStorage). No remote scripts, telemetry, or API calls.'}
function score(id){if(!state.profile.confirmed.includes(id))return null;const v=state.profile.surveys[id];return v?Number(v.confidence):null}
function domainStats(di){const arr=SKILLS.filter(s=>s.di===di).map(s=>score(s.id)).filter(v=>v!==null);return {answered:arr.length,mean:arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null}}
function svgRadar(items,{small=false}={}){
 const w=700,h=small?346:515,cx=350,cy=small?158:242,r=small?109:175,n=items.length,uid=small?'preview':'focus';
 const pt=(i,f)=>{const angle=-Math.PI/2+i*2*Math.PI/n;return [cx+Math.cos(angle)*r*f,cy+Math.sin(angle)*r*f,angle]};
 const active=items.filter(x=>(x.claimed||0)>0).length;
 const total=items.reduce((sum,item)=>sum+(item.claimed||0),0);
 const pending=items.reduce((sum,item)=>sum+(item.pending||0),0);
 const ratingCount=items.filter(x=>x.value!==null&&x.value!==undefined&&(x.claimed||0)>0).length;
 const radii=items.map(item=>{
  if(!(item.claimed>0))return 0;
  const breadth=item.capacity?Math.min(1,item.claimed/item.capacity):1;
  const confidence=item.value==null?null:Math.min(4,Math.max(0,Number(item.value)))/4;
  return Math.min(.99,.23+.57*breadth+(confidence===null?0:.17*confidence));
 });
 const webPoints=radii.map((v,i)=>pt(i,v).slice(0,2).map(x=>x.toFixed(2)).join(',')).join(' ');
 let out=`<svg class="radar-svg advanced-radar radar-premium radar-spider" viewBox="0 0 ${w} ${h}" role="img" aria-label="Spider web built from confirmed capabilities. Confidence only adjusts glow and node prominence.">
 <defs>
 <radialGradient id="radar-deep-${uid}"><stop stop-color="#143a57" stop-opacity=".68"/><stop offset=".7" stop-color="#0a263e" stop-opacity=".2"/><stop offset="1" stop-color="#071324" stop-opacity="0"/></radialGradient>
 <linearGradient id="radar-spider-fill-${uid}" x1="0%" y1="0%" x2="100%" y2="100%"><stop stop-color="#6bf3dd" stop-opacity=".45"/><stop offset=".6" stop-color="#4b9dd0" stop-opacity=".27"/><stop offset="1" stop-color="#4b82bc" stop-opacity=".12"/></linearGradient>
 <filter id="radar-spider-glow-${uid}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4.5"/></filter>
 </defs><circle cx="${cx}" cy="${cy}" r="${r+33}" fill="url(#radar-deep-${uid})"/>`;
 for(let ring=4;ring>=1;ring--){
  const points=items.map((_,i)=>pt(i,ring/4).slice(0,2).map(x=>x.toFixed(2)).join(',')).join(' ');
  out+=`<polygon class="radar-premium-ring radar-premium-ring-${ring}" points="${points}" fill="none" stroke-width="${ring===4?1.8:.9}"/>`
 }
 for(let i=0;i<n;i++){
  const item=items[i],claimed=item.claimed||0,suggested=item.pending||0,confidence=item.value;
  const [x,y,a]=pt(i,1),[tx,ty]=pt(i,1+(small?.27:.28));
  const anchor=Math.cos(a)>.2?'start':Math.cos(a)<-.2?'end':'middle';
  const label=(item.short||item.name).slice(0,small?16:23);
  out+=`<line class="radar-premium-axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
  if(claimed||suggested){const [hx,hy]=pt(i,1.08);
   out+=`<circle class="radar-evidence-halo ${claimed?'is-confirmed':'is-pending'}" cx="${hx}" cy="${hy}" r="${Math.min(11,4+(claimed+suggested)*1.55)}" fill="none" stroke="${claimed?'#66f0d5':'#fac58e'}" stroke-width="${claimed?2.5:2}" ${!claimed?'stroke-dasharray="2 3"':''}><title>${claimed} confirmed capability mentions; ${suggested} awaiting review</title></circle>`;
  }
  out+=`<text class="radar-premium-label" tabindex="0" data-radar-index="${i}" text-anchor="${anchor}" dominant-baseline="middle" x="${tx.toFixed(2)}" y="${ty.toFixed(2)}"><title>${escapeHTML(item.name)} · ${claimed} confirmed · ${suggested} suggested · ${confidence==null?'Confidence not rated':'Self-reported confidence '+Number(confidence).toFixed(1)+'/4'}</title>${escapeHTML(label)}</text>`;
 }
 if(active){
  out+=`<polygon class="radar-spider-web" data-web-active="${active}" points="${webPoints}" fill="url(#radar-spider-fill-${uid})" stroke="#68c6c5" stroke-width="2.5" stroke-linejoin="round"/>`;
  for(let i=0;i<n;i++){
   const item=items[i];if(!(item.claimed>0))continue;
   const [x,y]=pt(i,radii[i]),conf=item.value==null?null:Math.max(0,Math.min(4,Number(item.value))),rated=conf!==null;
   const bright=rated?.12+conf*.20:.22;
   const rr=rated?4+conf*2.1:5.1;
   out+=`<line class="radar-spider-branch ${rated?'is-rated':'is-unrated'}" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke-opacity="${rated?(.3+conf*.145).toFixed(2):'.36'}" stroke-width="${rated?(2+conf*.65).toFixed(1):'2'}"/>`;
   out+=`<circle class="radar-spider-aura" cx="${x}" cy="${y}" r="${rr*2.7}" fill="${rated?'#6af4d8':'#79a6bc'}" opacity="${Math.min(.48,bright*.4).toFixed(2)}" filter="url(#radar-spider-glow-${uid})"/>`;
   out+=`<circle class="radar-spider-node ${rated?'is-rated':'is-unrated'}" cx="${x}" cy="${y}" r="${rr}" fill="${rated?'#bcffef':'#8fb3c4'}" stroke="${rated?'#61f2da':'#50778e'}" stroke-width="2" data-radar-index="${i}"><title>${escapeHTML(item.name)} — ${item.claimed} confirmed · ${rated?conf+'/4 self-rated confidence':'confidence unrated'}</title></circle>`;
  }
 }else{
  out+=`<text class="radar-premium-center" x="${cx}" y="${cy-9}" text-anchor="middle">No skills attested</text><text class="radar-premium-subtitle" x="${cx}" y="${cy+14}" text-anchor="middle">${pending?pending+' pending résumé suggestions':'Confirm capabilities to build the web'}</text>`;
 }
 out+=`<text class="radar-premium-footnote" x="${cx}" y="${h-10}" text-anchor="middle">WEB = ATTESTED SKILLS · SHINE = VOLUNTARY CONFIDENCE (0–4)</text></svg>`;
 return out;
}
function evidence(di){const group=SKILLS.filter(s=>s.di===di);return {claimed:group.filter(s=>state.profile.confirmed.includes(s.id)).length,pending:group.filter(s=>candidateIds.includes(s.id)).length,capacity:group.length}}
function renderOverviewRadar(){const data=domainDefs.map(([n],di)=>({name:n,short:n.split(' & ')[0].split(',')[0],value:domainStats(di).mean,...evidence(di)}));$('overviewRadar').innerHTML=svgRadar(data,{small:true});$('overviewRadar').querySelectorAll('[data-radar-index]').forEach(e=>e.addEventListener('click',()=>{radarDomain=Number(e.dataset.radarIndex);navigate('radar')}))}
function renderRadar(){
 const stats={confirmed:state.profile.confirmed.length,pending:candidateIds.length,confidence:Object.keys(state.profile.surveys).filter(id=>state.profile.confirmed.includes(id)).length};
 $('radarStatus').innerHTML=`<span><b>${stats.confirmed}</b> confirmed experience</span><span class="viz-amber"><b>${stats.pending}</b> résumé candidates</span><span><b>${stats.confidence}</b> optional confidence ratings</span>`;
const items=radarDomain===null?domainDefs.map(([n],di)=>({name:n,short:n.replace(' & ',' / ').split(',')[0],value:domainStats(di).mean,...evidence(di)})):SKILLS.filter(s=>s.di===radarDomain).map(s=>({name:s.name,id:s.id,value:score(s.id),claimed:Number(state.profile.confirmed.includes(s.id)),pending:Number(candidateIds.includes(s.id)),capacity:1}));$('radarBreadcrumb').innerHTML=`<button id="radarHome">All domains</button>${radarDomain===null?'':`<button disabled>${escapeHTML(domainDefs[radarDomain][0])}</button>`}`;$('radarHome').onclick=()=>{radarDomain=null;renderRadar()};$('radarCanvas').innerHTML=svgRadar(items);$('radarCanvas').querySelectorAll('[data-radar-index]').forEach(el=>el.addEventListener('click',()=>selectRadarItem(Number(el.dataset.radarIndex),items)));$('radarSkillList').innerHTML='<div class="skill-list">'+items.map((it,i)=>`<button class="skill-item" data-radar-item="${i}"><b>${escapeHTML(it.name)}</b><small>${it.value===null?'Confidence unrated':it.value.toFixed(1)+' / 4'}${it.claimed?' · '+it.claimed+' confirmed':''}${it.pending?' · '+it.pending+' suggested':''}</small></button>`).join('')+'</div>';$('radarSkillList').querySelectorAll('[data-radar-item]').forEach(el=>el.onclick=()=>selectRadarItem(Number(el.dataset.radarItem),items));$('radarInfo').innerHTML=radarDomain===null?'<b>Your attested spider web</b><p>Each mint branch shows capabilities you have confirmed. Web breadth reflects how many skills you attested in that discipline. A confidence pulse makes its node bigger and brighter; unrated confirmed skills stay visible. Amber rings mark suggestions awaiting confirmation.</p>':'<b>Inspect a capability</b><p>Only confirmed capabilities enter your web. Optional task confidence increases node prominence. Suggestions remain outside the web until you attest to them.</p>'}
function selectRadarItem(i,items){if(radarDomain===null){radarDomain=i;renderRadar();return}const item=items[i],s=skillById[item.id],attested=state.profile.confirmed.includes(item.id),resp=attested?state.profile.surveys[item.id]:null;
 $('radarInfo').innerHTML=`<b>${escapeHTML(s.name)}</b><p>${escapeHTML(s.task)}</p><p>${attested?(resp?`Self-rated confidence: ${resp.confidence}/4 · Execution: ${escapeHTML(modeLabel(resp.method))} · Updated: ${escapeHTML(resp.updated)}`:'Skill attested. Confidence not yet rated.'):'Not attested. Confirm this skill before recording confidence.'}</p><button class="secondary" id="radarAnswer">${attested?(resp?'Update confidence':'Rate confidence'):'Confirm capability first'} ↗</button>`;
 $('radarAnswer').onclick=()=>{if(attested)openPulse(s.id);else{navigate('profile');$('manualSkill').value=s.id;$('manualSkill').focus();$('manualSkill').scrollIntoView({block:'center',behavior:'smooth'})}}}
function modeLabel(v){return {independent:'Independent',ai:'Approved AI-assisted',guided:'Guided / collaborative',none:'Not yet performed'}[v]||'Unknown'}
function renderSurveyOptions(){
 const cur=$('surveySkill').value,confirmed=SKILLS.filter(s=>state.profile.confirmed.includes(s.id)).sort((a,b)=>a.name.localeCompare(b.name));
 $('surveySkill').innerHTML='<option value="">'+(confirmed.length?'Select a confirmed skill':'Confirm a capability first')+'</option>'+confirmed.map(s=>`<option value="${s.id}">${escapeHTML(s.name)} · ${escapeHTML(s.domain)}</option>`).join('');
 $('surveySkill').value=confirmed.some(s=>s.id===cur)?cur:(confirmed[0]?.id||'');
 const enabled=confirmed.length>0;
 $('surveySkill').disabled=!enabled;$('saveSurvey').disabled=!enabled;
 for(const id of ['confidence','performed','method','surveyNote'])$(id).disabled=!enabled;
 $('surveyAttestationHint').textContent=enabled?`${confirmed.length} employee-confirmed skill${confirmed.length===1?'':'s'} eligible for a confidence pulse. Other taxonomy skills cannot be surveyed until you attest to them.`:'Confirm a skill from your résumé suggestions or add one manually to unlock its confidence pulse.';
 renderSurveyQuestion();loadPreviousSurvey();
 $('manualSkill').innerHTML='<option value="">Select a skill</option>'+SKILLS.map(s=>`<option value="${s.id}">${escapeHTML(s.name)} · ${escapeHTML(s.domain)}</option>`).join('');renderPulseProgress();
}
function renderSurveyQuestion(){const id=$('surveySkill').value,s=skillById[id];$('surveyQuestion').textContent=s&&state.profile.confirmed.includes(id)?`How confident are you that you could: ${s.task}`:'Attest to a skill first. You can only rate tasks tied to confirmed capabilities.'}
function openPulse(id){
 const selected=id&&state.profile.confirmed.includes(id)?id:state.profile.confirmed.find(k=>!state.profile.surveys[k])||state.profile.confirmed[0];
 if(!selected){navigate('profile');flash('Attest to at least one skill first.');return}
 radarDomain=skillById[selected].di;navigate('radar');
 $('surveySkill').value=selected;renderSurveyQuestion();loadPreviousSurvey();renderPulseProgress();
 $('pulsePanel').scrollIntoView({behavior:'smooth',block:'nearest'});$('surveySkill').focus();
}
function renderPulseProgress(){
 const ids=state.profile.confirmed,done=ids.filter(id=>state.profile.surveys[id]).length;
 $('pulseProgress').textContent=ids.length?`${done} of ${ids.length} confirmed skills have a confidence reflection. Unrated skills remain visible on your web.`:'Attest to a capability to activate its confidence pulse.';
 $('pulseNext').disabled=!ids.length||done===ids.length;
}
function nextUnratedPulse(){
 const options=state.profile.confirmed.filter(id=>!state.profile.surveys[id]);
 if(!options.length){flash('All confirmed skills have a confidence reflection. You can revisit any response.');return}
 const current=$('surveySkill').value,ix=state.profile.confirmed.indexOf(current);
 const next=[...state.profile.confirmed.slice(ix+1),...state.profile.confirmed.slice(0,ix+1)].find(id=>options.includes(id))||options[0];
 openPulse(next);
}
function loadPreviousSurvey(){const v=state.profile.surveys[$('surveySkill').value];$('confidence').value=v?String(v.confidence):'';$('performed').value=v?.performed||'';$('method').value=v?.method||'';$('surveyNote').value=v?.note||''}
function saveSurvey(){const id=$('surveySkill').value,confidence=$('confidence').value,performed=$('performed').value,method=$('method').value;if(!skillById[id]||!state.profile.confirmed.includes(id)){flash('Attest to this capability before recording a confidence pulse.');return}if(confidence===''||!performed||!method){flash('Choose a task, confidence, experience, and execution mode.');return}if((performed==='never')!==(method==='none')){flash('If never performed, choose “Not yet performed” as the execution mode.');return}state.profile.surveys[id]={confidence:Number(confidence),performed,method,note:$('surveyNote').value.trim().slice(0,1000),updated:dateToday()};persist();renderAll();$('surveySkill').value=id;renderSurveyQuestion();loadPreviousSurvey();flash('Task reflection saved locally, separately from validated evidence.')}
function loadDemoProfile(){
 const hasData=state.profile.confirmed.length||Object.keys(state.profile.surveys).length||state.profile.credentials.length;
 if(hasData&&!confirm('Replace the local profile with fully fictional demonstration data? Export first if needed.'))return;
 const ids=['sql-pipelines','data-quality','aws-architecture','infrastructure-as-code','security-controls','javascript-development','powershell-automation','power-bi','requirements-analysis','ci-cd-pipelines','agile-facilitation','qualification-planning','root-cause-analysis','knowledge-transfer','technical-communication','ai-orchestration','rapid-prototyping','responsible-ai-use','test-strategy','systems-thinking'];
 const surveys={};ids.forEach((id,i)=>{surveys[id]={confidence:[3,2,4,3,2,3,4,3,2,3,4,3,2,4,3,3,4,3,2,3][i],performed:i%3===0?'recent':'before',method:i%5===0?'ai':i%4===0?'guided':'independent',note:'Synthetic demonstration response, not a personnel claim.',updated:dateToday()}});
 state.profile={confirmed:ids.filter(id=>!!skillById[id]),surveys,credentials:[{id:cryptoRandom(),name:'Synthetic AWS credential',authority:'Example authority — not verified',expiry:'2027-04-15',created:dateToday()}],consent:false};candidateIds=[];credentialReviewKey=null;persist();renderAll();navigate('radar');flash('Synthetic profile loaded. All skill claims and ratings are fictional.')
}
function readResumeFile(e){const f=e.target.files[0];if(!f)return;if(f.size>512000||!/\.txt$/i.test(f.name)){flash('Please select a plain-text .txt file under 500 KB.');return}const reader=new FileReader();reader.onload=()=>{$('resumeText').value=String(reader.result).slice(0,100000);scanResume();flash('Résumé processed locally; review suggested skills in your galaxy and radar.')};reader.onerror=()=>flash('Could not read that file.');reader.readAsText(f)}
function scanResume(){
 const source=$('resumeText').value.slice(0,100000),text=source.toLowerCase();
 if(!text.trim()){flash('Paste selected experience or load the synthetic example first.');return}
 candidateIds=SKILLS.filter(s=>{
  const terms=[s.name.toLowerCase(),...(keywordAliases[s.id]||[])];
  return terms.some(term=>{const safe=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(^|[^a-z0-9])'+safe+'(?=$|[^a-z0-9])','i').test(text)})
 }).filter(s=>!state.profile.confirmed.includes(s.id)).map(s=>s.id);
 state.profile.candidates=[...candidateIds];
 const extractor=window.SynapseCredentialIntake;
 if(extractor){
  const existing=new Set((state.profile.credentials||[]).map(c=>extractor.identify(c.name)||extractor.normalized(c.name)));
  const dismissed=new Set(state.profile.credentialDismissed||[]);
  state.profile.credentialCandidates=extractor.extract(source).filter(c=>!existing.has(c.key)&&!dismissed.has(c.key));
 }
 credentialReviewKey=null;persist();
 renderCandidates();renderCredentialCandidates();renderOverviewRadar();renderRadar();renderGraph();
 const n=(state.profile.credentialCandidates||[]).length;
 flash(`${candidateIds.length} skill suggestions and ${n} potential résumé credentials found. Review each before adding anything to your profile.`);
}
function renderCandidates(){const box=$('candidateBox');if(!candidateIds.length){box.innerHTML='<div class="empty">No unconfirmed matches. Add skills manually, or expand the experience text.</div>';return}box.innerHTML=`<h4>${candidateIds.length} candidate skill${candidateIds.length===1?'':'s'} · awaiting your confirmation</h4>`+candidateIds.map(id=>{const s=skillById[id];return `<div class="candidate-row"><span><strong>${escapeHTML(s.name)}</strong><small>${escapeHTML(s.domain)} · Résumé keyword match, not proficiency evidence</small></span><button data-confirm="${id}">Confirm</button></div>`}).join('');box.querySelectorAll('[data-confirm]').forEach(b=>b.onclick=()=>{const id=b.dataset.confirm;state.profile.confirmed.push(id);candidateIds=candidateIds.filter(x=>x!==id);state.profile.candidates=[...candidateIds];persist();renderAll();renderCandidates();flash('Skill confirmed. No confidence value was assigned.')})}
function addManualSkill(){const id=$('manualSkill').value;if(!id||!skillById[id])return flash('Choose a skill to add.');if(state.profile.confirmed.includes(id))return flash('You have already confirmed this skill.');state.profile.confirmed.push(id);persist();renderAll();flash('Skill added to your profile without inferring proficiency.')}
function renderConfirmed(){
 const box=$('mySkills');
 box.innerHTML=state.profile.confirmed.length?state.profile.confirmed.map(id=>{
  const skill=skillById[id];if(!skill)return '';
  const v=state.profile.surveys[id];
  return `<div class="my-skill"><div><strong>${escapeHTML(skill.name)}</strong><small>${escapeHTML(skill.domain)}</small><em>${v?`Confidence ${v.confidence}/4 · ${escapeHTML(modeLabel(v.method))}`:'Confidence not rated'}</em></div><div class="my-skill-actions"><button class="secondary" data-pulse-skill="${id}">${v?'Update pulse':'Rate confidence'} ↗</button><button data-remove="${id}" class="danger" aria-label="Remove ${escapeHTML(skill.name)}">✕</button></div></div>`
 }).join(''):'<div class="empty">No skills confirmed yet. Start with a résumé or add one manually.</div>';
 box.querySelectorAll('[data-pulse-skill]').forEach(b=>b.onclick=()=>openPulse(b.dataset.pulseSkill));
 box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{
  const id=b.dataset.remove;state.profile.confirmed=state.profile.confirmed.filter(x=>x!==id);
  persist();renderAll();flash('Capability removed from your web. Previous confidence stays private until re-confirmation.');
 });
}
function credentialId(name){
 const lookup=window.SynapseCredentialIntake;
 return lookup?.identify(name)||lookup?.normalized(name)||String(name).toLowerCase();
}
function clearCredentialForm(){
 credentialReviewKey=null;
 $('credName').value='';$('credAuthority').value='';$('credExpiry').value='';
}
function addCredential(){
 const name=$('credName').value.trim().slice(0,160),authority=$('credAuthority').value.trim().slice(0,160),expiry=$('credExpiry').value;
 if(!name)return flash('Enter a credential or qualification name.');
 if(expiry&&!/^\d{4}-\d{2}-\d{2}$/.test(expiry))return flash('Choose a valid expiration date.');
 if(state.profile.credentials.some(c=>credentialId(c.name)===credentialId(name)))return flash('This credential is already in your inventory. Avoid duplicate claims.');
 const source=credentialReviewKey?'resume-reviewed':'self-entered';
 state.profile.credentials.push({id:cryptoRandom(),name,authority,expiry,created:dateToday(),source});
 if(credentialReviewKey){
  state.profile.credentialCandidates=state.profile.credentialCandidates.filter(c=>c.key!==credentialReviewKey);
  credentialReviewKey=null;
 }
 persist();clearCredentialForm();renderCredentials();renderCredentialCandidates();
 flash('Credential saved as your self-report. It has not been independently verified.');
}
function renderCredentialCandidates(){
 const records=(state.profile.credentialCandidates||[]).filter(c=>!state.profile.credentials.some(held=>credentialId(held.name)===c.key));
 $('credentialSuggestionCount').textContent=String(records.length);
 $('credentialNavBadge').textContent=String(records.length);$('credentialNavBadge').hidden=!records.length;
 const box=$('credentialCandidateList');
 box.innerHTML=records.length?records.map(c=>`<article class="credential-suggestion">
  <div><strong>${escapeHTML(c.name)}</strong><small>${escapeHTML(c.authority)} · Matched "${escapeHTML(c.matched)}"</small><span class="tiny-pill">UNREVIEWED / UNVERIFIED</span></div>
  <div class="button-row"><button class="primary" data-review-credential="${escapeHTML(c.key)}">Review & edit</button><button class="secondary" data-dismiss-credential="${escapeHTML(c.key)}">Dismiss</button></div>
 </article>`).join(''):'<div class="empty">No pending credential suggestions. Paste or upload a plain-text résumé in My capability profile, or add a credential manually below.</div>';
 box.querySelectorAll('[data-review-credential]').forEach(button=>button.onclick=()=>{
  const c=records.find(x=>x.key===button.dataset.reviewCredential);if(!c)return;
  credentialReviewKey=c.key;
  $('credName').value=c.name;$('credAuthority').value=c.authority;$('credExpiry').value='';
  navigate('credentials');$('credName').focus();
  flash('Review the credential, issuer and optional renewal date. Nothing is saved until you approve.');
 });
 box.querySelectorAll('[data-dismiss-credential]').forEach(button=>button.onclick=()=>{
  const key=button.dataset.dismissCredential;
  state.profile.credentialCandidates=state.profile.credentialCandidates.filter(c=>c.key!==key);
  state.profile.credentialDismissed=[...new Set([...(state.profile.credentialDismissed||[]),key])].slice(-100);
  if(credentialReviewKey===key)clearCredentialForm();
  persist();renderCredentialCandidates();flash('Suggestion dismissed; it will stay hidden on later scans of this workspace.');
 });
 const summary=$('credentialScanSummary');
 if(records.length)summary.innerHTML=`<strong>${records.length} possible certification${records.length===1?'':'s'} found in your résumé</strong><p>They are not inventory records until you review them.</p><button type="button" class="secondary" id="openCredentialSuggestions">Review credential suggestions ↗</button>`;
 else summary.innerHTML='<span class="muted">Credential mentions are checked locally during résumé scanning. Matching does not prove you hold a certification.</span>';
 summary.querySelector('#openCredentialSuggestions')?.addEventListener('click',()=>navigate('credentials'));
}
function renderCredentials(){
 const box=$('credentialList');
 if(!state.profile.credentials.length){
  box.innerHTML='<div class="empty">No employee-reviewed credentials recorded. Suggested résumé matches are listed above and require your explicit approval.</div>';return;
 }
 box.innerHTML=[...state.profile.credentials].sort((a,b)=>(a.expiry||'9999').localeCompare(b.expiry||'9999')).map(c=>{
  const days=c.expiry?Math.ceil((new Date(c.expiry+'T12:00:00')-new Date())/86400000):null;
  const timing=days===null?'No renewal date supplied':days<0?'Past self-entered renewal date':days<=90?`${days} days until renewal`:`Renewal in ${days} days`;
  return `<div class="cred-card"><div><b>${escapeHTML(c.name)}</b><small>${escapeHTML(c.authority||'Authority unspecified')} · ${escapeHTML(c.expiry||'No date')}</small><span class="cred-status">${escapeHTML(timing)} · Self-reported / unverified</span></div><button data-delete-cred="${escapeHTML(c.id)}" aria-label="Delete credential">✕</button></div>`
 }).join('');
 box.querySelectorAll('[data-delete-cred]').forEach(el=>el.onclick=()=>{
  state.profile.credentials=state.profile.credentials.filter(c=>c.id!==el.dataset.deleteCred);
  persist();renderCredentials();renderCredentialCandidates();flash('Credential removed from local inventory.');
 });
}
function aggregateCohort(){const people=[...synthetics.map(p=>({skills:p.skills})),...(state.profile.consent?[{skills:state.profile.confirmed}]:[])];const total=people.length;return {people,total,counts:domainDefs.map((_,di)=>people.filter(p=>p.skills.some(id=>skillById[id]?.di===di)).length)}}
function renderTeam(){window.SynapseTeam?.render();window.SynapseFleet?.render()}
const roiLabels={employees:['Pilot participants','people'],trainingCost:['Annual training spend per person','$'],trainingAvoidance:['Avoided duplicate training','%'],trainingHours:['Annual training hours per person','hours'],hourlyRate:['Loaded hourly rate','$'],externalSpend:['Annual outside specialist spend','$'],externalAvoidance:['External spend avoidance','%'],minutesSaved:['Minutes recovered per person / week','minutes'],weeks:['Working weeks / year','weeks'],realization:['Usable share of recovered time','%'],adoption:['Employees adopting the workflow','%'],overlap:['Estimated overlapping time benefits','%'],annualCost:['Annual platform operating cost','$']};
function renderRoi(){const panel=$('roiInputs');panel.innerHTML=Object.entries(roiLabels).map(([k,[name,unit]])=>`<label>${escapeHTML(name)}<input type="number" min="0" step="${unit==='%'?'1':'any'}" data-roi="${k}" value="${state.roi[k]}" aria-label="${escapeHTML(name)}"><small class="muted">${unit}</small></label>`).join('');panel.querySelectorAll('[data-roi]').forEach(input=>input.oninput=()=>{const val=Number(input.value);if(!Number.isFinite(val)||val<0)return;const key=input.dataset.roi;state.roi[key]=['trainingAvoidance','externalAvoidance','realization','adoption','overlap'].includes(key)?Math.min(val,100):Math.min(val,100000000);persist();updateRoiOutputs()});updateRoiOutputs()}
function roiScenario(p,adoptionFactor=1){
 const participants=Math.max(0,Number(p.employees)||0),uptake=Math.min(1,Math.max(0,Number(p.adoption??75)*adoptionFactor/100)),people=participants*uptake;
 const avoidance=Math.min(1,Math.max(0,Number(p.trainingAvoidance)/100)),externalAvoidance=Math.min(1,Math.max(0,Number(p.externalAvoidance)/100));
 const cashTraining=people*Number(p.trainingCost)*avoidance;
 const cashExternal=Number(p.externalSpend)*externalAvoidance*uptake;
 const trainingHours=people*Number(p.trainingHours)*Number(p.hourlyRate)*avoidance;
 const grossWorkflow=people*(Number(p.minutesSaved)/60)*Number(p.weeks)*Number(p.hourlyRate)*Number(p.realization)/100;
 const overlap=Math.min(1,Math.max(0,Number(p.overlap??25)/100));
 const overlapDeduction=Math.min(trainingHours,grossWorkflow)*overlap;
 const workflow=Math.max(0,grossWorkflow-overlapDeduction);
 const cash=cashTraining+cashExternal,capacity=trainingHours+workflow,cost=Number(p.annualCost)||0;
 return {people,cashTraining,cashExternal,trainingHours,grossWorkflow,overlapDeduction,workflow,cash,capacity,cost,total:cash+capacity,netCash:cash-cost}
}
function updateRoiOutputs(){
 const p=state.roi,o=roiScenario(p),lower=roiScenario(p,.5),higher=roiScenario(p,1.2);
 const money=x=>fmt.format(x);
 const rows=[['Cash: duplicate training spend avoided',o.cashTraining],['Cash: external specialist spend avoided',o.cashExternal],['Capacity only: training hours recovered',o.trainingHours],['Capacity only: workflow hours recovered (gross)',o.grossWorkflow],['Less: overlapping capacity removed',-o.overlapDeduction]];
 $('roiTotal').textContent=money(o.total);
 $('roiBreakdown').innerHTML=rows.map(([label,value])=>`<div class="roi-line"><span>${label}</span><b>${value<0?'−':''}${money(Math.abs(value))}</b></div>`).join('');
 $('roiCost').textContent=money(o.cost);
 $('roiNet').textContent=money(o.netCash);
 $('roiMultiple').textContent=o.cost?`${(o.cash/o.cost).toFixed(2)}×`:'Not defined (zero cost)';
 $('roiCash').textContent=money(o.cash);
 $('roiCapacity').textContent=money(o.capacity);
 $('roiAdoptionPeople').textContent=`${Math.round(o.people).toLocaleString()} of ${Number(p.employees).toLocaleString()} modeled`;
 $('roiSensitivity').innerHTML=`<div><b>${money(lower.netCash)}</b><span>Lower adoption (50% of base)</span></div><div><b>${money(o.netCash)}</b><span>Base cash-only net</span></div><div><b>${money(higher.netCash)}</b><span>Higher adoption (120% of base, capped at 100%)</span></div>`;
}
function renderGraph(){
 if(!window.SynapseSky)return;
 const pathways=graphScope==='pathways';
 document.querySelectorAll('button[data-galaxy-mode]').forEach(button=>{
  const pressed=button.dataset.galaxyMode===graphScope;
  button.setAttribute('aria-pressed',String(pressed));button.classList.toggle('galaxy-mode-active',pressed);
 });
 $('graphSurface').dataset.galaxyView=graphScope;
 const report=window.SynapseSky.render({
  pending:candidateIds,scope:graphScope,svg:$('graphSvg'),surface:$('graphSurface'),
  detail:$('graphDetail'),legend:$('graphLegend'),skills:SKILLS,domains:domainDefs,colors,
  profile:state.profile,filter:graphFilter,query:graphSearch,selected:graphSelected,
  modeLabel,onSelect:id=>{graphSelected=id;renderGraph()},
  onReflect:id=>{if(state.profile.confirmed.includes(id))openPulse(id);else{navigate('profile');$('manualSkill').value=id;$('manualSkill').focus()}},
  onShowPathways:()=>{graphScope='pathways';graphSelected=null;renderGraph()},
  onOpenProfile:()=>navigate('profile')
 });
 $('skyExplanation').textContent=pathways?
  `Pathways: ${report.visible} possible skills across ${report.clusters} disciplines with ${report.relations} visible conceptual relationships. Only mint-ringed skills are attested; other nodes are possible learning routes.`:
  `Confirmed Skills: exactly ${report.visible} of your ${report.confirmed} attested skills shown across ${report.clusters} disciplines${graphFilter!=='all'||graphSearch?' after filters':''}. Only connections between confirmed, displayed skills are drawn.`;
 $('galaxyStatus').innerHTML=pathways?
  `<span><b>${report.visible}</b> possible pathways shown</span><span><b>${report.confirmed}</b> attested</span><span class="viz-amber"><b>${report.pending}</b> résumé suggestions</span><span>Explore all · click to inspect</span>`:
  `<span><b>${report.visible}</b> confirmed nodes shown</span><span><b>${report.clusters}</b> attested disciplines</span><span><b>${report.known}</b> confidence responses</span><span>No unconfirmed skill nodes</span>`;
}
function exportJson(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`synapse-workspace-${dateToday()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);flash('Local JSON export created. Protect this file like other personal records.')}
async function importJson(e){const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>2000000)return flash('JSON backup exceeds the 2 MB import limit.');try{const data=JSON.parse(await f.text());if(!confirm('Replace your current local workspace with this imported data?'))return;state=safeStateImport(data);credentialReviewKey=null;persist();candidateIds=[...(state.profile.candidates||[])];renderAll();renderCandidates();flash('Local workspace imported and validated.')}catch(err){flash(`Import failed: ${err.message}`)}}
init();
})();
