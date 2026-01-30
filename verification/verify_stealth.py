from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    page.goto("file:///app/popup.html")

    # Switch to Stealth Tab
    page.click("button[data-tab='tab-stealth']")
    page.wait_for_selector("#tab-stealth.active")
    print("Switched to Stealth Tab")

    # Check CAPTCHA Alert
    if page.locator("#captcha-alert-check").is_visible():
        print("CAPTCHA Alert Checkbox found!")

    # Check User-Agent Select
    if page.locator("#user-agent-select").is_visible():
        print("User-Agent Select found!")

    # Take screenshot
    page.screenshot(path="verification/stealth_features.png", full_page=True)

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
