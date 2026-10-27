"""Seed the settings page on a throwaway Host and capture the README screenshot."""

import json
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1]
SHOT = sys.argv[2] if len(sys.argv) > 2 else "docs/screenshot.png"

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_context(viewport={"width": 1360, "height": 1500}, device_scale_factor=2).new_page()
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_timeout(7000)

    for label in ("继续", "知道了", "关闭"):
        if page.get_by_role("button", name=label).count() > 0:
            page.get_by_role("button", name=label).first.click(force=True)
            page.wait_for_timeout(1200)
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    page.evaluate("""() => { for (const m of document.querySelectorAll('[class*="_mask_"]')) m.remove() }""")

    # One throwaway turn makes the Host assemble a session, which fills the tool catalog.
    box = page.locator("textarea, [contenteditable=true]").first
    box.click()
    box.type("hi")
    page.keyboard.press("Enter")
    page.wait_for_timeout(9000)

    state = page.evaluate("""async () => {
      const response = await fetch('/tool-fold/state')
      if (!response.ok) return { status: response.status }
      const body = await response.json()
      return { catalog: body.catalog.length, presets: body.presets.map(p => p.id) }
    }""")
    print(json.dumps({"catalogAfterTurn": state}, ensure_ascii=False))

    page.get_by_role("button", name="新会话").first.click(force=True)
    page.wait_for_timeout(2500)

    page.get_by_role("button", name="账号菜单").first.click(force=True)
    page.wait_for_timeout(700)
    page.get_by_role("menuitem", name="设置").first.click(force=True)
    page.wait_for_timeout(2500)
    page.get_by_role("button", name="工具折叠").first.click(force=True)
    page.wait_for_timeout(2500)

    # Start from whatever the profile has, so a re-run does not stack duplicate groups.
    page.evaluate("""() => {
      for (const button of document.querySelectorAll('.tf-card .tf-link')) {
        if (button.innerText.trim() === '删除') button.click()
      }
    }""")
    page.wait_for_timeout(600)

    page.get_by_role("button", name="新增折叠组").first.click()
    page.wait_for_timeout(900)
    page.locator(".tf-card-open input").first.fill("memory")
    page.wait_for_timeout(300)

    # Claim the standard preset so the group looks like a real deployment.
    page.evaluate("""() => {
      const chips = [...document.querySelectorAll('.tf-card-open .tf-chip')]
      const standard = chips[0]
      const box = standard?.querySelector('input[type=checkbox]')
      if (box !== null && box !== undefined && !box.checked) box.click()
    }""")
    page.wait_for_timeout(400)

    # Click one row at a time: React batches a synchronous burst of clicks on stale state.
    picked = []
    for name in ("read", "write", "edit", "glob", "grep"):
        index = page.evaluate(
            """(name) => [...document.querySelectorAll('.tf-card-open .tf-tool')]
                 .findIndex(el => el.querySelector('.tf-tool-name')?.innerText === name)""",
            name,
        )
        if index < 0:
            continue
        page.locator(".tf-card-open .tf-tool-label input").nth(index).click()
        page.wait_for_timeout(160)
        picked.append(name)
    print(json.dumps({"bound": picked}, ensure_ascii=False))
    page.wait_for_timeout(500)

    page.get_by_role("button", name="保存").first.click()
    page.wait_for_timeout(2600)
    saved = page.evaluate("""() => ({ saved: document.querySelector('.tf-saved')?.innerText ?? null,
                                     error: document.querySelector('.tf-save-error')?.innerText ?? null })""")
    print(json.dumps({"save": saved}, ensure_ascii=False))

    # Keep one card open and one tool detail visible so the shot shows both layers.
    page.evaluate("""() => {
      const card = document.querySelector('.tf-card')
      const d = card?.querySelector('.tf-disclosure')
      if (d !== null && d !== undefined && d.getAttribute('aria-expanded') !== 'true') d.click()
    }""")
    page.wait_for_timeout(600)
    page.evaluate(
        """() => {
          const rows = [...document.querySelectorAll('.tf-card .tf-tool')]
          const row = rows.find(el => el.querySelector('.tf-tool-name')?.innerText === 'edit')
          const button = row?.querySelector('.tf-tool-info')
          if (button !== null && button !== undefined) button.click()
        }"""
    )
    page.wait_for_timeout(700)
    page.evaluate("""() => document.querySelector('.tf-card')?.scrollIntoView({ block: 'start' })""")
    page.wait_for_timeout(500)
    page.screenshot(path=SHOT, full_page=False)
    browser.close()
