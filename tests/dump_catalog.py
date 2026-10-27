"""Dump the tool catalog the settings page sees, grouped by origin/layer."""

import json
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1]

with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_context(viewport={"width": 1280, "height": 950}).new_page()
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_timeout(7000)
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    data = page.evaluate("""async () => {
      const response = await fetch('/tool-fold/state')
      if (!response.ok) return { status: response.status }
      return await response.json()
    }""")
    catalog = data.get("catalog", [])
    print(json.dumps({"status": data.get("status", "ok"), "count": len(catalog)}, ensure_ascii=False))
    for entry in catalog:
        print(json.dumps({
            "name": entry.get("name"),
            "origin": entry.get("origin"),
            "server": entry.get("server"),
            "layer": entry.get("layer"),
            "hasParameters": entry.get("parameters") is not None,
            "description": (entry.get("description") or "")[:48],
        }, ensure_ascii=False))
    presets = data.get("presets", [])
    print(json.dumps({"presets": [preset.get("id") for preset in presets]}, ensure_ascii=False))
    browser.close()
