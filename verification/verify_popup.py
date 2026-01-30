from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Load the popup HTML file
    # Note: Some Chrome API calls in popup.js (like chrome.storage) will fail,
    # but the HTML/CSS should render.
    # We might see console errors, but we care about visual layout.
    page.goto("file:///app/popup.html")

    # Wait for the title to be visible
    page.wait_for_selector(".title")

    # Check if the Anti-Blur checkbox exists
    checkbox = page.locator("#always-active-check")
    if checkbox.is_visible():
        print("Anti-Blur checkbox found!")
    else:
        print("Anti-Blur checkbox NOT found!")

    # Check the section label
    label = page.locator("section.stealth-section span")
    if label.is_visible() and "Anti-Blur" in label.inner_text():
        print("Anti-Blur label found!")
    else:
        print("Anti-Blur label NOT found!")

    # Take a screenshot
    page.screenshot(path="verification/popup_ui.png", full_page=True)

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
