// ==UserScript==
// @name            HWH Auto-Buyer
// @namespace       HWH.Addons
// @version         5.5.0
// @description     Advanced Auto-Buyer with Search, 3-Col Layout & Optimization
// @author          HWH Extension Architect
// @match           https://www.hero-wars.com/*
// @match           https://apps-1701433570146040.apps.fbsbx.com/*
// @grant           unsafeWindow
// @run-at          document-start
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        id: 'hwh_ultimate_autobuyer_pro',
        label: 'Auto-Buyer Pro',
        tooltip: 'Advanced Auto Buyer',
        color: 'red',
        anchorId: 'doOthers',
        minCurrencyThreshold: 8000,
        storagePrefix: 'hwh_buyer_pro_',
        globalSettingsKey: 'hwh_buyer_global_settings',
        minItemId: 90
    };

    const SHOPS_CONFIG = {
        1:  { name: "Town Shop",         currency: "gold",      type: "gear" },
        4:  { name: "Arena Shop",        currency: "coin",      type: "gear" },
        5:  { name: "Grand Arena Shop",  currency: "coin",      type: "gear" },
        6:  { name: "Tower Shop",        currency: "coin",      type: "gear" },
        8:  { name: "Soul Shop",         currency: "coin",      type: "gear" },
        9:  { name: "Friendship Shop",   currency: "coin",      type: "gear" },
        10: { name: "Outland Shop",      currency: "coin",      type: "gear", extraItems: [{id: 65, type: 'consumable'}] },
        17: { name: "Sanctuary Shop",    currency: "mixed",     type: "specific", whitelist: [85, 86] }
    };

    const WEB_PROFILES = {
        'WEB': 'https://raw.githubusercontent.com/HeroWarsTools/profiles/main/items.json',
        'W2':  'https://raw.githubusercontent.com/HeroWarsTools/profiles/main/items2.json',
        'W3':  'https://raw.githubusercontent.com/HeroWarsTools/profiles/main/items3.json'
    };

    let UI_STATE = {
        shopId: null,
        mode: 'buy',
        showHidden: false
    };

    const loader = setInterval(() => {
        if (typeof unsafeWindow.HWHClasses !== 'undefined' &&
            typeof unsafeWindow.HWHData !== 'undefined' &&
            typeof unsafeWindow.HWHFuncs !== 'undefined' &&
            typeof unsafeWindow.lib !== 'undefined') {
            clearInterval(loader);
            setTimeout(init, 1000);
        }
    }, 500);

    function init() {
        console.log('[HWH-AutoBuyer] Initialized v5.5.0');
        injectStyles();
        exposeAPI();
        injectButton();
        checkSchedules();
    }

    function checkSchedules() {
        const { getSaveVal } = unsafeWindow.HWHFuncs;
        const settings = getSaveVal(CONFIG.globalSettingsKey, { runOnStartup: false, checkHourly: false });

        if (settings.runOnStartup) {
            console.log('[HWH-AutoBuyer] Scheduled startup run in 19s');
            setTimeout(() => {
                runAutoBuy(true);
            }, 19000);
        }

        if (settings.checkHourly) {
            scheduleHourlyCheck();
        }
    }

    function scheduleHourlyCheck() {
        const now = new Date();
        let target = new Date(now);
        target.setMinutes(1);
        target.setSeconds(30);
        target.setMilliseconds(0);

        if (target <= now) {
            target.setHours(target.getHours() + 1);
        }

        const delay = target - now;
        console.log(`[HWH-AutoBuyer] Next hourly check in ${(delay/1000).toFixed(1)}s`);

        setTimeout(() => {
            runAutoBuy(true);
            setInterval(() => runAutoBuy(true), 3600000);
        }, delay);
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            /* 3-Column Grid Layout */
            .hwh-ab-grid .PopUp_checkboxes {
                display: grid !important;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 2px 8px;
                max-height: 60vh; /* Ensure scrolling works well with 3 cols */
            }
            .hwh-item-fav { color: #ffd700 !important; text-shadow: 0 0 2px orange; }
            .hwh-item-hidden { text-decoration: line-through; opacity: 0.6; }

            /* Header Layout */
            .hwh-header-wrapper {
                display: flex;
                gap: 10px;
                align-items: flex-start;
                margin-bottom: 10px;
            }
            .hwh-controls-left {
                flex: 0 0 65%;
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            .hwh-search-right {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }

            .hwh-toolbar-row {
                display: flex; justify-content: space-between; gap: 5px; width: 100%;
            }
            .hwh-toolbar-row .PopUp_btnGap { flex: 1; min-width: 0; }

            /* Search Input Styling */
            #hwh-search-input {
                width: 100%;
                padding: 8px;
                border-radius: 5px;
                border: 1px solid #5c4b3a;
                background-color: #1e1510;
                color: #fde5b6;
                font-size: 14px;
                outline: none;
                box-shadow: inset 0 0 5px rgba(0,0,0,0.5);
            }
            #hwh-search-input:focus {
                border-color: #ffd700;
                background-color: #2a1f18;
            }
        `;
        document.head.appendChild(style);
    }

    function exposeAPI() {
        unsafeWindow.HWH_AutoBuyer = {
            handleAction: async (action) => {
                const { popup, getSaveVal, setSaveVal } = unsafeWindow.HWHFuncs;
                const checkboxes = popup.getCheckBoxes();

                if (!UI_STATE.shopId) {
                    const globalSettings = getSaveVal(CONFIG.globalSettingsKey, {});
                    checkboxes.forEach(cb => {
                        globalSettings[cb.name] = cb.checked;
                    });
                    setSaveVal(CONFIG.globalSettingsKey, globalSettings);
                    return;
                }

                const storageKey = CONFIG.storagePrefix + UI_STATE.shopId;
                const data = getSaveVal(storageKey, {});

                checkboxes.forEach(cb => {
                    const id = cb.name;
                    if (!data[id]) data[id] = { buy: false, hidden: false, fav: false };

                    if (UI_STATE.mode === 'buy') data[id].buy = cb.checked;
                    if (UI_STATE.mode === 'hide') {
                        data[id].hidden = cb.checked;
                        if (cb.checked) data[id].buy = false;
                    }
                    if (UI_STATE.mode === 'fav') data[id].fav = cb.checked;
                });

                setSaveVal(storageKey, data);

                if (action === 'back') {
                    popup.hide();
                    setTimeout(showMainMenu, 100);
                } else if (action === 'apply' || action === 'close') {
                    if (action === 'apply') openShopConfig(UI_STATE.shopId);
                } else if (action === 'toggle_hidden') {
                    UI_STATE.showHidden = !UI_STATE.showHidden;
                    openShopConfig(UI_STATE.shopId);
                } else if (['buy', 'hide', 'fav'].includes(action)) {
                    UI_STATE.mode = action;
                    openShopConfig(UI_STATE.shopId);
                }
            }
        };
    }

    function injectButton() {
        if (!unsafeWindow.HWHData?.buttons) return;
        const buttonAction = {
            get name() { return CONFIG.label; },
            get title() { return CONFIG.tooltip; },
            color: CONFIG.color,
            onClick: () => showMainMenu()
        };
        const oldButtons = unsafeWindow.HWHData.buttons;
        const newButtons = {};
        let inserted = false;
        for (const [key, value] of Object.entries(oldButtons)) {
            newButtons[key] = value;
            if (key === CONFIG.anchorId) { newButtons[CONFIG.id] = buttonAction; inserted = true; }
        }
        if (!inserted) newButtons[CONFIG.id] = buttonAction;
        unsafeWindow.HWHData.buttons = newButtons;
    }

    function exportSettings() {
        const { getSaveVal } = unsafeWindow.HWHFuncs;
        const exportData = {};
        Object.keys(SHOPS_CONFIG).forEach(shopId => {
            const key = CONFIG.storagePrefix + shopId;
            exportData[shopId] = getSaveVal(key, {});
        });
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "hwh_autobuyer_profile.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importSettings(jsonData) {
        const { setSaveVal } = unsafeWindow.HWHFuncs;
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            let count = 0;
            Object.keys(data).forEach(shopId => {
                if (SHOPS_CONFIG[shopId]) {
                    setSaveVal(CONFIG.storagePrefix + shopId, data[shopId]);
                    count++;
                }
            });
            alert(`Import Successful! Loaded settings for ${count} shops.`);
        } catch (e) {
            alert('Import Failed: Invalid JSON format.');
            console.error(e);
        }
    }

    function triggerFileImport() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = event => importSettings(event.target.result);
            reader.readAsText(file);
        };
        input.click();
    }

    async function fetchWebProfile(key) {
        const url = WEB_PROFILES[key];
        if (!url) return;
        unsafeWindow.HWHFuncs.setProgress(`Downloading Profile ${key}...`);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            importSettings(json);
            unsafeWindow.HWHFuncs.setProgress('Profile Loaded!', true);
        } catch (e) {
            console.error(e);
            unsafeWindow.HWHFuncs.setProgress('Download Failed!', true);
            alert('Error downloading profile. Check console.');
        }
    }

    async function showMainMenu() {
        const { popup, getSaveVal } = unsafeWindow.HWHFuncs;

        const menuButtons = [
            { msg: '>>> RUN ALL / ЗАПУСТИТЬ <<<', result: 'run_all', color: 'green' }
        ];

        Object.keys(SHOPS_CONFIG).forEach(shopId => {
            menuButtons.push({
                msg: SHOPS_CONFIG[shopId].name,
                result: `conf_${shopId}`,
                color: 'blue'
            });
        });

        menuButtons.push({ msg: '💾 Export JSON', result: 'export', color: 'graphite' });
        menuButtons.push({ msg: '📂 Import JSON', result: 'import', color: 'graphite' });

        menuButtons.push({ msg: 'WEB (Profile 1)', result: 'web_1', color: 'orange' });
        menuButtons.push({ msg: 'W2 (Profile 2)', result: 'web_2', color: 'orange' });
        menuButtons.push({ msg: 'W3 (Profile 3)', result: 'web_3', color: 'orange' });

        menuButtons.push({ result: false, isClose: true });

        const globalSettings = getSaveVal(CONFIG.globalSettingsKey, { runOnStartup: false, checkHourly: false });
        const checkBoxes = [
            { name: 'runOnStartup', label: 'Run on startup (19s delay) / Запуск при старте', checked: globalSettings.runOnStartup },
            { name: 'checkHourly', label: 'Check every hour (xx:01:30) / Проверка каждый час', checked: globalSettings.checkHourly }
        ];

        const answer = await popup.confirm(
            '<h3 style="color:#fde5b6">Auto-Buyer Pro</h3>Select Shop or Action / Выберите магазин или действие:',
            menuButtons,
            checkBoxes
        );

        const newCheckboxes = popup.getCheckBoxes();
        if (newCheckboxes && newCheckboxes.length > 0) {
            const newSettings = {};
            newCheckboxes.forEach(cb => newSettings[cb.name] = cb.checked);
            unsafeWindow.HWHFuncs.setSaveVal(CONFIG.globalSettingsKey, newSettings);
        }

        if (answer === 'run_all') runAutoBuy();
        else if (answer === 'export') exportSettings();
        else if (answer === 'import') triggerFileImport();
        else if (answer === 'web_1') fetchWebProfile('WEB');
        else if (answer === 'web_2') fetchWebProfile('W2');
        else if (answer === 'web_3') fetchWebProfile('W3');
        else if (answer && answer.startsWith('conf_')) {
            UI_STATE.shopId = answer.split('_')[1];
            UI_STATE.mode = 'buy';
            UI_STATE.showHidden = false;
            openShopConfig(UI_STATE.shopId);
        }
    }

    function getNativeBtnHTML(label, color, action, isActive = false) {
        let finalColor = color;
        if (isActive) finalColor = 'yellow';
        return `
            <div class="PopUp_btnGap ${finalColor}" onclick="window.HWH_AutoBuyer.handleAction('${action}')">
                <div class="PopUp_btnPlate">${label}</div>
            </div>
        `;
    }

    async function openShopConfig(shopId) {
        const { popup, getSaveVal } = unsafeWindow.HWHFuncs;
        const { lib, cheats } = unsafeWindow;
        const shopDef = SHOPS_CONFIG[shopId];
        const storageKey = CONFIG.storagePrefix + shopId;
        const savedData = getSaveVal(storageKey, {});

        // NEW LAYOUT: Left Controls + Right Search
        const htmlContent = `
            <div class="hwh-header-wrapper">
                <div class="hwh-controls-left">
                    <div class="hwh-toolbar-row">
                        ${getNativeBtnHTML('⬅ Back', 'red', 'back')}
                        ${getNativeBtnHTML(UI_STATE.showHidden ? '👁️ Hide' : '👁️ Show', 'blue', 'toggle_hidden')}
                        ${getNativeBtnHTML('💾 Apply', 'green', 'apply')}
                    </div>
                    <div class="hwh-toolbar-row">
                        ${getNativeBtnHTML('🛒 BUY', 'graphite', 'buy', UI_STATE.mode === 'buy')}
                        ${getNativeBtnHTML('🚫 HIDE', 'graphite', 'hide', UI_STATE.mode === 'hide')}
                        ${getNativeBtnHTML('⭐ FAV', 'graphite', 'fav', UI_STATE.mode === 'fav')}
                    </div>
                </div>
                <div class="hwh-search-right">
                    <input type="text" id="hwh-search-input" placeholder="🔍 Search item..." autocomplete="off">
                    <div style="text-align:center; font-size:10px; color:#aaa; margin-top:3px">
                        Mode: <span style="color:#fff">${UI_STATE.mode.toUpperCase()}</span>
                    </div>
                </div>
            </div>
        `;

        let itemsToDisplay = [];

        const addItem = (id, type, forceName = null) => {
            const itemKey = `${type}_${id}`;
            const settings = savedData[itemKey] || { buy: false, hidden: false, fav: false };

            if (settings.hidden && !UI_STATE.showHidden && UI_STATE.mode === 'buy') return;

            let name = forceName;
            if (!name) {
                let libType = type.replace('fragment', '').toUpperCase();
                if (type === 'scroll') libType = 'SCROLL';
                try {
                    const nameKey = `LIB_${libType}_NAME_${id}`;
                    name = cheats.translate(nameKey);
                } catch(e) { name = null; }
            }
            if (!name || name.includes('LIB_')) name = `Item ${id} (${type})`;

            let label = name;
            if (settings.fav) label = `<span class="hwh-item-fav">⭐ ${label}</span>`;
            if (settings.hidden) label = `<span class="hwh-item-hidden">🚫 ${label}</span>`;

            let isChecked = false;
            if (UI_STATE.mode === 'buy') isChecked = settings.buy;
            if (UI_STATE.mode === 'hide') isChecked = settings.hidden;
            if (UI_STATE.mode === 'fav') isChecked = settings.fav;

            itemsToDisplay.push({
                name: itemKey,
                label: label,
                checked: isChecked,
                _sortName: name,
                _isFav: settings.fav
            });
        };

        if (shopDef.type === 'specific' && shopDef.whitelist) {
            shopDef.whitelist.forEach(id => addItem(id, 'consumable'));
        } else {
            const processType = (type) => {
                const db = lib.data.inventoryItem[type];
                if (!db) return;

                const isGearType = ['gear', 'fragmentGear', 'scroll', 'fragmentScroll'].includes(type);

                Object.values(db).forEach(item => {
                    if (isGearType && item.id < CONFIG.minItemId) return;
                    addItem(item.id, type);
                });
            };

            processType('gear');
            processType('fragmentGear');
            processType('scroll');
            processType('fragmentScroll');
        }

        if (shopDef.extraItems) {
            shopDef.extraItems.forEach(extra => addItem(extra.id, extra.type));
        }

        itemsToDisplay.sort((a, b) => {
            if (a._isFav && !b._isFav) return -1;
            if (!a._isFav && b._isFav) return 1;
            return a._sortName.localeCompare(b._sortName);
        });

        const popupPromise = popup.confirm(htmlContent, [{ result: false, isClose: true }], itemsToDisplay);

        // Post-Render Logic: Add Grid Class and Search Listener
        setTimeout(() => {
            const popupEl = document.querySelector('.PopUp_');
            if (popupEl) popupEl.classList.add('hwh-ab-grid');

            const searchInput = document.getElementById('hwh-search-input');
            if (searchInput) {
                searchInput.focus();
                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    const labels = document.querySelectorAll('.PopUp_checkboxes label');
                    labels.forEach(lbl => {
                        const text = lbl.textContent.toLowerCase();
                        // Toggle visibility based on search term
                        lbl.style.display = text.includes(term) ? 'flex' : 'none';
                    });
                });
            }
        }, 100);

        const answer = await popupPromise;
        if (answer === false) {
            unsafeWindow.HWH_AutoBuyer.handleAction('close');
        }
    }

    async function runAutoBuy(silent = false) {
        const { Caller, HWHFuncs, cheats } = unsafeWindow;
        const { getSaveVal } = HWHFuncs;

        if (!silent) HWHFuncs.setProgress('Auto-Buyer: Scanning Shops... / Сканирование...');

        try {
            const caller = new Caller();
            caller.add(['shopGetAll', 'inventoryGet', 'userGetInfo']);
            await caller.send();

            const shops = caller.result('shopGetAll');
            const inventory = caller.result('inventoryGet');
            const userInfo = caller.result('userGetInfo');
            const buyCalls = [];
            const log = [];

            Object.keys(SHOPS_CONFIG).forEach(shopId => {
                const shopData = shops[shopId];
                if (!shopData || !shopData.slots) return;

                const savedData = getSaveVal(CONFIG.storagePrefix + shopId, {});

                Object.values(shopData.slots).forEach(slot => {
                    if (slot.bought || !slot.reward) return;

                    const rType = Object.keys(slot.reward)[0];
                    const rId = Object.keys(slot.reward[rType])[0];
                    const normalizedType = rType.replace('fragment', '').toLowerCase();
                    const itemKey = `${normalizedType}_${rId}`;

                    const settings = savedData[itemKey];

                    if (settings && settings.buy && !settings.hidden) {
                        const costType = Object.keys(slot.cost)[0];
                        if (costType === 'starmoney') return;

                        let balance = 0, cost = 0, coinId = null;

                        if (costType === 'gold') {
                            balance = userInfo.gold;
                            cost = slot.cost.gold;
                        } else if (costType === 'coin') {
                            coinId = Object.keys(slot.cost.coin)[0];
                            balance = inventory.coin[coinId] || 0;
                            cost = slot.cost.coin[coinId];
                        }

                        if (balance >= (cost + CONFIG.minCurrencyThreshold)) {
                            buyCalls.push({
                                name: 'shopBuy',
                                args: { shopId: +shopId, slot: slot.id, cost: slot.cost, reward: slot.reward }
                            });

                            let libType = normalizedType.toUpperCase();
                            const itemName = cheats.translate(`LIB_${libType}_NAME_${rId}`) || itemKey;
                            log.push(`[${SHOPS_CONFIG[shopId].name}] Bought: ${itemName}`);

                            if (costType === 'gold') userInfo.gold -= cost;
                            else if (coinId) inventory.coin[coinId] -= cost;
                        }
                    }
                });
            });

            if (buyCalls.length > 0) {
                if (!silent) HWHFuncs.setProgress(`Auto-Buyer: Buying ${buyCalls.length} items...`, false);
                await Caller.send(buyCalls);
                if (!silent) HWHFuncs.setProgress(`Success: ${buyCalls.length} items bought!`, true);
                console.log('[HWH-AutoBuyer] Purchase Log:', log);
            } else {
                if (!silent) HWHFuncs.setProgress('Auto-Buyer: Nothing to buy / Нет покупок', true);
            }

        } catch (e) {
            console.error('[HWH-AutoBuyer] Error:', e);
            if (!silent) HWHFuncs.setProgress('Auto-Buyer: Error! Check Console', true);
        }
    }
})();