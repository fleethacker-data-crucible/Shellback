"""Browser smoke checks. Requires pytest + Playwright only on development machine."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).parents[1]

def test_synapse_employee_flow():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None, args=['--no-sandbox'] if Path('/usr/bin/chromium').exists() else [])
        page=browser.new_page(viewport={'width':1440,'height':900}, accept_downloads=True, reduced_motion='reduce')
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda dialog: dialog.accept())
        html=(ROOT/'index.html').read_text().replace('<link rel="stylesheet" href="src/style.css">','')
        for script in ('sky.js', 'team.js', 'fleet.js', 'workforce.js', 'app.js'):
            html=html.replace(f'<script src="src/{script}"></script>', '')
        page.set_content(html)
        page.evaluate("""() => {const cache={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{setItem:(k,v)=>cache[k]=v,getItem:k=>cache[k]||null,removeItem:k=>delete cache[k],clear:()=>Object.keys(cache).forEach(k=>delete cache[k])}})}""")
        page.add_style_tag(content=(ROOT/'src/style.css').read_text())
        page.add_script_tag(content=(ROOT/'src/sky.js').read_text())
        page.add_script_tag(content=(ROOT/'src/team.js').read_text())
        page.add_script_tag(content=(ROOT/'src/fleet.js').read_text())
        page.add_script_tag(content=(ROOT/'src/workforce.js').read_text())
        page.add_script_tag(content=(ROOT/'src/app.js').read_text())
        assert page.locator('#metricSkills').inner_text()=='104'
        assert page.locator('#metricDomains').inner_text()=='13'
        page.locator('button[data-view="profile"]').first.click()
        page.locator('#loadResumeSample').click()
        assert page.locator('[data-confirm]').count()>3
        page.locator('[data-confirm]').first.click()
        assert page.locator('#profileCount').inner_text()=='1'
        page.locator('#confidence').select_option('3')
        page.locator('#performed').select_option('recent')
        page.locator('#method').select_option('ai')
        page.locator('#saveSurvey').click()
        assert page.locator('#surveyCount').inner_text()=='1'
        page.locator('label.toggle').click()
        assert page.locator('#sharingState').inner_text()=='ON'
        page.locator('button[data-view="team"]').first.click()
        assert '7' in page.locator('#teamStats').inner_text()
        # Local team builder and explicit peer-card exchange, without server calls.
        page.locator('button[data-view="team"]').first.click()
        page.locator('#teamName').fill('Pilot peers')
        page.locator('#createTeam').click()
        assert 'Pilot peers' in page.locator('#teamSelect').inner_text()
        assert 'At least 3' in page.locator('#teamBars').inner_text()
        for n in range(2):
            card={'format':'synapse-peer-card','version':1,'id':f'peer-example-{n:02}',
                  'name':f'Synthetic peer {n}', 'consent':True, 'issued':'2026-10-21',
                  'skills':['aws-architecture','sql-pipelines'],
                  'surveys':{'aws-architecture':{'confidence':4,'method':'independent'}}}
            page.locator('#importPeerFile').set_input_files({
                'name':f'peer-{n}.json','mimeType':'application/json',
                'buffer':json.dumps(card).encode('utf-8')
            })
            page.wait_for_function('(count) => document.querySelectorAll("#teamMemberList [data-peerview]").length >= count', arg=n+2)
        assert page.locator('#teamMemberList [data-peerview]').count()>=3
        assert ' / 3' in page.locator('#teamBars').inner_text()
        page.locator('#criticalSkill').select_option('aws-architecture')
        page.locator('#addCritical').click()
        assert 'AWS Architecture' in page.locator('#teamCritical').inner_text()
        page.locator('#teamMemberList [data-peerview]').first.click()
        assert 'Synthetic peer' in page.locator('#teamPeerDetail').inner_text()
        # FLEETHACKER concepts: TEAMFORGE + MENTORLINK + KNOWLEDGE RELAY.
        assert page.locator('#fleetLab').count()==1
        assert 'Proposed team coverage' in page.locator('#fleetCompositionResult').inner_text() or 'Select or add mission skills' in page.locator('#fleetCompositionResult').inner_text()
        page.locator('#fleetAddSkill').select_option('aws-architecture')
        page.locator('#fleetAddSkillBtn').click()
        assert 'AWS Architecture' in page.locator('#fleetMissionSkills').inner_text()
        page.locator('#fleetTabMentors').click()
        page.locator('#fleetMentorSkill').select_option('aws-architecture')
        assert 'Synthetic peer' in page.locator('#fleetMentorMatches').inner_text()
        page.locator('#fleetTabRelay').click()
        assert 'Knowledge transfer watchlist' in page.locator('#fleetRelay').inner_text()
        page.locator('#fleetTabCompose').click()
        assert page.locator('#fleetRoster [data-fleetperson]').count()>=3
        # End-to-end FLEETHACKER workforce suite tests.
        page.locator('button[data-view="workforce"]').first.click()
        assert page.locator('#workforce').is_visible()
        assert page.locator('[data-workforce-tab]').count()==5
        page.locator('#wfModuleTitle').fill('Synthetic handoff study guide')
        page.locator('#wfModuleSkill').select_option('qualification-planning')
        page.locator('#wfModuleSource').fill('Synthetic exercise; no official PQS material')
        page.locator('#wfModuleQuestion').fill('What must be checked before turnover?')
        page.locator('#wfModuleAnswer').fill('Review owner, outstanding actions, and status.')
        page.locator('#wfModuleScenario').fill('A safety issue remains open at turnover.')
        page.locator('#wfModuleCreate').click()
        assert 'Synthetic handoff study guide' in page.locator('#wfStudyArea').inner_text()
        page.locator('#wfReveal').click()
        assert 'Review owner' in page.locator('#wfStudyArea').inner_text()
        page.locator('#wfPractice').click()
        assert 'Needs practice' in page.locator('#wfStudyHistory').inner_text()
        # Transform an approved synthetic outline to drafts with no invented answer key.
        page.locator('#wfOutlineSkill').select_option('qualification-planning')
        page.locator('#wfOutlineText').fill('1.1 Explain the turnover process\n1.2 Describe escalation requirements')
        page.locator('#wfOutlineImport').click()
        assert 'REVIEW REQUIRED' in page.locator('#wfStudyArea').inner_text()
        assert page.locator('#wfReviewed').is_disabled()
        page.locator('#wfDraftReference').fill('Check status, owner and unresolved actions in approved source.')
        page.locator('#wfDraftSave').click()
        assert page.locator('#wfReviewed').is_enabled()

        page.locator('[data-workforce-tab="skillfleet"]').click()
        assert 'Shared capability coverage' in page.locator('[data-workforce-pane="skillfleet"]').inner_text()
        page.locator('#wfGoalSkill').select_option('sql-pipelines')
        page.locator('#wfGoalTarget').fill('Pair with peer on a data pipeline')
        page.locator('#wfGoalAdd').click()
        assert 'Pair with peer' in page.locator('#wfGoalRows').inner_text()
        page.locator('[data-workforce-tab="teamforge"]').click()
        page.locator('#wfMissionSkill').select_option('aws-architecture')
        page.locator('#wfMissionMin').fill('2')
        page.locator('#wfMissionQualification').fill('Synthetic AWS credential')
        page.locator('#wfMissionAdd').click()
        assert 'AWS Architecture' in page.locator('#wfMissionResults').inner_text()
        assert 'unverified' in page.locator('#wfMissionResults').inner_text().lower()
        page.locator('[data-workforce-tab="mentorlink"]').click()
        page.locator('#wfMentorEnabled').check()
        page.locator('#wfMentorAvailability').select_option('available')
        page.locator('#wfMentorAdd').select_option('aws-architecture')
        page.locator('#wfMentorTopicAdd').click()
        assert 'AWS Architecture' in page.locator('#wfMentorTopics').inner_text()
        page.locator('#wfMentorSearch').select_option('aws-architecture')
        assert 'My local profile' in page.locator('#wfMentorMatches').inner_text()
        page.locator('[data-workforce-tab="relay"]').click()
        page.locator('#wfKnowledgeTopic').fill('Synthetic shipyard handoff lesson')
        page.locator('#wfKnowledgeSkill').select_option('qualification-planning')
        page.locator('#wfKnowledgeContext').fill('A qualification record needs coordination.')
        page.locator('#wfKnowledgeSteps').fill('Confirm source, owner, and next action.')
        page.locator('#wfKnowledgeSource').fill('Synthetic reference')
        page.locator('#wfKnowledgeAdd').click()
        assert 'Synthetic shipyard handoff lesson' in page.locator('#wfKnowledgeRecords').inner_text()
        page.locator('[data-wfapprove]').first.click()
        page.locator('#wfApprovedOnly').check()
        assert 'OWNER-MARKED APPROVED' in page.locator('#wfKnowledgeRecords').inner_text()
        backup=page.evaluate("() => JSON.parse(localStorage.getItem('synapse-mvp-v1'))")
        assert len(backup['workforce']['modules'])==3
        assert len([x for x in backup['workforce']['modules'] if not x['answer']])==1
        assert len(backup['workforce']['mission']['requirements'])==1
        assert len(backup['workforce']['knowledge'])==1
        assert backup['workforce']['mentorship']['enabled'] is True
        page.locator('button[data-view="radar"]').first.click()
        assert page.locator('.radar-svg').count()>0
        page.locator('button[data-view="graph"]').first.click()
        assert page.locator('#graphSvg .sky-skill-node').count()==104
        page.locator('#graphSearch').fill('SQL')
        assert 1 <= page.locator('#graphSvg .sky-skill-node').count() < 104
        assert page.locator('#graphSvg .galaxy-domain-hub').count()==13
        assert page.locator('#graphSvg .galaxy-domain-label').count()==13
        assert 'capability clusters' in page.locator('#skyExplanation').inner_text()
        assert page.locator('#constellationMode').count()==0
        page.locator('#graphReset').click()
        assert page.locator('#graphSearch').input_value()==''
        # Branch topology must remain visible: same-domain offshoots and
        # the earlier meaningful cross-domain links, not just the decorative nebula.
        assert page.locator('#graphSvg path.sky-branch').count() >= 35
        assert page.locator('#graphSvg path.sky-semantic').count() >= 12
        assert page.locator('#graphSvg [data-relation-type="semantic"]').count() >= 12
        # Approaching a node catches it, displaying an immediately useful label.
        node = page.locator('#graphSvg .sky-skill-node').first
        skill_name = node.get_attribute('aria-label')
        node.hover(force=True)
        page.wait_for_function('() => {const tip=document.querySelector("#graphHoverTip");return tip && !tip.hidden && tip.textContent.trim().length>0}')
        assert skill_name in page.locator('#graphHoverTip').inner_text()
        assert 'confidence' in page.locator('#graphHoverTip').inner_text().lower() or 'unrated' in page.locator('#graphHoverTip').inner_text().lower()
        node.click(force=True)
        assert 'SKILL SIGNAL' in page.locator('#graphDetail').inner_text()
        assert 'Connected capabilities' in page.locator('#graphDetail').inner_text()
        assert page.locator('#graphDetail [data-related-skill]').count()>0
        page.locator('button[data-view="credentials"]').first.click()
        page.locator('#credName').fill('AWS demonstration credential')
        page.locator('#credAuthority').fill('Synthetic issuer')
        page.locator('#credExpiry').fill('2027-03-17')
        page.locator('#addCredential').click()
        assert 'AWS demonstration credential' in page.locator('#credentialList').inner_text()
        page.locator('button[data-view="roi"]').first.click()
        before=page.locator('#roiTotal').inner_text()
        page.locator('[data-roi="minutesSaved"]').fill('0')
        after=page.locator('#roiTotal').inner_text()
        assert before!=after
        saved=page.evaluate("() => JSON.parse(localStorage.getItem('synapse-mvp-v1'))")
        assert len(saved['profile']['confirmed'])==1
        assert len(saved['profile']['surveys'])==1
        page.locator('button[data-view="profile"]').first.click()
        page.locator('#loadDemoProfile').click()
        assert page.locator('#profileCount').inner_text()=='20'
        assert page.locator('#surveyCount').inner_text()=='20'
        assert page.locator('#radar .radar-dot').count()>0
        assert not errors, errors
        browser.close()

def test_standalone_distribution():
    """The downloadable single HTML file must be equally interactive offline."""
    standalone=ROOT/'Synapse-Standalone.html'
    assert standalone.exists()
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,
            executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,
            args=['--no-sandbox'] if Path('/usr/bin/chromium').exists() else [])
        page=browser.new_page(viewport={'width':1440,'height':900}, reduced_motion='reduce')
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(standalone.resolve().as_uri())
        assert page.locator('#metricSkills').inner_text()=='104'
        page.locator('button[data-view="graph"]').first.click()
        assert page.locator('#graphSvg .sky-skill-node').count()==104
        assert page.locator('#graphSvg .galaxy-domain-hub').count()==13
        assert page.locator('#graphSvg .sky-branch').count()>=35
        assert page.locator('#graphSvg .sky-semantic').count()>=12
        page.locator('button[data-view="team"]').first.click()
        assert page.locator('#fleetLab').count()==1
        page.locator('button[data-view="workforce"]').first.click()
        assert page.locator('[data-workforce-tab]').count()==5
        page.locator('[data-workforce-tab="teamforge"]').click()
        assert page.locator('#wfMissionRequirements').count()==1
        page.locator('button[data-view="team"]').first.click()
        page.locator('#fleetTabMentors').click()
        assert page.locator('#fleetMentorMatches').is_visible()
        page.locator('button[data-view="graph"]').first.click()
        skill=page.locator('#graphSvg .sky-skill-node').first
        name=skill.get_attribute('aria-label')
        skill.hover(force=True)
        page.wait_for_function('() => document.querySelector("#graphHoverTip") && !document.querySelector("#graphHoverTip").hidden')
        assert name in page.locator('#graphHoverTip').inner_text()
        assert not errors, errors
        browser.close()

if __name__=='__main__':
    test_synapse_employee_flow()
    test_standalone_distribution()
    print('PASS: modular and standalone Synapse browser smoke flows')
