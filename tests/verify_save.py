"""Verify the save path and the tool detail panel against a Host that runs the current Host code."""

import json
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1]
SHOT = sys.argv[2] if len(sys.argv) > 2 else "isolated-page.png"

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_context(viewport={"width": 1280, "height": 950}).new_page()
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_timeout(6000)

    # A fresh profile opens the preview notice once; it is not part of what this checks.
    for label in ("继续", "知道了", "关闭"):
        if page.get_by_role("button", name=label).count() > 0:
            page.get_by_role("button", name=label).first.click(force=True)
            page.wait_for_timeout(1200)
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    page.evaluate("""() => { for (const mask of document.querySelectorAll('[class*="_mask_"]')) mask.remove() }""")

    page.get_by_role("button", name="账号菜单").first.click(force=True)
    page.wait_for_timeout(700)
    page.get_by_role("menuitem", name="设置").first.click(force=True)
    page.wait_for_timeout(2500)
    page.get_by_role("button", name="工具折叠").first.click(force=True)
    page.wait_for_timeout(2500)

    page.get_by_role("button", name="新增折叠组").first.click()
    page.wait_for_timeout(900)
    page.locator(".tf-card-open input").first.fill("ov")
    page.wait_for_timeout(300)
    page.evaluate("""() => { const box = document.querySelector('.tf-card-open .tf-tool-label input[type=checkbox]'); if (box !== null) box.click() }""")
    page.wait_for_timeout(600)

    # This Host runs the current code and has assembled a session, so parameters are known.
    page.evaluate("""() => { const b = document.querySelector('.tf-card-open .tf-tool-info'); if (b !== null) b.click() }""")
    page.wait_for_timeout(800)
    details = page.evaluate(
        """() => {
          const tool = document.querySelector('.tf-card-open .tf-tool')
          const blocks = tool === null ? [] : [...tool.querySelectorAll('details')]
          return {
            meta: tool === null ? null : (tool.querySelector('.tf-tool-meta')?.innerText ?? '').replace(/\\n/g, ' | '),
            blocks: blocks.map(d => ({ summary: d.querySelector('summary').innerText, open: d.open })),
            schema: tool?.querySelector('.tf-schema')?.innerText.slice(0, 70) ?? null,
            description: tool?.querySelector('.tf-tool-description')?.innerText.slice(0, 40) ?? null,
          }
        }"""
    )
    print(json.dumps({"details": details}, ensure_ascii=False))

    page.get_by_role("button", name="保存").first.click()
    page.wait_for_timeout(2500)
    save = page.evaluate(
        """() => {
          const note = document.querySelector('.tf-saved, .tf-save-error')
          const footer = document.querySelector('.tf-footer')
          if (note === null || footer === null) return { found: false }
          const r = note.getBoundingClientRect()
          const f = footer.getBoundingClientRect()
          return { found: true, text: note.innerText, className: note.className,
                   color: getComputedStyle(note).color, besideButtons: r.top >= f.top && r.top <= f.bottom }
        }"""
    )
    print(json.dumps({"save": save}, ensure_ascii=False))

    cards = page.evaluate(
        """() => ({ open: document.querySelectorAll('.tf-card-open').length,
                    total: document.querySelectorAll('.tf-card').length,
                    summaries: [...document.querySelectorAll('.tf-card-summary')].map(el => el.innerText) })"""
    )
    print(json.dumps({"cardsAfterSave": cards}, ensure_ascii=False))
    page.screenshot(path=SHOT, full_page=False)
    browser.close()
