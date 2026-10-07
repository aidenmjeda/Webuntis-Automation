// ==UserScript==
// @name         WebUntis Auto Navigation
// @namespace    http://tampermonkey.net/
// @version      2026-10-07
// @description  Auto-click the school, open Stundenplan and select your class (with a class picker)
// @author       Aiden Mjeda
// @match        https://webuntis.com/*
// @match        https://*.webuntis.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=webuntis.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Don't run a second copy inside the timetable iframe
    if (window.top !== window.self) return;

    console.log("🚀 Tampermonkey WebUntis Auto Navigation loaded");

    // --- Configuration ---
    const SCHOOL = "htl-shkoder";
    const DEFAULT_CLASS = "5a";
    const AUTO_CONFIRM_SECONDS = 6;   // picker auto-continues with the remembered class
    const STORAGE_KEY = "wuAutoNav.settings";

    // --- Settings (remembered class + "ask every time") ---
    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            return {
                targetClass: typeof saved.targetClass === "string" && saved.targetClass ? saved.targetClass : DEFAULT_CLASS,
                askEveryTime: saved.askEveryTime !== false
            };
        } catch (e) {
            return { targetClass: DEFAULT_CLASS, askEveryTime: true };
        }
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.warn("⚠️ Could not save settings:", e);
        }
    }

    const settings = loadSettings();

    // --- Helpers ---
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Poll until fn() returns something truthy (or time out with null)
    async function waitFor(fn, timeout = 15000, interval = 250) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const result = fn();
            if (result) return result;
            await delay(interval);
        }
        return null;
    }

    // The timetable lives in an iframe on older WebUntis versions, directly in the page on newer ones
    function getTimetableDocument() {
        const iframe = document.querySelector('#timetable-page-iframe');
        if (iframe) {
            try {
                return iframe.contentDocument;
            } catch (e) {
                return null;
            }
        }
        return document;
    }

    function normalize(text) {
        return (text || "").trim().toLowerCase();
    }

    // Ant Design Select opens on mousedown, not click — fire the full sequence
    function realClick(el) {
        const win = el.ownerDocument.defaultView || window;
        const opts = { bubbles: true, cancelable: true, view: win, button: 0 };
        for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
            const Ctor = type.startsWith("pointer") && win.PointerEvent ? win.PointerEvent : win.MouseEvent;
            el.dispatchEvent(new Ctor(type, opts));
        }
    }

    // React ignores `input.value = x`; use the native setter so onChange fires
    function setReactInputValue(input, value) {
        const win = input.ownerDocument.defaultView || window;
        const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value").set;
        setter.call(input, value);
        input.dispatchEvent(new win.Event("input", { bubbles: true }));
    }

    // --- Track processed state ---
    let schoolLinkClicked = false;
    let stundenplanClicked = false;
    let classFlowStarted = false;
    let selecting = false;
    let pendingClass = null;

    // --- Step 1: Click the school link on main page ---
    async function tryClickSchoolLink() {
        if (schoolLinkClicked) return;

        const schoolLink = document.querySelector(`a.visited-school[href*="school=${SCHOOL}"]`)
            || document.querySelector(`a[href*="${SCHOOL}"]`);

        if (schoolLink) {
            schoolLinkClicked = true;
            console.log("✅ Found school link, clicking...");
            await delay(300);
            schoolLink.click();
            console.log("🖱️ School link clicked!");
            return true;
        }

        console.log("❌ School link not found yet...");
        return false;
    }

    // --- Step 2: Click Stundenplan link after navigation ---
    async function tryClickStundenplan() {
        if (stundenplanClicked) return;

        if (location.href.includes("timetablePublic")) {
            stundenplanClicked = true;
            startClassFlow();
            return true;
        }

        if (!location.href.includes(`school=${SCHOOL}`)) {
            console.log("⏳ Waiting for school page...");
            return false;
        }

        console.log("🔍 Looking for Stundenplan link...");

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
                await delay(300);
                el.click();
                console.log("🖱️ Stundenplan link clicked!");
                startClassFlow();
                return true;
            }
        }

        console.log("❌ Stundenplan link not found yet...");
        return false;
    }

    // --- Step 3: Ask which class (picker), then select it ---
    function startClassFlow() {
        if (classFlowStarted) return;
        classFlowStarted = true;

        if (settings.askEveryTime) {
            openClassPicker({ autoConfirm: true });
        } else {
            showClassPill();
            selectClass(settings.targetClass);
        }
    }

    function findClassDropdown(doc) {
        return doc.querySelector('[data-testid="timetable-item-selector-drop-down"]')
            || doc.querySelector('.ant-select.timetable-entity-filter-selector');
    }

    function currentSelection(dropdown) {
        const label = dropdown.querySelector('.ant-select-selection-item .item-label')
            || dropdown.querySelector('.ant-select-selection-item');
        return label ? label.textContent.trim() : "";
    }

    function visibleOptions(doc) {
        return Array.from(doc.querySelectorAll(
            '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'
        ));
    }

    function findOption(doc, target) {
        const wanted = normalize(target);
        return visibleOptions(doc).find(opt => {
            const content = opt.querySelector('.ant-select-item-option-content');
            return normalize(opt.getAttribute('title')) === wanted
                || normalize(opt.getAttribute('label')) === wanted
                || normalize(content && content.textContent) === wanted;
        });
    }

    async function selectClass(target) {
        if (selecting) {
            // Picked another class while still selecting: run it right after
            pendingClass = target;
            return false;
        }
        selecting = true;
        updatePill(target, "busy");

        try {
            for (let attempt = 1; attempt <= 5; attempt++) {
                console.log(`🔍 Selecting class "${target}" (attempt ${attempt}/5)...`);
                if (await attemptSelectClass(target)) {
                    updatePill(target, "done");
                    return true;
                }
                await delay(1000);
            }
            console.log(`❌ Class "${target}" could not be selected`);
            updatePill(target, "error");
            return false;
        } finally {
            selecting = false;
            if (pendingClass) {
                const next = pendingClass;
                pendingClass = null;
                if (next !== target) selectClass(next);
            }
        }
    }

    async function attemptSelectClass(target) {
        // Wait for the timetable (iframe) and its class dropdown to exist
        const found = await waitFor(() => {
            const doc = getTimetableDocument();
            const dropdown = doc && findClassDropdown(doc);
            return dropdown ? { doc, dropdown } : null;
        }, 20000);

        if (!found) {
            console.log("❌ Class dropdown not found");
            return false;
        }

        const { doc, dropdown } = found;

        if (normalize(currentSelection(dropdown)) === normalize(target)) {
            console.log(`✅ Class "${target}" is already selected!`);
            return true;
        }

        // Open the dropdown (Ant Select listens to mousedown)
        if (!dropdown.classList.contains('ant-select-open')) {
            console.log("🖱️ Opening class dropdown...");
            realClick(dropdown.querySelector('.ant-select-selector') || dropdown);
        }

        // Type the class into the search box to filter the (virtual) list
        const searchInput = dropdown.querySelector('.ant-select-selection-search-input');
        if (searchInput) {
            searchInput.focus();
            setReactInputValue(searchInput, target);
        }

        let option = await waitFor(() => findOption(doc, target), 3000, 150);

        // Fallback: scroll through the virtual list
        if (!option) {
            console.log("📜 Not found via search, scrolling through the list...");
            if (searchInput) setReactInputValue(searchInput, "");
            const list = await waitFor(() =>
                doc.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .rc-virtual-list-holder'), 2000);
            if (list) {
                list.scrollTop = 0;
                for (let i = 0; i < 60 && !option; i++) {
                    await delay(120);
                    option = findOption(doc, target);
                    if (!option) {
                        if (list.scrollTop + list.clientHeight >= list.scrollHeight) break;
                        list.scrollTop += 60;
                    }
                }
            }
        }

        if (!option) {
            console.log(`❌ Class "${target}" not in the dropdown`);
            // Close the dropdown again
            if (searchInput) {
                const win = doc.defaultView || window;
                searchInput.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }));
            }
            return false;
        }

        console.log(`🖱️ Clicking class "${target}"...`);
        realClick(option);

        const confirmed = await waitFor(() => normalize(currentSelection(dropdown)) === normalize(target), 3000, 150);
        if (confirmed) console.log(`✅ Class "${target}" selected!`);
        return !!confirmed;
    }

    // --- Class list (real list from WebUntis, with a sensible fallback) ---
    function fallbackClasses() {
        const list = [];
        for (let grade = 1; grade <= 5; grade++) {
            for (const letter of ["a", "b", "c", "d"]) list.push(`${grade}${letter}`);
        }
        return list;
    }

    function sortClasses(list) {
        return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    }

    async function fetchClasses() {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const res = await fetch(`/WebUntis/api/public/timetable/weekly/pageconfig?type=1&date=${today}`, {
                credentials: "include",
                headers: { "Accept": "application/json" }
            });
            if (!res.ok) return null;
            const json = await res.json();
            const elements = (json && json.data && json.data.elements) || [];
            const names = elements.map(e => e.name || e.displayname).filter(Boolean);
            return names.length ? sortClasses(names) : null;
        } catch (e) {
            console.log("ℹ️ Could not load class list, using fallback:", e);
            return null;
        }
    }

    // --- UI: class picker + floating pill (Shadow DOM so WebUntis styles don't leak) ---
    const STYLES = `
        :host { all: initial; }
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .wu {
            --bg: #ffffff; --fg: #0f172a; --muted: #64748b; --line: #e2e8f0;
            --chip: #f1f5f9; --chip-hover: #e2e8f0; --accent: #4f46e5; --accent-2: #7c3aed;
            --accent-fg: #ffffff; --ring: rgba(79, 70, 229, .35);
        }
        @media (prefers-color-scheme: dark) {
            .wu {
                --bg: #111827; --fg: #f8fafc; --muted: #94a3b8; --line: #1f2937;
                --chip: #1f2937; --chip-hover: #273449; --accent: #818cf8; --accent-2: #a78bfa;
                --accent-fg: #0b1020; --ring: rgba(129, 140, 248, .4);
            }
        }
        .backdrop {
            position: fixed; inset: 0; z-index: 2147483646;
            background: rgba(15, 23, 42, .45); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center; padding: 16px;
            animation: fade .18s ease-out;
        }
        .card {
            width: 100%; max-width: 440px; max-height: calc(100vh - 32px);
            display: flex; flex-direction: column;
            background: var(--bg); color: var(--fg); border-radius: 20px;
            box-shadow: 0 24px 64px rgba(0, 0, 0, .3); overflow: hidden;
            animation: pop .22s cubic-bezier(.2, .9, .3, 1.2);
        }
        .head {
            padding: 20px 22px 18px; color: #fff;
            background: linear-gradient(135deg, var(--accent), var(--accent-2));
            position: relative;
        }
        .head h2 { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -.01em; }
        .head p { margin: 4px 0 0; font-size: 13px; opacity: .85; }
        .close {
            position: absolute; top: 14px; right: 14px; width: 30px; height: 30px;
            border: 0; border-radius: 50%; background: rgba(255, 255, 255, .18); color: #fff;
            font-size: 18px; line-height: 30px; cursor: pointer;
        }
        .close:hover { background: rgba(255, 255, 255, .3); }
        .progress { position: absolute; left: 0; bottom: 0; height: 3px; background: rgba(255, 255, 255, .85); width: 100%; transform-origin: left; }
        .body { padding: 16px 22px 6px; overflow: auto; }
        .search {
            width: 100%; padding: 11px 14px; font-size: 14px;
            border: 1px solid var(--line); border-radius: 12px; background: var(--chip); color: var(--fg); outline: none;
        }
        .search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--ring); }
        .group { margin-top: 14px; }
        .group-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin-bottom: 8px; }
        .chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 8px; }
        .chip {
            padding: 10px 6px; border: 1px solid transparent; border-radius: 12px;
            background: var(--chip); color: var(--fg); font-size: 14px; font-weight: 600;
            cursor: pointer; transition: background .12s, transform .12s;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .chip:hover { background: var(--chip-hover); transform: translateY(-1px); }
        .chip.active {
            background: linear-gradient(135deg, var(--accent), var(--accent-2));
            color: #fff; box-shadow: 0 6px 16px var(--ring);
        }
        .chip:focus-visible, .btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ring); }
        .empty { color: var(--muted); font-size: 13px; padding: 14px 0; }
        .foot { padding: 14px 22px 20px; border-top: 1px solid var(--line); }
        .toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); cursor: pointer; margin-bottom: 12px; }
        .toggle input { accent-color: var(--accent); width: 16px; height: 16px; margin: 0; }
        .btn {
            width: 100%; padding: 13px; border: 0; border-radius: 12px; cursor: pointer;
            background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff;
            font-size: 15px; font-weight: 700;
        }
        .btn:hover { filter: brightness(1.06); }
        .pill {
            position: fixed; right: 18px; bottom: 18px; z-index: 2147483645;
            display: flex; align-items: center; gap: 8px; padding: 10px 16px;
            border: 0; border-radius: 999px; cursor: pointer;
            background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff;
            font-size: 14px; font-weight: 700; box-shadow: 0 10px 28px rgba(0, 0, 0, .25);
            animation: pop .22s ease-out;
        }
        .pill:hover { filter: brightness(1.08); }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #fff; opacity: .9; }
        .pill.busy .dot { animation: pulse 1s infinite; }
        .pill.error .dot { background: #fca5a5; }
        .pill .hint { font-weight: 500; opacity: .8; font-size: 12px; }
        @keyframes fade { from { opacity: 0; } }
        @keyframes pop { from { opacity: 0; transform: scale(.94) translateY(6px); } }
        @keyframes pulse { 50% { opacity: .25; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
    `;

    let uiRoot = null;
    function getUiRoot() {
        if (uiRoot) return uiRoot;
        const host = document.createElement("div");
        host.id = "wu-auto-nav-ui";
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: "open" });
        shadow.innerHTML = `<style>${STYLES}</style><div class="wu"></div>`;
        uiRoot = shadow.querySelector(".wu");
        return uiRoot;
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    let pill = null;
    function showClassPill() {
        if (pill) return;
        pill = el("button", "pill");
        pill.title = "Change class";
        pill.append(el("span", "dot"), el("span", "label"), el("span", "hint", "change"));
        pill.addEventListener("click", () => openClassPicker({ autoConfirm: false }));
        getUiRoot().appendChild(pill);
        updatePill(settings.targetClass);
    }

    function updatePill(cls, state) {
        if (!pill) return;
        pill.classList.toggle("busy", state === "busy");
        pill.classList.toggle("error", state === "error");
        pill.querySelector(".label").textContent = `🎓 ${cls}`;
        pill.querySelector(".hint").textContent = state === "busy" ? "selecting…" : state === "error" ? "retry" : "change";
    }

    let pickerOpen = false;
    function openClassPicker({ autoConfirm }) {
        if (pickerOpen) return;
        pickerOpen = true;

        let chosen = settings.targetClass;
        let classes = sortClasses([...fallbackClasses(), chosen]);
        let countdownTimer = null;

        const root = getUiRoot();
        const backdrop = el("div", "backdrop");
        const card = el("div", "card");
        card.setAttribute("role", "dialog");
        card.setAttribute("aria-modal", "true");
        card.setAttribute("aria-label", "Choose your class");

        const head = el("div", "head");
        head.append(el("h2", null, "Which class?"));
        const subtitle = el("p");
        head.append(subtitle);
        const closeBtn = el("button", "close", "×");
        closeBtn.setAttribute("aria-label", "Close");
        head.append(closeBtn);
        const progress = el("div", "progress");
        head.append(progress);

        const body = el("div", "body");
        const search = el("input", "search");
        search.placeholder = "Search class… (e.g. 5a)";
        search.setAttribute("aria-label", "Search class");
        const groups = el("div");
        body.append(search, groups);

        const foot = el("div", "foot");
        const toggle = el("label", "toggle");
        const askBox = el("input");
        askBox.type = "checkbox";
        askBox.checked = settings.askEveryTime;
        toggle.append(askBox, el("span", null, "Ask me every time I open the timetable"));
        const confirmBtn = el("button", "btn");
        foot.append(toggle, confirmBtn);

        card.append(head, body, foot);
        backdrop.append(card);
        root.append(backdrop);

        function render() {
            const query = normalize(search.value);
            const filtered = classes.filter(c => normalize(c).includes(query));
            groups.textContent = "";

            if (!filtered.length) {
                const empty = el("div", "empty", `No class matches "${search.value}". Press Enter to use it anyway.`);
                groups.append(empty);
            }

            // Group by grade (leading number), e.g. "1st year", "5th year"
            const byGrade = new Map();
            for (const c of filtered) {
                const m = c.match(/^\d+/);
                const key = m ? m[0] : "Other";
                if (!byGrade.has(key)) byGrade.set(key, []);
                byGrade.get(key).push(c);
            }
            for (const [grade, list] of byGrade) {
                const group = el("div", "group");
                group.append(el("div", "group-title", grade === "Other" ? "Other" : `Grade ${grade}`));
                const chips = el("div", "chips");
                for (const c of list) {
                    const chip = el("button", "chip" + (c === chosen ? " active" : ""), c);
                    chip.title = c;
                    chip.addEventListener("click", () => { chosen = c; render(); });
                    chip.addEventListener("dblclick", () => { chosen = c; confirm(); });
                    chips.append(chip);
                }
                group.append(chips);
                groups.append(group);
            }

            confirmBtn.textContent = `Open timetable for ${chosen}`;
        }

        function stopCountdown() {
            if (!countdownTimer) return;
            clearInterval(countdownTimer);
            countdownTimer = null;
            progress.style.display = "none";
            subtitle.textContent = "Pick a class — it will be remembered.";
        }

        function close() {
            stopCountdown();
            backdrop.remove();
            document.removeEventListener("keydown", onKey, true);
            pickerOpen = false;
            showClassPill();
        }

        function confirm() {
            settings.targetClass = chosen;
            settings.askEveryTime = askBox.checked;
            saveSettings(settings);
            close();
            updatePill(chosen);
            selectClass(chosen);
        }

        function onKey(e) {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                confirm();
            }
        }

        search.addEventListener("input", () => {
            stopCountdown();
            const matches = classes.filter(c => normalize(c).includes(normalize(search.value)));
            const exact = matches.find(c => normalize(c) === normalize(search.value));
            if (exact || matches.length === 1) chosen = exact || matches[0];
            render();
        });
        search.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                const typed = search.value.trim();
                if (typed && !classes.some(c => normalize(c) === normalize(typed))) chosen = typed;
                confirm();
            }
        });
        card.addEventListener("pointerdown", stopCountdown);
        askBox.addEventListener("change", stopCountdown);
        closeBtn.addEventListener("click", confirm);
        confirmBtn.addEventListener("click", confirm);
        backdrop.addEventListener("click", e => { if (e.target === backdrop) confirm(); });
        document.addEventListener("keydown", onKey, true);

        // Countdown: continue automatically with the remembered class unless the user interacts
        if (autoConfirm) {
            const total = AUTO_CONFIRM_SECONDS * 1000;
            const start = Date.now();
            const tick = () => {
                const left = Math.max(0, total - (Date.now() - start));
                progress.style.transform = `scaleX(${left / total})`;
                subtitle.textContent = `Continuing with ${chosen} in ${Math.ceil(left / 1000)}s…`;
                if (left <= 0) confirm();
            };
            countdownTimer = setInterval(tick, 100);
            tick();
        } else {
            progress.style.display = "none";
            subtitle.textContent = "Pick a class — it will be remembered.";
        }

        render();
        if (!autoConfirm) search.focus();

        // Replace the fallback list with the real class list from WebUntis
        fetchClasses().then(real => {
            if (!real || !pickerOpen) return;
            classes = sortClasses([...real, chosen]);
            render();
        });
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

    if (location.href.includes("timetablePublic")) {
        // Already on the timetable page: ask for the class / select it
        console.log("📍 Already on timetable page");
        stundenplanClicked = true;
        startClassFlow();
    } else if (location.href.includes(`school=${SCHOOL}`)) {
        // Already on the school page: go to Stundenplan
        console.log("📍 Already on school page, attempting to click Stundenplan...");
        setTimeout(tryClickStundenplan, 1500);
        setTimeout(tryClickStundenplan, 3000);
        setTimeout(tryClickStundenplan, 4500);
    } else if (!location.href.includes("school=")) {
        // On the main page: click the school link
        console.log("📍 On main page, attempting to click school link...");
        setTimeout(tryClickSchoolLink, 1000);
        setTimeout(tryClickSchoolLink, 2000);
        setTimeout(tryClickSchoolLink, 3000);
    }

    console.log("✨ Script initialized successfully");
})();
