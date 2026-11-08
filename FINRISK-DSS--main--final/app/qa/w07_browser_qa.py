#!/usr/bin/env python3
"""W07 browser regression: all 13 screens at 390/768/1440px plus VI/EN.

Loads the real local HTML/CSS/JS files into a disposable browser page; no live
CORE4 API is called. This tests navigation, layout overflow, script execution
and workspace label translation, not real-data inference.

Requires Playwright and Chromium. Install in an optional QA venv, not the frozen
ML runtime: python -m pip install playwright && python -m playwright install chromium
Run: python qa/w07_browser_qa.py
"""
from __future__ import annotations

import asyncio
import base64
import json
import mimetypes
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError as exc:  # pragma: no cover - environment-specific guidance
    raise SystemExit(
        "Playwright is not installed. Create an optional QA environment and run "
        "'python -m pip install playwright' then 'python -m playwright install chromium'."
    ) from exc

APP = Path(__file__).resolve().parents[1]
OUTPUT = APP / "evidence" / "w07" / "browser_qa_results.json"
SCREENS = ["overview", "customer", "data", "simulation", "decision", "reports",
           "evidence", "validation", "trace", "result", "export", "e2e", "acceptance"]
VIEWPORTS = [(390, 844), (768, 1024), (1440, 900)]


def data_url(path: Path) -> str:
    mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{payload}"


async def load_local_project(page) -> list[str]:
    html = (APP / "index.html").read_text(encoding="utf-8")
    scripts = re.findall(r'<script\s+src="([^"]+)"\s*></script>', html)
    html = re.sub(r'<script\s+src="([^"]+)"\s*></script>', "", html)
    html = re.sub(r'<link\s+rel="stylesheet"[^>]*>', "", html)
    html = html.replace("assets/finrisk-logo.svg", data_url(APP / "assets" / "finrisk-logo.svg"))
    await page.set_content(html, wait_until="domcontentloaded")
    await page.add_style_tag(content=(APP / "assets" / "styles.css").read_text(encoding="utf-8"))
    # Use isolated in-memory storage so this QA run never touches a real profile.
    await page.evaluate("""() => {
      const values = new Map();
      Object.defineProperty(window, 'localStorage', { configurable: true, value: {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
        clear: () => values.clear()
      }});
    }""")
    for relative in scripts:
        source = (APP / relative).read_text(encoding="utf-8")
        if relative == "src/app.js":
            for asset in (APP / "assets" / "news").glob("*.svg"):
                source = source.replace(f"assets/news/{asset.name}", data_url(asset))
        await page.add_script_tag(content=source)
    return scripts


