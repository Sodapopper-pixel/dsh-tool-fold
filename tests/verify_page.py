"""Open the tool-fold settings page in the running Host and assert the page layout contract."""

import json
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else "tool-fold-page.png"

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_context(viewport={"width": 1280, "height": 950}).new_page()
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_timeout(5000)

    page.get_by_role("button", name="账号菜单").first.click()
    page.wait_for_timeout(800)
    menu = page.evaluate(
        """() => [...document.querySelectorAll('[role=menuitem]')].map(el => (el.innerText || '').trim().split('\\n')[0])"""
    )
    page.get_by_role("menuitem", name="设置").first.click()
    page.wait_for_timeout(2500)
    nav = page.evaluate(
        """() => [...document.querySelectorAll('nav button, nav [role=button], aside button')]
            .map(el => (el.innerText || el.getAttribute('aria-label') || '').trim().split('\\n')[0])
            .filter(text => text !== '')"""
    )
    page.get_by_role("button", name="工具折叠").first.click()
    page.wait_for_timeout(3000)

    # Expand every group panel so the tool picker inside becomes measurable.
    page.evaluate("""() => { for (const b of document.querySelectorAll('.tf-disclosure[aria-expanded="false"]')) b.click() }""")
    page.wait_for_timeout(1200)
    # Open the first tool's details panel, then record the two collapsed blocks inside it.
    page.evaluate("""() => { const b = document.querySelector('.tf-tool-info'); if (b !== null) b.click() }""")
    page.wait_for_timeout(1200)

    report = page.evaluate(
        """() => {
          const page = document.querySelector('.tf-page')
          const cards = [...document.querySelectorAll('.tf-card')]
          const headers = [...document.querySelectorAll('.tf-card-head')]
          const groups = document.querySelector('.tf-groups')
          return {
            hasPage: page !== null,
            hasDefaultsSection: document.querySelector('.tf-defaults') !== null,
            bodyHasDefaultsLabel: document.body.innerText.includes('新组的默认值'),
            cards: cards.length,
            openCards: document.querySelectorAll('.tf-card-open').length,
            groupRowGap: groups === null ? null : getComputedStyle(groups).rowGap,
            gaps: cards.slice(1).map(card => Math.round(card.getBoundingClientRect().top - card.previousElementSibling.getBoundingClientRect().bottom)),
            headerDisclosure: headers.map(h => {
              const button = h.querySelector('.tf-disclosure')
              return button === null ? null : { expanded: button.getAttribute('aria-expanded'), text: button.innerText }
            }),
            cardBodyGap: (() => {
              const body = document.querySelector('.tf-card-body')
              return body === null ? null : getComputedStyle(body).rowGap
            })(),
            footer: (() => {
              const footer = document.querySelector('.tf-footer')
              return footer === null ? null : footer.innerText.replace(/\\n/g, ' | ')
            })(),
            toolRows: document.querySelectorAll('.tf-tool').length,
            toolDetails: document.querySelectorAll('.tf-tool-details').length,
            detailsBlocks: [...document.querySelectorAll('.tf-details')].map(d => ({ summary: d.querySelector('summary').innerText, open: d.open })),
            toolMeta: (() => {
              const meta = document.querySelector('.tf-tool-meta')
              return meta === null ? null : meta.innerText.replace(/\\n/g, ' | ')
            })(),
            originBadges: [...document.querySelectorAll('.tf-tool-origin')].slice(0, 5).map(el => el.innerText),
            schemaPreview: (() => {
              const pre = document.querySelector('.tf-schema')
              return pre === null ? null : pre.innerText.slice(0, 90)
            })(),
          }
        }"""
    )
    report["menu"] = menu
    report["nav"] = nav
    print(json.dumps(report, ensure_ascii=False, indent=1))

    page.screenshot(path=OUT, full_page=False)

    # Click save and read the inline notice beside the buttons.
    page.get_by_role("button", name="保存").first.click()
    page.wait_for_timeout(2500)
    saved = page.evaluate(
        """() => {
          const note = document.querySelector('.tf-saved, .tf-save-error')
          const footer = document.querySelector('.tf-footer')
          if (note === null) return { found: false }
          const r = note.getBoundingClientRect()
          const f = footer.getBoundingClientRect()
          const color = getComputedStyle(note).color
          return { found: true, text: note.innerText, color, className: note.className,
                   besideButtons: r.top >= f.top && r.top <= f.bottom }
        }"""
    )
    print(json.dumps({"save": saved}, ensure_ascii=False))
    page.screenshot(path=OUT.replace(".png", "-saved.png"), full_page=False)
    browser.close()
