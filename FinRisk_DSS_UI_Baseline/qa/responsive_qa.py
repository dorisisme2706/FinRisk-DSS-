#!/usr/bin/env python3
"""FinRisk UI #20: browser regression at 18 viewports x 9 original screens.

This validates only responsive presentation and navigation, NOT FinRisk credit
features (these are not yet implemented). Uses browser DOM injection because
some CI environments prohibit loopback browser navigation; all scripts/styles
and screenshots use the exact checked-out project files.

Setup: pip install playwright && python -m playwright install chromium
Run: python qa/responsive_qa.py
"""
import asyncio
import base64
import json
import mimetypes
from pathlib import Path
import re

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "evidence" / "item20"
OUT.mkdir(parents=True, exist_ok=True)
SCREEN_IDS = ["overview", "data", "evidence", "validation", "trace", "result", "export", "e2e", "acceptance"]
VIEWPORTS = [
    (320, 700), (360, 740), (375, 812), (390, 844), (430, 932),
    (640, 900), (680, 900), (720, 900), (768, 1024), (820, 1180),
    (900, 900), (1024, 768), (1180, 820), (1280, 720),
    (1366, 768), (1440, 900), (1600, 900), (1920, 1080),
]


def data_url(path):
    mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return "data:" + mime + ";base64," + base64.b64encode(path.read_bytes()).decode("ascii")


async def load_real_project(page):
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    scripts = re.findall(r'<script\s+src="([^"]+)"\s*></script>', html)
    html = re.sub(r'<script\s+src="([^"]+)"\s*></script>', "", html)
    html = html.replace("assets/carbongraph-logo.png", data_url(ROOT / "assets/carbongraph-logo.png"))
    await page.set_content(html, wait_until="domcontentloaded")
    await page.add_style_tag(content=(ROOT / "assets/styles.css").read_text(encoding="utf-8"))
    # In-browser stand-in avoids persisting anything to the developer's browser.
    await page.evaluate("""() => {
      const db = new Map();
      Object.defineProperty(window, 'localStorage', {configurable: true, value: {
        getItem: k => db.get(k) ?? null,
        setItem: (k, v) => db.set(k, String(v)),
        removeItem: k => db.delete(k)
      }});
    }""")
    for script in scripts:
        body = (ROOT / script).read_text(encoding="utf-8")
        if script == "src/app.js":
            for f in (ROOT / "assets" / "news").glob("*.svg"):
                body = body.replace("assets/news/" + f.name, data_url(f))
        await page.add_script_tag(content=body)


async def get_metrics(page):
    return await page.evaluate("""() => {
      const doc = document.documentElement;
      return {
        active: document.querySelector('#nav button.active')?.dataset.screen || null,
        displayed: document.body.dataset.screen,
        scrollWidth: doc.scrollWidth,
        width: innerWidth,
        navCount: document.querySelectorAll('#nav button').length,
        canvas: !!document.querySelector('#ambient-graph-canvas'),
        header: !!document.querySelector('.app-header'),
        footer: !!document.querySelector('.app-footer'),
        activeVisible: (() => {
          const tab = document.querySelector('#nav button.active');
          const nav = document.querySelector('#nav');
          if (!tab || !nav) return false;
          const a = tab.getBoundingClientRect(), b = nav.getBoundingClientRect();
          return a.left >= b.left - 1 && a.right <= b.right + 1;
        })()
      };
    }""")


async def run():
    failures, screen_checks, screen_data, browser_errors = [], 0, [], []
    async with async_playwright() as p:
        options = {"headless": True, "args": ["--no-sandbox"]}
        try:
            browser = await p.chromium.launch(**options)
        except Exception:
            if Path("/usr/bin/chromium").exists():
                browser = await p.chromium.launch(executable_path="/usr/bin/chromium", **options)
            else:
                raise RuntimeError("Chromium not installed: python -m playwright install chromium")
        context = await browser.new_context(viewport={"width": 1366, "height": 768}, reduced_motion="no-preference")
        page = await context.new_page()
        page.on("pageerror", lambda err: browser_errors.append(str(err)))
        await load_real_project(page)
        for width, height in VIEWPORTS:
            await page.set_viewport_size({"width": width, "height": height})
            for screen in SCREEN_IDS:
                await page.locator(f'#nav button[data-screen="{screen}"]').evaluate("el => el.click()")
                values = await get_metrics(page)
                valid = (values["active"] == screen and values["displayed"] == screen and
                         values["scrollWidth"] <= width + 1 and values["navCount"] == 9 and
                         values["header"] and values["footer"] and values["canvas"] and
                         values["activeVisible"])
                screen_data.append({"width": width, "height": height, "screen": screen,
                                    "passed": valid, "metrics": values})
                screen_checks += 1
                if not valid:
                    failures.append({"width": width, "screen": screen, "metrics": values})
            if width in (320, 390, 768, 1366, 1920):
                await page.locator('#nav button[data-screen="overview"]').evaluate("el=>el.click()")
                await page.screenshot(path=str(OUT / f"overview_{width}.png"))
            if width == 390:
                for key in ("data", "e2e"):
                    await page.locator(f'#nav button[data-screen="{key}"]').evaluate("el=>el.click()")
                    await page.screenshot(path=str(OUT / f"{key}_390.png"))
        await page.set_viewport_size({"width": 1366, "height": 768})
        await page.locator('#nav button[data-screen="overview"]').evaluate('el=>el.click()')
        retained = await page.evaluate("""() => ({
          news: document.querySelectorAll('#cg-news .news-card').length,
          roadmap: document.querySelectorAll('#cg-suite .suite-card').length,
          hero: !!document.querySelector('.product-hero'),
          graphEnabled: window.CGAmbientGraph?.isEnabled() === true
        })""")
        if not (retained["news"] == 6 and retained["roadmap"] == 3 and retained["hero"] and retained["graphEnabled"]):
            failures.append({"design-preservation": retained})
        await page.emulate_media(reduced_motion="reduce")
        await page.wait_for_function("window.CGAmbientGraph.isEnabled() === false", timeout=2500)
        stopped = await page.evaluate("window.CGAmbientGraph.isEnabled() === false")
        await page.emulate_media(reduced_motion="no-preference")
        await page.wait_for_function("window.CGAmbientGraph.isEnabled() === true", timeout=2500)
        resumed = await page.evaluate("window.CGAmbientGraph.isEnabled() === true")
        if not (stopped and resumed):
            failures.append({"reducedMotion": {"stopped": stopped, "resumed": resumed}})
        if browser_errors:
            failures.append({"pageErrors": browser_errors})
        await context.close()
        await browser.close()
    result = {
      "item": "#20", "screens": len(SCREEN_IDS), "viewports": len(VIEWPORTS),
      "screen_checks": screen_checks, "screen_passed": sum(int(s["passed"]) for s in screen_data),
      "design": retained, "reduced_motion": {"stopped": stopped, "resumed": resumed},
      "browser_errors": browser_errors, "failures": failures, "details": screen_data,
      "note": "Browser DOM injection from local project files, not a production API/E2E test."
    }
    (OUT / "responsive_qa.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"#20 responsive: {result['screen_passed']}/{screen_checks} viewport/screen combinations PASS; extra UX checks: {'PASS' if not failures else 'FAIL'}")
    if failures:
        print(json.dumps(failures[:8], ensure_ascii=False, indent=2))
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(run())