async def run() -> int:
    page_errors: list[str] = []
    screen_results: list[dict] = []
    language_results: list[dict] = []
    async with async_playwright() as playwright:
        executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        if not executable and sys.platform.startswith("linux") and Path("/usr/bin/chromium").exists():
            executable = "/usr/bin/chromium"
        launch_args = {"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if executable:
            launch_args["executable_path"] = executable
        browser = await playwright.chromium.launch(**launch_args)
        page = await browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        scripts = await load_local_project(page)
        await page.wait_for_timeout(250)
        nav_count = await page.locator("#nav button").count()

        for width, height in VIEWPORTS:
            await page.set_viewport_size({"width": width, "height": height})
            for screen in SCREENS:
                await page.locator(f'#nav button[data-screen="{screen}"]').evaluate("element => element.click()")
                await page.wait_for_timeout(35)
                metrics = await page.evaluate("""() => {
                  const nav = document.querySelector('#nav');
                  const active = nav?.querySelector('button.active');
                  const a = active?.getBoundingClientRect();
                  const n = nav?.getBoundingClientRect();
                  return {
                    screen: document.body.dataset.screen || null,
                    documentWidth: document.documentElement.scrollWidth,
                    viewportWidth: window.innerWidth,
                    navCount: nav?.querySelectorAll('button').length || 0,
                    activeCount: nav?.querySelectorAll('button.active').length || 0,
                    activeVisible: !!(a && n && a.left >= n.left - 1 && a.right <= n.right + 1),
                    hasTitle: !!document.querySelector('#screen-title')?.textContent.trim(),
                    hasContent: !!document.querySelector('#content')?.textContent.trim(),
                    hasHeader: !!document.querySelector('.app-header'),
                    hasFooter: !!document.querySelector('.app-footer')
                  };
                }""")
                passed = (
                    metrics["screen"] == screen and
                    metrics["documentWidth"] <= width + 1 and
                    metrics["navCount"] == len(SCREENS) and
                    metrics["activeCount"] == 1 and
                    metrics["activeVisible"] and metrics["hasTitle"] and metrics["hasContent"] and
                    metrics["hasHeader"] and metrics["hasFooter"]
                )
                screen_results.append({"viewport": f"{width}x{height}", "screen": screen,
                                       "status": "PASS" if passed else "FAIL", "metrics": metrics})

        # Explicitly verify the known W05 hotfix and W06 navigation translations.
        await page.set_viewport_size({"width": 1440, "height": 900})
        await page.locator('#nav button[data-screen="decision"]').evaluate("element => element.click()")
        await page.locator("#language-toggle").click()
        await page.wait_for_function("document.documentElement.lang === 'en'")
        en_decision = await page.locator('#nav button[data-screen="decision"] .nav-label').inner_text()
        language_results.append({"check": "W05 English label", "expected": "Decision Engine", "actual": en_decision,
                                 "status": "PASS" if en_decision == "Decision Engine" else "FAIL"})
        await page.locator('#nav button[data-screen="reports"]').evaluate("element => element.click()")
        en_reports = await page.locator('#nav button[data-screen="reports"] .nav-label').inner_text()
        language_results.append({"check": "W06 English label", "expected": "Reports & history", "actual": en_reports,
                                 "status": "PASS" if en_reports == "Reports & history" else "FAIL"})
        await page.locator("#language-toggle").click()
        await page.wait_for_function("document.documentElement.lang === 'vi'")
        vi_decision = await page.locator('#nav button[data-screen="decision"] .nav-label').inner_text()
        language_results.append({"check": "W05 Vietnamese label", "expected": "Bộ máy hỗ trợ quyết định", "actual": vi_decision,
                                 "status": "PASS" if vi_decision == "Bộ máy hỗ trợ quyết định" else "FAIL"})
        vi_reports = await page.locator('#nav button[data-screen="reports"] .nav-label').inner_text()
        language_results.append({"check": "W06 Vietnamese label", "expected": "Báo cáo & lịch sử", "actual": vi_reports,
                                 "status": "PASS" if vi_reports == "Báo cáo & lịch sử" else "FAIL"})

        browser_version = browser.version
        await browser.close()

    failed_screens = [item for item in screen_results if item["status"] != "PASS"]
    failed_language = [item for item in language_results if item["status"] != "PASS"]
    result = {
        "schema_version": 1,
        "suite": "W07 browser DOM/layout QA",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "browser": {"engine": "Chromium", "version": browser_version},
        "screens": SCREENS,
        "viewports": [{"width": w, "height": h} for w, h in VIEWPORTS],
        "screen_checks": len(screen_results),
        "screen_passed": len(screen_results) - len(failed_screens),
        "language_checks": len(language_results),
        "language_passed": len(language_results) - len(failed_language),
        "navigation_button_count": nav_count,
        "page_errors": page_errors,
        "failures": failed_screens + failed_language,
        "details": screen_results,
        "language_details": language_results,
        "script_order": scripts,
        "scope_note": "Uses the actual app HTML/CSS/JS with in-memory browser storage. Verifies routing, rendering, VI/EN labels, and document horizontal overflow. Does not call live APIs or validate CORE4 inference."
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"W07 browser QA: {result['screen_passed']}/{result['screen_checks']} screen/viewport checks PASS")
    print(f"W07 language QA: {result['language_passed']}/{result['language_checks']} label checks PASS")
    print(f"Navigation: {nav_count} tabs; JavaScript page errors: {len(page_errors)}")
    if result["failures"] or page_errors:
        for failure in result["failures"][:12]:
            print("FAIL:", json.dumps(failure, ensure_ascii=False))
        for error in page_errors:
            print("PAGE ERROR:", error)
        return 1
    print(f"Evidence: {OUTPUT.relative_to(APP)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
