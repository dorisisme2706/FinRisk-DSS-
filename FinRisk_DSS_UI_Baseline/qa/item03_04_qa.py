#!/usr/bin/env python3
"""#03-04 browser checks for smooth transitions and the two-level header.
Runs checked-out real HTML/CSS/JS via local browser injection, not a backend.
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright
from responsive_qa import ROOT, load_real_project

OUT = ROOT / 'evidence' / 'item03_04'
OUT.mkdir(parents=True, exist_ok=True)
CHECKS=[]

def verify(label, condition, details=None):
    item = {'check':label,'pass':bool(condition),'details':details}
    CHECKS.append(item)
    if not condition:
        print('FAIL',label,details)

async def run():
    errors=[]
    async with async_playwright() as p:
        try:
            browser=await p.chromium.launch(headless=True,args=['--no-sandbox'])
        except Exception:
            browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=await browser.new_context(viewport={'width':1366,'height':768},reduced_motion='no-preference')
        page=await context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        await load_real_project(page)
        desktop=await page.evaluate('''() => {
          const header=document.querySelector('.app-header');
          const top=document.querySelector('.marketing-header');
          const second=document.querySelector('.workspace-bar');
          const nav=document.querySelector('.product-nav');
          const menu=document.querySelector('#product-menu-toggle');
          return {brand:!!document.querySelector('.brand-logo'),
            topVisible:top.getBoundingClientRect().height>0,
            secondVisible:second.getBoundingClientRect().height>0,
            twoTier:second.getBoundingClientRect().top>=top.getBoundingClientRect().bottom-1,
            navVisible:getComputedStyle(nav).display!='none',
            menuHidden:getComputedStyle(menu).display=='none',
            isSticky:getComputedStyle(header).position=='sticky',
            primaryCount:nav.querySelectorAll('button').length,
            workspaceCount:document.querySelectorAll('#nav button').length
          }
        }''')
        for k,expected in [('brand',True),('topVisible',True),('secondVisible',True),('twoTier',True),('navVisible',True),('menuHidden',True),('isSticky',True),('primaryCount',5),('workspaceCount',9)]:
            verify('Desktop two-tier / '+k,desktop[k]==expected,desktop[k])
        # Verify screen changes get just one light animation, no animation on same-screen re-render
        await page.locator('#nav button[data-screen="data"]').evaluate('el=>el.click()')
        transition=await page.evaluate('''() => ({screen:document.body.dataset.screen,
          aria:document.querySelector('#nav button[data-screen="data"]').getAttribute('aria-current'),
          animation:getComputedStyle(document.querySelector('#content')).animationName})''')
        verify('Workspace active ARIA', transition['aria']=='page',transition)
        verify('Screen change animation', 'finrisk-screen-enter' in transition['animation'],transition)
        await page.wait_for_timeout(400)
        animationCleared=await page.locator('#content').evaluate('el=>!el.classList.contains("screen-enter")')
        verify('Animation cleans up',animationCleared)
        await page.locator('#nav button[data-screen="data"]').evaluate('el=>el.click()')
        noReplay=await page.locator('#content').evaluate('el=>!el.classList.contains("screen-enter")')
        verify('No animation for same page',noReplay)
        await page.locator('#nav button[data-screen="overview"]').evaluate('el=>el.click()')
        for width in [320,360,390,430,640,768,820,900,1024,1120]:
            await page.set_viewport_size({'width':width,'height':812})
            state=await page.evaluate('''() => ({
              buttonVisible:getComputedStyle(document.querySelector('#product-menu-toggle')).display!=='none',
              navHidden:getComputedStyle(document.querySelector('#product-nav')).display==='none',
              xOverflow:document.documentElement.scrollWidth >innerWidth+1,
              headerHeight:document.querySelector('.app-header').getBoundingClientRect().height,
              headerTop:document.querySelector('.marketing-header').getBoundingClientRect().height,
              headerBottom:document.querySelector('.workspace-bar').getBoundingClientRect().height
            })''')
            verify(f'{width}px toggle available and menu closed',state['buttonVisible'] and state['navHidden'],state)
            verify(f'{width}px no header horizontal overflow',not state['xOverflow'],state)
            verify(f'{width}px two-tier visible',state['headerTop']>0 and state['headerBottom']>0,state)
            await page.locator('#product-menu-toggle').evaluate('el=>el.click()')
            opened=await page.evaluate('''() => ({
              expanded:document.querySelector('#product-menu-toggle').getAttribute('aria-expanded'),
              visible:getComputedStyle(document.querySelector('#product-nav')).display!=='none',
              count:document.querySelectorAll('#product-nav button').length,
              overflow:document.documentElement.scrollWidth>innerWidth+1
            })''')
            verify(f'{width}px expanded menu visible / accessible',opened['expanded']=='true' and opened['visible'] and opened['count']==5 and not opened['overflow'],opened)
            if width==390:
                await page.screenshot(path=str(OUT/'mobile_menu_390.png'))
                await page.keyboard.press('Escape')
                afterEscape=await page.evaluate('''() => ({closed:document.querySelector('#product-menu-toggle').getAttribute('aria-expanded')==='false',focused:document.activeElement.id==='product-menu-toggle'})''')
                verify('Escape closes and restores focus',afterEscape['closed'] and afterEscape['focused'],afterEscape)
                await page.locator('#product-menu-toggle').evaluate('el=>el.click()')
                await page.locator('#product-nav button[data-overview-target="cg-news"]').evaluate('el=>el.click()')
                await page.wait_for_function("""() => {
                  const target=document.getElementById('cg-news');
                  const header=document.querySelector('.app-header');
                  return target && header && Math.abs(target.getBoundingClientRect().top - header.getBoundingClientRect().height - 16) < 8;
                }""", timeout=5000)
                atNews=await page.evaluate('''() => {
                   const target=document.querySelector('#cg-news');
                   const h=document.querySelector('.app-header').getBoundingClientRect().height;
                   return {targetTop:target.getBoundingClientRect().top,headerHeight:h,
                     active:document.querySelector('#product-nav [aria-current="location"]')?.dataset.overviewTarget,
                     menuClosed:document.querySelector('#product-menu-toggle').getAttribute('aria-expanded')==='false',
                     scrollY:scrollY}
                }''')
                verify('News section accessible and aligned after click', atNews['active']=='cg-news' and atNews['menuClosed'] and atNews['scrollY']>150 and abs(atNews['targetTop']-atNews['headerHeight']-16)<9,atNews)
                await page.screenshot(path=str(OUT/'mobile_news_390.png'))
            else:
                await page.keyboard.press('Escape')
                verify(f'{width}px Escape closes',await page.locator('#product-menu-toggle').get_attribute('aria-expanded')=='false')
        await page.set_viewport_size({'width':1366,'height':768})
        await page.locator('#nav button[data-screen="overview"]').evaluate('el=>el.click()')
        await page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
        await page.wait_for_timeout(400)
        await page.screenshot(path=str(OUT/'desktop_header_1366.png'))
        await page.evaluate("window.scrollTo({top: 0, behavior: 'instant'})")
        await page.wait_for_timeout(150)
        await page.locator('#product-nav button[data-overview-target="cg-suite"]').evaluate('el=>el.click()')
        await page.wait_for_timeout(700)
        desktopAnchor=await page.evaluate('''() => ({scrollY:scrollY,active:document.querySelector('#product-nav [aria-current="location"]')?.dataset.overviewTarget,top:document.querySelector('#cg-suite').getBoundingClientRect().top,header:document.querySelector('.app-header').getBoundingClientRect().height})''')
        verify('Desktop in-page section smooth and aligned',desktopAnchor['active']=='cg-suite' and desktopAnchor['scrollY']>0 and abs(desktopAnchor['top']-desktopAnchor['header']-16)<12,desktopAnchor)
        await page.emulate_media(reduced_motion='reduce')
        await page.locator('#nav button[data-screen="e2e"]').evaluate('el=>el.click()')
        reduced=await page.evaluate('''() => ({
          animation:getComputedStyle(document.querySelector('#content')).animationName,
          graphDisabled:window.CGAmbientGraph.isEnabled()===false,
          behavior:getComputedStyle(document.documentElement).scrollBehavior
        })''')
        verify('Reduced-motion disables page transition, canvas and scroll',reduced['animation']=='none' and reduced['graphDisabled'] and reduced['behavior']=='auto',reduced)
        await page.emulate_media(reduced_motion='no-preference')
        await page.wait_for_function('window.CGAmbientGraph.isEnabled() === true',timeout=2500)
        verify('Animation canvas resumes', await page.evaluate('window.CGAmbientGraph.isEnabled()===true'))
        verify('No browser page errors',not errors,errors)
        await browser.close()
    result={'item':'#03 and #04','checks':len(CHECKS),'passed':sum(x['pass'] for x in CHECKS),'failed':[x for x in CHECKS if not x['pass']],'checks_detail':CHECKS,'browser_errors':errors,'scope':'Browser-injected static frontend; not end-to-end credit application.'}
    (OUT/'item03_04_qa.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(f"#03/#04 QA: {result['passed']}/{result['checks']} PASS; page errors={len(errors)}")
    if result['failed']:
        for x in result['failed'][:12]: print('FAIL',x)
        raise SystemExit(1)

if __name__=='__main__':
    asyncio.run(run())
