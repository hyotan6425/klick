from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    print("--- Verifying Emergency Features UI ---")
    page.goto("file:///app/popup.html")

    # Switch to Safety Tab
    page.click("button[data-tab='tab-safety']")
    page.wait_for_selector("#tab-safety.active")
    print("Switched to Safety Tab")

    # Check Global Stop Button
    if page.locator("#global-stop-btn").is_visible():
        print("SUCCESS: Global Stop button found.")
        text = page.locator("#global-stop-btn").inner_text()
        print(f"Button Text: {text}")
    else:
        print("FAILURE: Global Stop button NOT found.")

    # Check Panic Reset Button
    if page.locator("#panic-reset-btn").is_visible():
        print("SUCCESS: Panic Reset button found.")
        text = page.locator("#panic-reset-btn").inner_text()
        print(f"Button Text: {text}")
    else:
        print("FAILURE: Panic Reset button NOT found.")

    page.screenshot(path="verification/emergency_ui.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
