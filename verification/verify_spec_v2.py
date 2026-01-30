from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # 1. Check Popup UI Structure
    print("--- Verifying Popup UI ---")
    page.goto("file:///app/popup.html")

    tabs = page.locator(".tab-btn")
    count = tabs.count()
    print(f"Tabs count: {count} (Expected 3)")

    tab_names = [tabs.nth(i).inner_text().strip() for i in range(count)]
    print(f"Tabs: {tab_names}")

    # Check if 'Scheduled Start' is gone (it should be removed)
    if page.get_by_text("Scheduled Start").count() > 0 or page.get_by_text("指定時刻に開始").count() > 0:
        print("FAILURE: Scheduled Start still present!")
    else:
        print("SUCCESS: Scheduled Start removed.")

    # Check Stealth Tab
    page.click("button[data-tab='tab-stealth']")
    page.wait_for_selector("#tab-stealth.active")

    stealth_checks = {
        "Anti-Blur": "#always-active-check",
        "Mouse Jiggler": "#mouse-jiggler-check",
        "Auto Scroll": "#auto-scroll-check",
        "User Agent": "#user-agent-select"
    }

    for name, sel in stealth_checks.items():
        if page.locator(sel).is_visible():
            print(f"SUCCESS: {name} found.")
        else:
            print(f"FAILURE: {name} NOT found.")

    # Check Safety Tab
    page.click("button[data-tab='tab-safety']")
    page.wait_for_selector("#tab-safety.active")

    if page.locator("#captcha-alert-check").is_visible():
        print("SUCCESS: CAPTCHA Alert check found.")
    else:
        print("FAILURE: CAPTCHA Alert check NOT found.")

    # Check Sound option appears when Alert checked
    page.check("#captcha-alert-check")
    if page.locator("#captcha-sound-check").is_visible():
         print("SUCCESS: CAPTCHA Sound check appeared.")
    else:
         print("FAILURE: CAPTCHA Sound check did NOT appear.")

    page.screenshot(path="verification/spec_v2_ui.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
