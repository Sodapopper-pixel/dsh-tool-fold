import json, sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    page = b.new_context(viewport={"width": 1280, "height": 950}).new_page()
    page.goto(URL, wait_until="domcontentloaded"); page.wait_for_timeout(6000)
    for label in ("继续","知道了","关闭"):
        if page.get_by_role("button", name=label).count() > 0:
            page.get_by_role("button", name=label).first.click(force=True); page.wait_for_timeout(1000)
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    page.evaluate("""() => { for (const m of document.querySelectorAll('[class*="_mask_"]')) m.remove() }""")
    page.get_by_role("button", name="账号菜单").first.click(force=True); page.wait_for_timeout(700)
    page.get_by_role("menuitem", name="设置").first.click(force=True); page.wait_for_timeout(2500)
    page.get_by_role("button", name="工具折叠").first.click(force=True); page.wait_for_timeout(2500)
    page.evaluate("""() => { const d = document.querySelector('.tf-card .tf-disclosure'); if (d && d.getAttribute('aria-expanded') !== 'true') d.click() }""")
    page.wait_for_timeout(800)
    print(json.dumps(page.evaluate("""() => [...document.querySelectorAll('.tf-card .tf-tool')].map(el => ({
      name: el.querySelector('.tf-tool-name')?.innerText,
      origin: el.querySelector('.tf-tool-origin')?.innerText }))"""), ensure_ascii=False))
    b.close()
