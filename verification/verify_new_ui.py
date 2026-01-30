from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    page.goto("file:///app/popup.html")

    # Check Tabs
    tabs = page.locator(".tab-btn")
    print(f"Tabs found: {tabs.count()}")
    for i in range(tabs.count()):
        print(f"Tab {i}: {tabs.nth(i).inner_text()}")

    # Check General Tab (Default active)
    if page.locator("#tab-general").is_visible():
        print("General Tab is visible")
    else:
        print("General Tab is NOT visible")

    # Switch to Stealth Tab
    page.click("button[data-tab='tab-stealth']")
    page.wait_for_selector("#tab-stealth.active")
    print("Switched to Stealth Tab")

    # Check Mouse Jiggler
    if page.locator("#mouse-jiggler-check").is_visible():
        print("Mouse Jiggler Checkbox found!")

    # Switch to Conditions Tab
    page.click("button[data-tab='tab-stop-start']")
    page.wait_for_selector("#tab-stop-start.active")
    print("Switched to Conditions Tab")

    # Check Scheduled Start
    if page.locator("#scheduled-start-check").is_visible():
        print("Scheduled Start Checkbox found!")

    # Take screenshot
    page.screenshot(path="verification/new_ui.png", full_page=True)

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
