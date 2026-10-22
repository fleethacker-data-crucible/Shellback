(function credentialIntakeFactory(global){
'use strict';
const entries=[
 ['aws-sap','AWS Certified Solutions Architect – Professional','Amazon Web Services',String.raw`AWS\s+(?:Certified\s+)?Solutions?\s+Architect\s*[-–:]?\s*Professional|AWS[\s-]*SAP[\s-]*C0[12]|SAP[\s-]*C0[12]`],
 ['aws-saa','AWS Certified Solutions Architect – Associate','Amazon Web Services',String.raw`AWS\s+(?:Certified\s+)?Solutions?\s+Architect\s*[-–:]?\s*Associate|AWS[\s-]*SAA[\s-]*C0[23]|SAA[\s-]*C0[23]`],
 ['aws-cp','AWS Certified Cloud Practitioner','Amazon Web Services',String.raw`AWS\s+(?:Certified\s+)?Cloud\s+Practitioner|CLF[\s-]*C0[12]`],
 ['aws-dev','AWS Certified Developer – Associate','Amazon Web Services',String.raw`AWS\s+(?:Certified\s+)?Developer\s*[-–:]?\s*Associate|DVA[\s-]*C0[12]`],
 ['aws-sysops','AWS Certified SysOps Administrator – Associate','Amazon Web Services',String.raw`AWS\s+(?:Certified\s+)?SysOps\s+Administrator\s*[-–:]?\s*Associate|SOA[\s-]*C0[23]`],
 ['aws-security','AWS Certified Security – Specialty','Amazon Web Services',String.raw`AWS\s+(?:Certified\s+)?Security\s*[-–:]?\s*Specialty|SCS[\s-]*C0[12]`],
 ['security-plus','CompTIA Security+','CompTIA',String.raw`(?:CompTIA\s+)?Security\s*\+|SY0[\s-]*70[1-9]`],
 ['network-plus','CompTIA Network+','CompTIA',String.raw`(?:CompTIA\s+)?Network\s*\+|N10[\s-]*00[89]`],
 ['a-plus','CompTIA A+','CompTIA',String.raw`CompTIA\s+A\s*\+|220[\s-]*11(?:01|02)`],
 ['cysa','CompTIA CySA+','CompTIA',String.raw`(?:CompTIA\s+)?CySA\s*\+|CS0[\s-]*00[34]`],
 ['cissp','CISSP','ISC2',String.raw`CISSP|Certified\s+Information\s+Systems\s+Security\s+Professional`],
 ['ccsp','CCSP','ISC2',String.raw`CCSP|Certified\s+Cloud\s+Security\s+Professional`],
 ['cism','CISM','ISACA',String.raw`CISM|Certified\s+Information\s+Security\s+Manager`],
 ['cisa','CISA','ISACA',String.raw`CISA|Certified\s+Information\s+Systems\s+Auditor`],
 ['pmp','Project Management Professional (PMP)','Project Management Institute',String.raw`PMP|Project\s+Management\s+Professional`],
 ['capm','Certified Associate in Project Management (CAPM)','Project Management Institute',String.raw`CAPM|Certified\s+Associate\s+in\s+Project\s+Management`],
 ['csm','Certified ScrumMaster (CSM)','Scrum Alliance',String.raw`Certified\s+Scrum\s*Master|CSM`],
 ['psm','Professional Scrum Master (PSM)','Scrum.org',String.raw`Professional\s+Scrum\s+Master|PSM[\s-]*I{1,3}`],
 ['itil','ITIL Foundation','PeopleCert / AXELOS',String.raw`ITIL\s+(?:[Vv]?[345]\s*)?(?:Foundation|Certification)|ITIL\s*[Vv]?[345]`],
 ['ccna','Cisco Certified Network Associate (CCNA)','Cisco',String.raw`CCNA|Cisco\s+Certified\s+Network\s+Associate`],
 ['ccnp','Cisco Certified Network Professional (CCNP)','Cisco',String.raw`CCNP|Cisco\s+Certified\s+Network\s+Professional`],
 ['az900','Microsoft Azure Fundamentals (AZ-900)','Microsoft',String.raw`AZ[\s-]*900|Azure\s+Fundamentals`],
 ['az104','Microsoft Azure Administrator Associate (AZ-104)','Microsoft',String.raw`AZ[\s-]*104|Azure\s+Administrator\s+Associate`],
 ['az305','Microsoft Azure Solutions Architect Expert (AZ-305)','Microsoft',String.raw`AZ[\s-]*305|Azure\s+Solutions?\s+Architect\s+Expert`],
 ['dp900','Microsoft Azure Data Fundamentals (DP-900)','Microsoft',String.raw`DP[\s-]*900|Azure\s+Data\s+Fundamentals`],
 ['pl300','Microsoft Power BI Data Analyst Associate (PL-300)','Microsoft',String.raw`PL[\s-]*300|Power\s+BI\s+Data\s+Analyst\s+Associate`],
 ['gcp','Google Professional Cloud Architect','Google Cloud',String.raw`Google\s+(?:Cloud\s+)?Professional\s+Cloud\s+Architect|Google\s+Cloud\s+Architect\s+Certification`],
 ['cka','Certified Kubernetes Administrator (CKA)','CNCF',String.raw`Certified\s+Kubernetes\s+Administrator|CKA`],
 ['ckad','Certified Kubernetes Application Developer (CKAD)','CNCF',String.raw`Certified\s+Kubernetes\s+Application\s+Developer|CKAD`],
 ['osha30','OSHA 30-Hour Training','OSHA-authorized provider',String.raw`OSHA\s*[- ]?\s*30(?:[- ]?hour)?(?:\s+(?:training|certificate|card))?`],
 ['osha10','OSHA 10-Hour Training','OSHA-authorized provider',String.raw`OSHA\s*[- ]?\s*10(?:[- ]?hour)?(?:\s+(?:training|certificate|card))?`],
 ['esws','Enlisted Surface Warfare Specialist (ESWS)','Self-reported Navy qualification',String.raw`ESWS|Enlisted\s+Surface\s+Warfare\s+Specialist`],
 ['eaws','Enlisted Aviation Warfare Specialist (EAWS)','Self-reported Navy qualification',String.raw`EAWS|Enlisted\s+Aviation\s+Warfare\s+Specialist`],
 ['eidws','Enlisted Information Dominance Warfare Specialist (EIDWS)','Self-reported Navy qualification',String.raw`EIDWS|Enlisted\s+Information\s+Dominance\s+Warfare\s+Specialist`]
];
const patterns=entries.map(([key,name,authority,p])=>({key,name,authority,re:new RegExp('(^|[^a-z0-9])('+p+')(?=$|[^a-z0-9])','ig')}));
const normalized=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
function identify(label){const t=String(label??'').slice(0,320);for(const item of patterns){item.re.lastIndex=0;if(item.re.test(t))return item.key}return null}
function extract(raw){
 const text=String(raw??'').slice(0,100000),results=new Map();
 const clauses=text.split(/[\n\r;•]+/).slice(0,700);
 for(const clause of clauses){if(!clause||clause.length>1400)continue;
  for(const item of patterns){item.re.lastIndex=0;const m=item.re.exec(clause);if(!m)continue;
   const before=clause.slice(Math.max(0,m.index-65),m.index).toLowerCase();
   const after=clause.slice(m.index+m[0].length,m.index+m[0].length+40).toLowerCase();
   const future=/(?:pursu(?:ing|e)|studying|prepar(?:ing|e|ed)|working\s+toward|planning\s+to|aspiring|seeking|hoping|not\s+(?:yet\s+)?certified|without|failed)\s*(?:for|a|the|to|in|an)?\s*$/i.test(before)
     ||/^\s*(?:exam\s+prep|study\s+guide|in\s+progress|candidate|planned)\b/i.test(after);
   if(!future&&!results.has(item.key))results.set(item.key,{key:item.key,name:item.name,authority:item.authority,matched:(m[2]||'').trim().slice(0,100)});
  }
 }
 return [...results.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
global.SynapseCredentialIntake={extract,identify,normalized,count:patterns.length};
})(window);
