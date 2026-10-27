"""Read one tool's detail panel on a running Host."""

import json
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1]

READ = """() => {
  const tool = document.querySelector('.tf-card-open .tf-tool')
  if (tool === null) return { missing: true }
  const text = node => (node === null ? '' : node.innerText)
  return {
    name: text(tool.querySelector('.tf-tool-name')),
    meta: text(tool.querySelector('.tf-tool-meta')).split(String.fromCharCode(10)).join(' | '),
    desc: text(tool.querySelector('.tf-tool-description')).slice(0, 100),
    schema: text(tool.querySelector('.tf-schema')).slice(0, 140),
    blocks: [...tool.querySelectorAll('details')].map(d => text(d.querySelector('summary'))),
  }
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_context(viewport={"width": 1280, "height": 950}).new_page()
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_timeout(6000)
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    page.evaluate("""() => { for (const m of document.querySelectorAll('[class*="_mask_"]')) m.remove() }""")
    page.get_by_role("button", name="账号菜单").first.click(force=True)
    page.wait_for_timeout(700)
    page.get_by_role("menuitem", name="设置").first.click(force=True)
    page.wait_for_timeout(2500)
    page.get_by_role("button", name="工具折叠").first.click(force=True)
    page.wait_for_timeout(2500)
    page.evaluate("""() => { if (document.querySelector('.tf-card-open') === null) { const d = document.querySelector('.tf-disclosure'); if (d !== null) d.click() } }""")
    page.wait_for_timeout(800)
    page.evaluate("""() => { const b = document.querySelector('.tf-card-open .tf-tool-info'); if (b !== null) b.click() }""")
    page.wait_for_timeout(700)
    page.evaluate("""() => { for (const d of document.querySelectorAll('.tf-card-open .tf-tool-details details')) d.open = true }""")
    page.wait_for_timeout(600)
    print(json.dumps(page.evaluate(READ), ensure_ascii=False, indent=1))
    browser.close()
