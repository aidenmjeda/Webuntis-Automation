// ==UserScript==
// @name         WebUntis Auto Navigation
// @namespace    http://tampermonkey.net/
// @version      2025-10-05
// @description  Auto-click Peter Mahringer school and navigate to Stundenplan
// @author       You
// @match        https://webuntis.com/*
// @match        https://*.webuntis.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=webuntis.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log("🚀 Tampermonkey WebUntis Auto Navigation loaded");

    // --- Helper function: wait until element exists ---
    function waitForElement(selector, callback, context = document, interval = 500, timeout = 20000) {
        const start = Date.now();
        const timer = setInterval(() => {
            const el = context.querySelector(selector);
            if (el) {
                clearInterval(timer);
                console.log("✅ Found element:", selector);
                callback(el);
            } else if (Date.now() - start > timeout) {
                clearInterval(timer);
                console.warn("⏰ Timeout: Element not found:", selector);
            }
        }, interval);
    }

    // --- Helper to get iframe document ---
    function getIframeDocument() {
        const iframe = document.querySelector('#timetable-page-iframe');
        if (iframe && iframe.contentDocument) {
            return iframe.contentDocument;
        }
        return null;
    }

    // --- Delay helper ---
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // --- Track processed state ---
    let schoolLinkClicked = false;
    let stundenplanClicked = false;
    let classSelected = false;

    // --- Configuration ---
    const TARGET_CLASS = "4a"; // Change this to your target class

    // --- Step 1: Click the school link on main page ---
    async function tryClickSchoolLink() {
        if (schoolLinkClicked) return;

        // Look for the exact link from your HTML
        const schoolLink = document.querySelector('a.visited-school[href="https://hektor.webuntis.com/WebUntis/?school=htl-shkoder"]');

        if (schoolLink) {
            schoolLinkClicked = true;
            console.log("✅ Found school link, clicking...");
            await delay(500);
            schoolLink.click();
            console.log("🖱️ School link clicked!");
            return true;
        }

        // Fallback: try any link with htl-shkoder
        const fallbackLink = document.querySelector('a[href*="htl-shkoder"]');
        if (fallbackLink) {
            schoolLinkClicked = true;
            console.log("✅ Found fallback school link, clicking...");
            await delay(500);
            fallbackLink.click();
            console.log("🖱️ Fallback school link clicked!");
            return true;
        }

        console.log("❌ School link not found yet...");
        return false;
    }

    // --- Step 2: Click Stundenplan link after navigation ---
    async function tryClickStundenplan() {
        if (stundenplanClicked) return;

        // Only proceed if we're on the school page
        if (!location.href.includes("school=htl-shkoder")) {
            console.log("⏳ Waiting for school page...");
            return false;
        }

        console.log("🔍 Looking for Stundenplan link...");

        // Try multiple possible selectors for the Stundenplan link
        const selectors = [
            'a.un-navlink[href="#/basic/timetablePublic"]',
            'a[href="#/basic/timetablePublic"]',
            'a.item.un2-elements__link[href="#/basic/timetablePublic"]',
            'a[href*="timetablePublic"]'
        ];

        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
                stundenplanClicked = true;
                console.log("✅ Found Stundenplan link:", selector);
                await delay(500);
                el.click();
                console.log("🖱️ Stundenplan link clicked!");

                // Wait for iframe to load, then try to select class
                setTimeout(trySelectClassInIframe, 3000);
                setTimeout(trySelectClassInIframe, 5000);
                setTimeout(trySelectClassInIframe, 7000);

                return true;
            }
        }

        console.log("❌ Stundenplan link not found yet...");
        return false;
    }

    // --- Step 3: Select class 4a (inside iframe) ---
    async function trySelectClassInIframe() {
        if (classSelected) return;

        console.log("🔍 Looking for iframe and class selector...");

        // Get the iframe document
        const iframeDoc = getIframeDocument();
        if (!iframeDoc) {
            console.log("❌ Iframe not found or not accessible yet...");
            return false;
        }

        console.log("✅ Found iframe, looking inside for class selector...");

        // Find the main dropdown selector using the specific data-testid
        const dropdown = iframeDoc.querySelector('[data-testid="timetable-item-selector-drop-down"]');

        if (!dropdown) {
            console.log("❌ Dropdown with data-testid not found, trying alternative selector...");
            const altDropdown = iframeDoc.querySelector('.ant-select.timetable-entity-filter-selector');
            if (!altDropdown) {
                console.log("❌ No dropdown selector found at all");
                return false;
            }
            console.log("✅ Found dropdown using alternative selector");
        } else {
            console.log("✅ Found dropdown using data-testid");
        }

        const finalDropdown = dropdown || iframeDoc.querySelector('.ant-select.timetable-entity-filter-selector');

        // Check what is currently selected
        const currentSelection = finalDropdown.querySelector('.ant-select-selection-item .item-label');
        if (currentSelection) {
            const currentText = currentSelection.textContent.trim();
            console.log(`📌 Current selection: "${currentText}"`);

            // Check if 4a is already selected
            if (currentText === TARGET_CLASS) {
                classSelected = true;
                console.log(`✅ Class "${TARGET_CLASS}" is already selected!`);
                return true;
            }
        }

        // Click the dropdown to open it - try multiple click targets
        console.log("🖱️ Clicking dropdown to open...");

        // Try clicking the selector part specifically
        const selector = finalDropdown.querySelector('.ant-select-selector');
        if (selector) {
            console.log("   Clicking on .ant-select-selector...");
            selector.click();
        } else {
            console.log("   Clicking on main dropdown element...");
            finalDropdown.click();
        }

        await delay(2000); // Wait for dropdown to open and render

        // Now look for the search input and type "4a" into it
        console.log("Looking for search input to type class name...");

        const searchInput = iframeDoc.querySelector('.ant-select-selection-search-input');
        if (searchInput) {
            console.log("Found search input, typing '4a'...");

            // Focus the input
            searchInput.focus();
            await delay(300);

            // Type "4a" into the search box
            searchInput.value = TARGET_CLASS;

            // Trigger input event so the dropdown filters
            const inputEvent = new Event('input', { bubbles: true });
            searchInput.dispatchEvent(inputEvent);

            await delay(1000); // Wait for filtering to complete

            console.log("Typed '4a' into search, looking for the option...");

            // Now look for the 4a option (should be filtered and visible)
            const classOption = iframeDoc.querySelector('.ant-select-item[title="' + TARGET_CLASS + '"]');
            if (classOption) {
                classSelected = true;
                console.log(`Found class "${TARGET_CLASS}" option after search, clicking...`);
                await delay(300);
                classOption.click();
                console.log(`Class "${TARGET_CLASS}" selected!`);
                return true;
            }

            // Also try by label
            const classOptionByLabel = iframeDoc.querySelector('.ant-select-item[label="' + TARGET_CLASS + '"]');
            if (classOptionByLabel) {
                classSelected = true;
                console.log(`Found class "${TARGET_CLASS}" by label after search, clicking...`);
                await delay(300);
                classOptionByLabel.click();
                console.log(`Class "${TARGET_CLASS}" selected!`);
                return true;
            }

            // If still not found, check what options are visible
            const visibleOptions = iframeDoc.querySelectorAll('.ant-select-item.ant-select-item-option');
            console.log(`After search, found ${visibleOptions.length} visible options:`);
            for (const opt of visibleOptions) {
                const title = opt.getAttribute('title');
                console.log(`  - ${title}`);
                if (title === TARGET_CLASS) {
                    classSelected = true;
                    console.log(`Found "${TARGET_CLASS}" in list, clicking...`);
                    opt.click();
                    return true;
                }
            }
        } else {
            console.log("Search input not found, falling back to scrolling method...");
        }

        // Fallback: Original scrolling method if search doesn't work
        console.log("🔍 Looking for class 4a in dropdown options...");

        // The dropdown uses a virtual list, so we need to scroll to find our item
        const virtualList = iframeDoc.querySelector('.rc-virtual-list-holder');
        if (virtualList) {
            console.log("✅ Found virtual list, scrolling to find 4a...");

            // Scroll to the top first
            virtualList.scrollTop = 0;
            await delay(500);

            // Try multiple times with scrolling
            for (let attempt = 0; attempt < 20; attempt++) {
                console.log(`📜 Scroll attempt ${attempt + 1}/20, scrollTop: ${virtualList.scrollTop}`);

                // Log what's currently visible
                const visibleOptions = iframeDoc.querySelectorAll('.ant-select-item.ant-select-item-option');
                if (attempt === 0 || attempt % 5 === 0) {
                    console.log(`   Visible items: ${Array.from(visibleOptions).map(o => o.getAttribute('title')).join(', ')}`);
                }

                // Check if 4a is now visible
                const classOption = iframeDoc.querySelector('.ant-select-item[title="' + TARGET_CLASS + '"]');
                if (classOption) {
                    classSelected = true;
                    console.log(`✅ Found class "${TARGET_CLASS}" option, clicking...`);
                    await delay(300);
                    classOption.click();
                    console.log(`🖱️ Class "${TARGET_CLASS}" selected!`);
                    return true;
                }

                // Also check by label attribute
                const classOptionByLabel = iframeDoc.querySelector('.ant-select-item[label="' + TARGET_CLASS + '"]');
                if (classOptionByLabel) {
                    classSelected = true;
                    console.log(`✅ Found class "${TARGET_CLASS}" option by label, clicking...`);
                    await delay(300);
                    classOptionByLabel.click();
                    console.log(`🖱️ Class "${TARGET_CLASS}" selected!`);
                    return true;
                }

                // Scroll down to load more items
                virtualList.scrollTop += 60;
                await delay(400);
            }
        }

        // Final fallback: search all visible options
        const allOptions = iframeDoc.querySelectorAll('.ant-select-item.ant-select-item-option');
        console.log(`📋 Found ${allOptions.length} options in dropdown (final check)`);

        for (const option of allOptions) {
            const title = option.getAttribute('title');
            const label = option.getAttribute('label');
            const content = option.querySelector('.ant-select-item-option-content');
            const text = content ? content.textContent.trim() : '';

            console.log(`  - Option: title="${title}", label="${label}", text="${text}"`);

            if (title === TARGET_CLASS || label === TARGET_CLASS || text === TARGET_CLASS) {
                classSelected = true;
                console.log(`✅ Found class "${TARGET_CLASS}", clicking...`);
                await delay(300);
                option.click();
                console.log(`🖱️ Class "${TARGET_CLASS}" selected!`);
                return true;
            }
        }

        console.log(`❌ Class "${TARGET_CLASS}" not found in dropdown after all attempts`);
        return false;
    }

    // --- URL change observer for SPA navigation ---
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
        if (location.href !== lastUrl) {
            console.log("🔄 URL changed to:", location.href);
            lastUrl = location.href;

            // After URL changes, try clicking Stundenplan
            setTimeout(tryClickStundenplan, 1000);
            setTimeout(tryClickStundenplan, 2000);
            setTimeout(tryClickStundenplan, 3000);
            setTimeout(tryClickStundenplan, 4000);
        }
    });

    // Start observing when body is available
    if (document.body) {
        observer.observe(document.body, {
            subtree: true,
            childList: true
        });
        console.log("👀 Started observing DOM changes");
    }

    // --- Initial execution ---
    console.log("🎯 Current URL:", location.href);

    // If we're on the main page, click the school link
    if (!location.href.includes("school=")) {
        console.log("📍 On main page, attempting to click school link...");
        setTimeout(tryClickSchoolLink, 1000);
        setTimeout(tryClickSchoolLink, 2000);
        setTimeout(tryClickSchoolLink, 3000);
    }

    // If we're already on the school page, go directly to Stundenplan
    if (location.href.includes("school=htl-shkoder")) {
        console.log("📍 Already on school page, attempting to click Stundenplan...");
        setTimeout(tryClickStundenplan, 1500);
        setTimeout(tryClickStundenplan, 3000);
        setTimeout(tryClickStundenplan, 4500);
    }

    // If we're already on the timetable page, select the class
    if (location.href.includes("timetablePublic")) {
        console.log("📍 Already on timetable page, attempting to select class in iframe...");
        setTimeout(trySelectClassInIframe, 2000);
        setTimeout(trySelectClassInIframe, 4000);
        setTimeout(trySelectClassInIframe, 6000);
    }

    console.log("✨ Script initialized successfully");

})();