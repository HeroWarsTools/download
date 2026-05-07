// ==UserScript==
// @name         Dungeon Starter & Reload
// @namespace    HWH.Addons.TabManager
// @version      2.5.1 (Robust API Update)
// @description  Unified automation: Tab Reload & Dungeon Starter with native HWH UI/Notifications.
// @author       HWH Extension Architect & Gemini
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        unsafeWindow
// @grant        GM_openInTab
// @grant        window.close
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration & State ---
    const SETTINGS_KEY = 'HWH_TabManager_Settings_v3';
    let autoRunTimerId = null;
    let autoSaveTimerId = null;
    let originalSyncButtonConfig = null;

    // Dungeon State
    let dungeonStartTime = null;
    let isDungeonRunning = false;

    // --- Lifecycle ---
    const loader = setInterval(() => {
        if (typeof unsafeWindow.HWHClasses !== 'undefined' && typeof unsafeWindow.HWHData !== 'undefined' && typeof unsafeWindow.HWHFuncs !== 'undefined') {
            clearInterval(loader);
            setTimeout(init, 3000);
        }
    }, 500);

    function init() {
        console.log('%c[HWH Manager v2.5.1] Init.', 'color: #FFA500; font-weight: bold;');

        unsafeWindow.HWH_TabManager_TriggerSave = triggerAutoSave;

        injectOthersButton();
        applySettingsOnLoad();
        startMainLoop();
    }

    function injectOthersButton() {
        const { HWHData } = unsafeWindow;
        if (!HWHData?.othersPopupButtons) return;

        HWHData.othersPopupButtons.push({
            msg: 'Tab & Dungeon Manager',
            title: 'Open Manager Settings / Открыть настройки',
            result: openSettingsPopup,
            color: 'blue',
        });
    }

    function applySettingsOnLoad() {
        const settings = getSettings();
        manageCombinedButton(settings.showReloadButton);
        // Only start timer on load if enabled in settings
        if (settings.dungeonTimerEnabled) {
            resetDungeonTimer(settings.dungeonDelaySeconds);
        }
    }

    // ====================================================================================================
    //                                      UI & POPUP
    // ====================================================================================================

    function triggerAutoSave() {
        const statusDiv = document.getElementById('hwh_tm_save_status');
        if (statusDiv) statusDiv.innerHTML = '<span style="color: #ffff00;">Saving...</span>';

        if (autoSaveTimerId) clearTimeout(autoSaveTimerId);

        autoSaveTimerId = setTimeout(() => {
            handleSave();
            if (statusDiv) statusDiv.innerHTML = '<span style="color: #00ff00;">Saved!</span>';
        }, 1000);
    }

    async function openSettingsPopup() {
        const { popup } = unsafeWindow.HWHFuncs;
        const settings = getSettings();

        const style = `
            <style>
                .hwh-tm-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
                .hwh-tm-group { border: 1px solid #ce976755; padding: 8px; border-radius: 5px; margin-bottom: 10px; background: #170d07aa; }
                .hwh-tm-title { color: #fde5b6; margin: 0 0 5px 0; font-size: 14px; text-align: center; text-transform: uppercase; }
                .hwh-tm-input { width: 50px; text-align: center; background: #170d07; color: #fce1ac; border: 1px solid #cf9250; font-size: 15px; font-weight: bold; }
                .hwh-tm-label { color: #fce1ac; font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
                .hwh-tm-status { font-size: 12px; font-weight: bold; text-align: right; min-width: 60px; }
            </style>
        `;

        const contentHTML = `
            ${style}
            <div style="display: flex; flex-direction: column; min-width: 420px; text-align: left;">

                <!-- RELOAD SECTION -->
                <div class="hwh-tm-group">
                    <h4 class="hwh-tm-title">Auto Reload (Tab Cycle)</h4>

                    <div class="hwh-tm-row">
                        <label class="hwh-tm-label">
                            <input type="checkbox" id="hwh_tm_timer_enabled" onchange="HWH_TabManager_TriggerSave()" ${settings.timerEnabled ? 'checked' : ''}>
                            Enable / Включить
                        </label>
                        <div id="hwh_tm_reload_status" class="hwh-tm-status">--:--</div>
                    </div>

                    <div class="hwh-tm-row">
                        <span class="hwh-tm-label">Offset (min):</span>
                        <input type="number" id="hwh_tm_offset" oninput="HWH_TabManager_TriggerSave()" value="${settings.timerOffset}" min="-25" max="25" class="hwh-tm-input">
                    </div>

                    <div class="hwh-tm-row" style="justify-content: flex-start; gap: 15px;">
                        <label class="hwh-tm-label"><input type="checkbox" id="hwh_tm_reload_02" onchange="HWH_TabManager_TriggerSave()" ${settings.enableReload02 ? 'checked' : ''}> at xx:02</label>
                        <label class="hwh-tm-label"><input type="checkbox" id="hwh_tm_reload_32" onchange="HWH_TabManager_TriggerSave()" ${settings.enableReload32 ? 'checked' : ''}> at xx:32</label>
                    </div>

                    <div class="hwh-tm-row" style="margin-top: 5px; border-top: 1px solid #444; padding-top: 5px;">
                        <label class="hwh-tm-label">
                            <input type="checkbox" id="hwh_tm_show_reload_btn" onchange="HWH_TabManager_TriggerSave()" ${settings.showReloadButton ? 'checked' : ''}>
                            Show 'Reload' button in Menu
                        </label>
                    </div>
                </div>

                <!-- DUNGEON SECTION -->
                <div class="hwh-tm-group">
                    <h4 class="hwh-tm-title">Dungeon Auto-Start</h4>

                    <div class="hwh-tm-row">
                        <label class="hwh-tm-label">
                            <input type="checkbox" id="hwh_tm_dungeon_enabled" onchange="HWH_TabManager_TriggerSave()" ${settings.dungeonTimerEnabled ? 'checked' : ''}>
                            Enable / Включить
                        </label>
                        <div id="hwh_tm_dungeon_status" class="hwh-tm-status">--:--</div>
                    </div>

                    <div class="hwh-tm-row">
                        <span class="hwh-tm-label">Start in (seconds):</span>
                        <!-- Added step="5" for incrementing by 5 -->
                        <input type="number" id="hwh_tm_dungeon_sec" oninput="HWH_TabManager_TriggerSave()" value="${settings.dungeonDelaySeconds}" min="5" max="3600" step="5" class="hwh-tm-input">
                    </div>
                </div>

                <div style="text-align: center; font-size: 11px; color: #888; margin-top: -5px;" id="hwh_tm_save_status"></div>
            </div>
        `;

        const popupButtons = [
            {
                msg: 'RELOAD',
                color: 'blue',
                result: () => {
                    unsafeWindow.HWHFuncs.setProgress('Reloading Tab...', false);
                    runOpenCloseLogic();
                }
            },
            {
                msg: 'DUNGEON',
                color: 'green',
                result: () => {
                    // Manual trigger: Disable timer immediately to prevent double run
                    disableDungeonTimer();
                    runDungeonLogic();
                }
            },
            {
                msg: 'EXIT',
                result: false,
                isClose: true,
                color: 'red'
            }
        ];

        const answer = await popup.confirm(contentHTML, popupButtons);
        if (typeof answer === 'function') {
            answer();
        }
        updateUI();
    }

    function handleSave() {
        const reloadBtn = document.getElementById('hwh_tm_show_reload_btn');
        if (!reloadBtn) return;

        const oldSettings = getSettings();
        const newSettings = {
            showReloadButton: reloadBtn.checked,
            timerEnabled: document.getElementById('hwh_tm_timer_enabled').checked,
            timerOffset: parseInt(document.getElementById('hwh_tm_offset').value) || 0,
            enableReload02: document.getElementById('hwh_tm_reload_02').checked,
            enableReload32: document.getElementById('hwh_tm_reload_32').checked,

            dungeonTimerEnabled: document.getElementById('hwh_tm_dungeon_enabled').checked,
            dungeonDelaySeconds: parseInt(document.getElementById('hwh_tm_dungeon_sec').value) || 20
        };
        saveSettings(newSettings);

        manageCombinedButton(newSettings.showReloadButton);

        // Logic: Only reset timer if enabled state changed or time value changed.
        // Opening the popup does NOT trigger this unless user interacts.
        if (newSettings.dungeonTimerEnabled && !oldSettings.dungeonTimerEnabled) {
            resetDungeonTimer(newSettings.dungeonDelaySeconds);
        } else if (!newSettings.dungeonTimerEnabled) {
            dungeonStartTime = null;
        } else if (newSettings.dungeonDelaySeconds !== oldSettings.dungeonDelaySeconds) {
            // If user changes seconds, we assume they want to restart the countdown
            resetDungeonTimer(newSettings.dungeonDelaySeconds);
        }

        updateUI();
    }

    // ====================================================================================================
    //                                      LOGIC: RELOAD & DUNGEON
    // ====================================================================================================

    function runOpenCloseLogic() {
        GM_openInTab("https://www.hero-wars.com/", { active: true, insert: true, setParent: true });
        setTimeout(() => window.close(), 2500);
    }

    function runDungeonLogic() {
        if (isDungeonRunning) return;
        isDungeonRunning = true;

        const { setProgress } = unsafeWindow.HWHFuncs;
        
        // --- 1. ROBUST API APPROACH (UpBestDungeon / HWH) ---
        if (unsafeWindow.HWHClasses?.executeDungeon) {
            setProgress('Auto-Dungeon: Starting (API)...', false);
            try {
                const dung = new unsafeWindow.HWHClasses.executeDungeon(
                    () => { 
                        isDungeonRunning = false; 
                        setProgress('Auto-Dungeon: Finished!', true); 
                    },
                    (err) => { 
                        isDungeonRunning = false; 
                        setProgress('Auto-Dungeon: Error!', true); 
                        console.error('[HWH Manager] API Dungeon Error:', err);
                    }
                );
                
                // Some versions of HWH need titanit count passed to start()
                const titanit = unsafeWindow.HWHFuncs.getInput?.('countTitanit') || 150;
                dung.start(titanit);
                return; // Logic started, skip button search
            } catch (e) {
                console.error('[HWH Manager] API call failed, falling back to buttons:', e);
            }
        }

        // --- 2. FALLBACK: BUTTON CLICKING APPROACH ---
        setProgress('Auto-Dungeon: Searching button...', false);

        // Find the "Dungeon" button by searching for various known labels
        const menuBtns = document.querySelectorAll('.scriptMenu_btnPlate');
        const dungeonBtn = Array.from(menuBtns).find(el => {
            const txt = el.textContent.trim().toLowerCase();
            const title = el.parentElement?.title?.toLowerCase() || '';
            // Match 'dungeon', 'dgn' (UpBestDungeon renaming), or Russian labels
            return txt === 'dungeon' || txt === 'dgn' || txt === 'подземелье' || title.includes('dungeon');
        });

        if (dungeonBtn) {
            console.log('%c[HWH Manager] Clicking "Dgn" button...', 'color: #00ffff; font-weight: bold;');
            dungeonBtn.click();

            // Wait 1 second for the HWH Confirmation Popup to appear
            setTimeout(() => {
                const popBtns = document.querySelectorAll('.PopUp_btnPlate');
                const runBtn = Array.from(popBtns).find(el => {
                    const txt = el.textContent.trim().toLowerCase();
                    return txt === 'run' || txt === 'auto' || txt === 'запускай' || txt === 'запускай!';
                });

                if (runBtn) {
                    console.log('%c[HWH Manager] Clicking "Run" button in popup...', 'color: #00ffff; font-weight: bold;');
                    runBtn.click();
                    setProgress('Auto-Dungeon: Executed via Click!', true);
                    console.log('%c[HWH Manager] Dungeon started successfully via Click (Dgn/Run).', 'color: #00ff00; font-weight: bold;');
                } else {
                    setProgress('Auto-Dungeon: Popup button not found!', true);
                    console.warn('[HWH Manager] Popup button ("Run") not found after clicking "Dgn".');
                }
                isDungeonRunning = false;
            }, 1000);
        } else {
            setProgress('Auto-Dungeon: Button not found!', true);
            console.warn('[HWH Manager] Dungeon button ("Dgn") not found in menu.');
            isDungeonRunning = false;
        }
    }

    function manageCombinedButton(shouldInject) {
        const { HWHData } = unsafeWindow;
        if (!HWHData?.buttons) return;
        const KEY = 'newDay';

        if (!originalSyncButtonConfig && HWHData.buttons[KEY]) {
            originalSyncButtonConfig = { ...HWHData.buttons[KEY] };
        }

        if (shouldInject && (!HWHData.buttons[KEY] || !HWHData.buttons[KEY].isCombine)) {
            if (!originalSyncButtonConfig) return;
            HWHData.buttons[KEY] = {
                isCombine: true,
                combineList: [
                    originalSyncButtonConfig,
                    { name: 'Reload', title: 'Reload Tab', onClick: runOpenCloseLogic }
                ]
            };
        } else if (!shouldInject && HWHData.buttons[KEY] && HWHData.buttons[KEY].isCombine) {
            HWHData.buttons[KEY] = originalSyncButtonConfig;
        }
    }

    // ====================================================================================================
    //                                      TIMERS & LOOP
    // ====================================================================================================

    function startMainLoop() {
        if (autoRunTimerId) clearInterval(autoRunTimerId);
        autoRunTimerId = setInterval(updateTimers, 1000);
    }

    function resetDungeonTimer(seconds) {
        dungeonStartTime = Date.now() + (seconds * 1000);
    }

    function disableDungeonTimer() {
        dungeonStartTime = null;
    }

    function updateTimers() {
        const settings = getSettings();
        const now = Date.now();
        let bannerText = "";

        // --- 1. Reload Timer ---
        let reloadStr = "Disabled";
        if (settings.timerEnabled) {
            const nextReload = getNextReloadTime(now, settings);
            if (nextReload) {
                const diff = Math.floor((nextReload.getTime() - now) / 1000);
                if (diff <= 0 && diff > -5) {
                    runOpenCloseLogic();
                }
                const m = Math.floor(diff / 60).toString().padStart(2, '0');
                const s = (diff % 60).toString().padStart(2, '0');
                reloadStr = `${m}:${s}`;

                if (diff < 180 && diff > 0) bannerText = `Reload in ${reloadStr}`;
            }
        }

        // --- 2. Dungeon Timer ---
        let dungeonStr = "Disabled";
        if (settings.dungeonTimerEnabled && dungeonStartTime) {
            const diff = Math.floor((dungeonStartTime - now) / 1000);
            if (diff <= 0) {
                dungeonStr = "Running...";
                disableDungeonTimer(); // Run once then disable
                runDungeonLogic();
            } else {
                dungeonStr = `${diff}s`;
                if (diff < 20) bannerText = `Dungeon in ${dungeonStr}`;
            }
        } else if (settings.dungeonTimerEnabled && !dungeonStartTime) {
            dungeonStr = "Waiting...";
        }

        updateUI(reloadStr, dungeonStr);

        if (bannerText) {
            unsafeWindow.HWHFuncs.setProgress(bannerText, false);
        }
    }

    function updateUI(reloadText, dungeonText) {
        const reloadDiv = document.getElementById('hwh_tm_reload_status');
        const dungeonDiv = document.getElementById('hwh_tm_dungeon_status');

        if (reloadDiv && reloadText) {
            reloadDiv.textContent = reloadText;
            reloadDiv.style.color = reloadText === "Disabled" ? "#ff7373" : "#73ff73";
        }
        if (dungeonDiv && dungeonText) {
            dungeonDiv.textContent = dungeonText;
            dungeonDiv.style.color = dungeonText === "Disabled" ? "#ff7373" : "#73ff73";
        }
    }

    function getNextReloadTime(now, settings) {
        let offset = settings.timerOffset || 0;
        let t1 = (2 + offset + 60) % 60;
        let t2 = (32 + offset + 60) % 60;

        const candidates = [];
        if (settings.enableReload02) candidates.push(t1);
        if (settings.enableReload32) candidates.push(t2);
        candidates.sort((a, b) => a - b);
        if (!candidates.length) return null;

        let next = new Date(now);
        next.setSeconds(0); next.setMilliseconds(0);

        let found = false;
        for (const min of candidates) {
            next.setMinutes(min);
            if (next.getTime() > now) { found = true; break; }
        }
        if (!found) {
            next.setHours(next.getHours() + 1);
            next.setMinutes(candidates[0]);
        }
        return next;
    }

    // ====================================================================================================
    //                                      STORAGE
    // ====================================================================================================

    function getSettings() {
        const defaults = {
            showReloadButton: false,
            timerEnabled: false,
            timerOffset: 0,
            enableReload02: true,
            enableReload32: true,
            dungeonTimerEnabled: false,
            dungeonDelaySeconds: 20
        };
        try {
            const saved = localStorage.getItem(SETTINGS_KEY);
            return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        } catch (e) { return defaults; }
    }

    function saveSettings(settings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

})();
