"""Browser smoke checks. Requires pytest + Playwright only on development machine."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).parents[1]

def test_synapse_employee_flow():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None, args=['--no-sandbox'] if Path('/usr/bin/chromium').exists() else [])
        page=browser.new_page(viewport={'width':1440,'height':900}, accept_downloads=True)
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda dialog: dialog.accept())
        html=(ROOT/'index.html').read_text().replace('<link rel="stylesheet" href="src/style.css">','')
        for script in ('zodiac-lines.js', 'sky.js', 'team.js', 'app.js'):
            html=html.replace(f'<script src="src/{script}"></script>', '')
        page.set_content(html)
        page.evaluate("""() => {const cache={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{setItem:(k,v)=>cache[k]=v,getItem:k=>cache[k]||null,removeItem:k=>delete cache[k],clear:()=>Object.keys(cache).forEach(k=>delete cache[k])}})}""")
        page.add_style_tag(content=(ROOT/'src/style.css').read_text())
        page.add_script_tag(content=(ROOT/'src/zodiac-lines.js').read_text())
        page.add_script_tag(content=(ROOT/'src/sky.js').read_text())
        page.add_script_tag(content=(ROOT/'src/team.js').read_text())
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
        page.locator('button[data-view="radar"]').first.click()
        assert page.locator('.radar-svg').count()>0
        page.locator('button[data-view="graph"]').first.click()
        assert page.locator('#graphSvg .sky-skill-node').count()==104
        page.locator('#graphSearch').fill('SQL')
        assert 1 <= page.locator('#graphSvg .skill-node').count() < 104
        page.locator('#constellationMode').select_option('Scorpius')
        assert 'Scorpius' in page.locator('#skyExplanation').inner_text()
        assert page.locator('#graphSvg .sky-skeleton').count()>0
        page.locator('#graphReset').click()
        assert page.locator('#constellationMode').input_value()=='auto'
        page.locator('#graphSvg .skill-node').first.click()
        assert 'SKILL SIGNAL' in page.locator('#graphDetail').inner_text()
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

if __name__=='__main__':
    test_synapse_employee_flow()
    print('PASS: complete Synapse browser smoke flow')
