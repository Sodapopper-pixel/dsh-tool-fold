"""Verify tool provenance labels and the unsaved-changes indicator against a running Host."""

import json
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1]
SHOT = sys.argv[2] if len(sys.argv) > 2 else "isolated-origins.png"

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_context(viewport={"width": 1280, "height": 950}).new_page()
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_timeout(6000)

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

    # Open the first card so its tool rows render, and widen the picker to the whole catalog.
    state = page.evaluate(
        """() => {
          const card = document.querySelector('.tf-card')
          if (card === null) return { cards: 0 }
          const disclosure = card.querySelector('.tf-disclosure')
          if (disclosure !== null && disclosure.getAttribute('aria-expanded') !== 'true') disclosure.click()
          const filter = [...card.querySelectorAll('input[type=text]')].find(el => el.placeholder?.includes('筛选'))
          if (filter !== undefined) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
            setter.call(filter, '')
            filter.dispatchEvent(new Event('input', { bubbles: true }))
          }
          return { cards: document.querySelectorAll('.tf-card').length }
        }"""
    )
    page.wait_for_timeout(900)

    labels = page.evaluate(
        """() => {
          const card = document.querySelector('.tf-card')
          const rows = [...card.querySelectorAll('.tf-tool')]
          const pick = names => names.map(name => {
            const row = rows.find(el => el.querySelector('.tf-tool-name')?.innerText === name)
            return { tool: name, origin: row?.querySelector('.tf-tool-origin')?.innerText ?? null }
          })
          const all = rows.map(el => el.querySelector('.tf-tool-origin')?.innerText ?? '')
          const tally = {}
          for (const label of all) {
            const key = label.split('·')[0].trim() || label
            tally[key] = (tally[key] ?? 0) + 1
          }
          return {
            sampled: pick(['mcp__openviking__find', 'read', 'sidebar_open', 'task_board_run', 'find_dsh_plugin']),
            tally,
            rows: rows.length,
          }
        }"""
    )
    print(json.dumps({"cards": state, "origins": labels}, ensure_ascii=False))

    # Editing the draft must announce that the configuration on disk is behind.
    page.evaluate("""() => { const b = document.querySelector('.tf-card .tf-tool-label input[type=checkbox]'); if (b !== null) b.click() }""")
    page.wait_for_timeout(700)
    dirty = page.evaluate(
        """() => {
          const note = document.querySelector('.tf-dirty')
          const footer = document.querySelector('.tf-footer')
          if (note === null || footer === null) return { found: false }
          const r = note.getBoundingClientRect()
          const f = footer.getBoundingClientRect()
          return { found: true, text: note.innerText, color: getComputedStyle(note).color,
                   besideButtons: r.top >= f.top && r.top <= f.bottom,
                   savedVisible: document.querySelector('.tf-saved') !== null }
        }"""
    )
    print(json.dumps({"dirty": dirty}, ensure_ascii=False))
    page.screenshot(path=SHOT, full_page=False)

    page.get_by_role("button", name="保存").first.click()
    page.wait_for_timeout(2500)
    settled = page.evaluate(
        """() => ({ dirty: document.querySelector('.tf-dirty') !== null,
                    saved: document.querySelector('.tf-saved')?.innerText ?? null,
                    error: document.querySelector('.tf-save-error')?.innerText ?? null })"""
    )
    print(json.dumps({"afterSave": settled}, ensure_ascii=False))
    browser.close()
