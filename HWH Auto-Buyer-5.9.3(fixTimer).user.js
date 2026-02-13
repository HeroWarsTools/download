// ==UserScript==
// @name            HWH Auto-Buyer
// @namespace       HWH.Addons
// @version         5.9.3
// @description     Advanced Auto-Buyer with I18N support and fixed schedulers.
// @description:ru  Продвинутый авто-покупщик с поддержкой I18N и исправленными планировщиками.
// @author          HWH Extension Architect
// @match           https://www.hero-wars.com/*
// @match           https://apps-1701433570146040.apps.fbsbx.com/*
// @grant           unsafeWindow
// @run-at          document-start
// ==/UserScript==

(function() {
    'use strict';

    let startupTimerId = null;
    let initialHourlyTimeoutId = null;
    let recurringHourlyIntervalId = null;

    const CONFIG = {
        id: 'hwh_ultimate_autobuyer_pro',
        color: 'red',
        anchorId: 'doOthers',
        defaultThreshold: 8000,
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

    // @AI-NOTE: Updated loader to wait for user info, ensuring storage is ready.
    const loader = setInterval(() => {
        if (typeof unsafeWindow.HWHClasses !== 'undefined' &&
            typeof unsafeWindow.HWHData !== 'undefined' &&
            typeof unsafeWindow.HWHFuncs !== 'undefined' &&
            typeof unsafeWindow.HWHFuncs.getUserInfo === 'function' &&
            unsafeWindow.HWHFuncs.getUserInfo() // This ensures user data is loaded, which initializes storage.
           ) {
            clearInterval(loader);
            setTimeout(init, 1000); // A small delay just in case for other scripts to settle.
        }
    }, 500);

    function init() {
        const { HWHData, HWHFuncs } = unsafeWindow;

        const i18nLangDataEn = {
            AB_PRO_BTN_LABEL: 'Auto-Buyer Pro',
            AB_PRO_BTN_TOOLTIP: 'Advanced Auto Buyer',
            AB_PRO_MAIN_TITLE: '<h3 style="color:#fde5b6">Auto-Buyer Pro</h3>Select Shop or Action',
            AB_PRO_RUN_ALL: '>>> RUN ALL <<<',
            AB_PRO_EXPORT_FULL: '💾 Export FULL JSON',
            AB_PRO_IMPORT_FULL: '📂 Import FULL JSON',
            AB_PRO_WEB_1: 'WEB (Profile 1)',
            AB_PRO_WEB_2: 'W2 (Profile 2)',
            AB_PRO_WEB_3: 'W3 (Profile 3)',
            AB_PRO_RUN_ON_STARTUP: 'Run on startup (19s delay)',
            AB_PRO_CHECK_HOURLY: 'Check every hour (xx:01:30)',
            AB_PRO_BTN_BACK: '⬅ Back',
            AB_PRO_BTN_HIDE_ITEMS: '👁️ Hide',
            AB_PRO_BTN_SHOW_ITEMS: '👁️ Show',
            AB_PRO_BTN_APPLY: '💾 Apply',
            AB_PRO_MODE_BUY: '🛒 BUY',
            AB_PRO_MODE_HIDE: '🚫 HIDE',
            AB_PRO_MODE_FAV: '⭐ FAV',
            AB_PRO_LBL_MIN_RESERVE: 'Min Reserve:',
            AB_PRO_LBL_SEARCH: 'Search:',
            AB_PRO_PH_SEARCH: '🔍 Item...',
            AB_PRO_BTN_IMPORT: '📥 Import',
            AB_PRO_BTN_EXPORT: '📤 Export',
            AB_PRO_LBL_MODE: 'Mode:',
            AB_PRO_ALERT_IMPORT_SUCCESS: 'Shop Settings Imported! Reloading view...',
            AB_PRO_ALERT_INVALID_JSON: 'Invalid JSON',
            AB_PRO_ALERT_FULL_IMPORT_SUCCESS: 'Import Successful! Loaded settings for {count} shops.',
            AB_PRO_ALERT_FULL_IMPORT_FAIL: 'Import Failed: Invalid JSON format.',
            AB_PRO_PROG_SCANNING: 'Auto-Buyer: Scanning Shops...',
            AB_PRO_PROG_BUYING: 'Auto-Buyer: Buying {count} items...',
            AB_PRO_PROG_SUCCESS: 'Success: {count} items bought!',
            AB_PRO_PROG_NOTHING: 'Auto-Buyer: Nothing to buy',
            AB_PRO_PROG_ERROR: 'Auto-Buyer: Error! Check Console',
            AB_PRO_PROG_DOWNLOAD: 'Downloading Profile {key}...',
            AB_PRO_PROG_LOADED: 'Profile Loaded!',
            AB_PRO_PROG_DOWNLOAD_FAIL: 'Download Failed!',
        };

        const i18nLangDataRu = {
            AB_PRO_BTN_LABEL: 'Авто-покупщик Pro',
            AB_PRO_BTN_TOOLTIP: 'Расширенный авто-покупщик',
            AB_PRO_MAIN_TITLE: '<h3 style="color:#fde5b6">Авто-покупщик Pro</h3>Выберите магазин или действие',
            AB_PRO_RUN_ALL: '>>> ЗАПУСТИТЬ <<<',
            AB_PRO_EXPORT_FULL: '💾 Экспорт FULL JSON',
            AB_PRO_IMPORT_FULL: '📂 Импорт FULL JSON',
            AB_PRO_WEB_1: 'WEB (Профиль 1)',
            AB_PRO_WEB_2: 'W2 (Профиль 2)',
            AB_PRO_WEB_3: 'W3 (Профиль 3)',
            AB_PRO_RUN_ON_STARTUP: 'Запуск при старте (задержка 19с)',
            AB_PRO_CHECK_HOURLY: 'Проверка каждый час (xx:01:30)',
            AB_PRO_BTN_BACK: '⬅ Назад',
            AB_PRO_BTN_HIDE_ITEMS: '👁️ Скрыть',
            AB_PRO_BTN_SHOW_ITEMS: '👁️ Показать',
            AB_PRO_BTN_APPLY: '💾 Применить',
            AB_PRO_MODE_BUY: '🛒 ПОКУПКА',
            AB_PRO_MODE_HIDE: '🚫 СКРЫТИЕ',
            AB_PRO_MODE_FAV: '⭐ ИЗБРАННОЕ',
            AB_PRO_LBL_MIN_RESERVE: 'Мин. резерв:',
            AB_PRO_LBL_SEARCH: 'Поиск:',
            AB_PRO_PH_SEARCH: '🔍 Предмет...',
            AB_PRO_BTN_IMPORT: '📥 Импорт',
            AB_PRO_BTN_EXPORT: '📤 Экспорт',
            AB_PRO_LBL_MODE: 'Режим:',
            AB_PRO_ALERT_IMPORT_SUCCESS: 'Настройки магазина импортированы! Обновление...',
            AB_PRO_ALERT_INVALID_JSON: 'Неверный формат JSON',
            AB_PRO_ALERT_FULL_IMPORT_SUCCESS: 'Импорт успешен! Загружены настройки для {count} магазинов.',
            AB_PRO_ALERT_FULL_IMPORT_FAIL: 'Ошибка импорта: Неверный формат JSON.',
            AB_PRO_PROG_SCANNING: 'Авто-покупщик: Сканирование магазинов...',
            AB_PRO_PROG_BUYING: 'Авто-покупщик: Покупка {count} предметов...',
            AB_PRO_PROG_SUCCESS: 'Успешно: куплено {count} предметов!',
            AB_PRO_PROG_NOTHING: 'Авто-покупщик: Нечего покупать',
            AB_PRO_PROG_ERROR: 'Авто-покупщик: Ошибка! Проверьте консоль',
            AB_PRO_PROG_DOWNLOAD: 'Загрузка профиля {key}...',
            AB_PRO_PROG_LOADED: 'Профиль загружен!',
            AB_PRO_PROG_DOWNLOAD_FAIL: 'Ошибка загрузки!',
        };

        Object.assign(HWHData.i18nLangData['en'], i18nLangDataEn);
        Object.assign(HWHData.i18nLangData['ru'], i18nLangDataRu);

        console.log('[HWH-AutoBuyer] Initialized v5.9.3');
        injectStyles();
        exposeAPI();
        injectButton();
        setTimeout(rescheduleTimers, 2000);
    }

    function clearAllSchedules() {
        if (startupTimerId) { clearTimeout(startupTimerId); startupTimerId = null; }
        if (initialHourlyTimeoutId) { clearTimeout(initialHourlyTimeoutId); initialHourlyTimeoutId = null; }
        if (recurringHourlyIntervalId) { clearInterval(recurringHourlyIntervalId); recurringHourlyIntervalId = null; }
        console.log('[HWH-AutoBuyer] All schedules cleared.');
    }

    function rescheduleTimers() {
        clearAllSchedules();
        const { getSaveVal } = unsafeWindow.HWHFuncs;
        const settings = getSaveVal(CONFIG.globalSettingsKey, { runOnStartup: false, checkHourly: false });

        if (settings.runOnStartup) {
            console.log('[HWH-AutoBuyer] Scheduling: Run on Startup is ENABLED.');
            startupTimerId = setTimeout(() => {
                console.log('[HWH-AutoBuyer] Triggering Startup Run via API...');
                if (unsafeWindow.HWH_AutoBuyer && unsafeWindow.HWH_AutoBuyer.run) {
                    unsafeWindow.HWH_AutoBuyer.run();
                }
            }, 19000);
        } else {
            console.log('[HWH-AutoBuyer] Scheduling: Run on Startup is DISABLED.');
        }

        if (settings.checkHourly) {
            console.log('[HWH-AutoBuyer] Scheduling: Hourly Check is ENABLED.');
            scheduleHourlyCheck();
        } else {
            console.log('[HWH-AutoBuyer] Scheduling: Hourly Check is DISABLED.');
        }
    }

    function scheduleHourlyCheck() {
        const now = new Date();
        let target = new Date(now);
        target.setMinutes(1);
        target.setSeconds(30);
        target.setMilliseconds(0);
        if (target <= now) { target.setHours(target.getHours() + 1); }
        const delay = target - now;
        console.log(`[HWH-AutoBuyer] Hourly Scheduler: Next run in ${(delay/1000).toFixed(1)}s at ${target.toLocaleTimeString()}`);

        initialHourlyTimeoutId = setTimeout(() => {
            console.log('[HWH-AutoBuyer] Triggering Hourly Run via API...');
            if (unsafeWindow.HWH_AutoBuyer && unsafeWindow.HWH_AutoBuyer.run) {
                unsafeWindow.HWH_AutoBuyer.run();
            }
            recurringHourlyIntervalId = setInterval(() => {
                console.log('[HWH-AutoBuyer] Triggering Hourly Run via API...');
                if (unsafeWindow.HWH_AutoBuyer && unsafeWindow.HWH_AutoBuyer.run) {
                    unsafeWindow.HWH_AutoBuyer.run();
                }
            }, 3600000);
        }, delay);
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            .hwh-ab-grid .PopUp_checkboxes { display: grid !important; grid-template-columns: 1fr 1fr 1fr; gap: 2px 8px; max-height: 60vh; }
            .hwh-item-fav { color: #ffd700 !important; text-shadow: 0 0 2px orange; }
            .hwh-item-hidden { text-decoration: line-through; opacity: 0.6; }
            .hwh-header-wrapper { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
            .hwh-controls-left { flex: 0 0 60%; display: flex; flex-direction: column; gap: 5px; }
            .hwh-search-right { flex: 1; display: flex; flex-direction: column; gap: 5px; }
            .hwh-shop-title { font-size: 16px; font-weight: bold; color: #fde5b6; text-align: center; text-transform: uppercase; text-shadow: 0 0 3px #000; margin-bottom: 2px; }
            .hwh-toolbar-row { display: flex; justify-content: space-between; gap: 5px; width: 100%; }
            .hwh-toolbar-row .PopUp_btnGap { flex: 1; min-width: 0; }
            #hwh-search-input, #hwh-threshold-input { width: 100%; padding: 4px; border-radius: 4px; border: 1px solid #5c4b3a; background-color: #1e1510; color: #fde5b6; font-size: 12px; outline: none; }
            #hwh-search-input:focus, #hwh-threshold-input:focus { border-color: #ffd700; }
            .hwh-input-label { font-size: 10px; color: #aaa; margin-bottom: 1px; }
        `;
        document.head.appendChild(style);
    }

    function exposeAPI() {
        unsafeWindow.HWH_AutoBuyer = {
            run: () => {
                console.log('[HWH-AutoBuyer] API Run Triggered');
                runAutoBuy();
            },
            handleAction: async (action) => {
                const { popup, getSaveVal, setSaveVal, I18N } = unsafeWindow.HWHFuncs;
                const checkboxes = popup.getCheckBoxes();

                if (!UI_STATE.shopId) {
                    const globalSettings = getSaveVal(CONFIG.globalSettingsKey, {});
                    checkboxes.forEach(cb => { globalSettings[cb.name] = cb.checked; });
                    setSaveVal(CONFIG.globalSettingsKey, globalSettings);
                    rescheduleTimers();
                    return;
                }

                const storageKey = CONFIG.storagePrefix + UI_STATE.shopId;
                const data = getSaveVal(storageKey, {});
                checkboxes.forEach(cb => {
                    const id = cb.name;
                    if (!data[id]) data[id] = { buy: false, hidden: false, fav: false };
                    if (UI_STATE.mode === 'buy') data[id].buy = cb.checked;
                    if (UI_STATE.mode === 'hide') { data[id].hidden = cb.checked; if (cb.checked) data[id].buy = false; }
                    if (UI_STATE.mode === 'fav') data[id].fav = cb.checked;
                });
                const thresholdInput = document.getElementById('hwh-threshold-input');
                if (thresholdInput) {
                    const val = parseInt(thresholdInput.value);
                    data._threshold = isNaN(val) ? CONFIG.defaultThreshold : val;
                }
                setSaveVal(storageKey, data);

                if (action === 'back') { popup.hide(); setTimeout(showMainMenu, 100); }
                else if (action === 'apply' || action === 'close') { if (action === 'apply') openShopConfig(UI_STATE.shopId); }
                else if (action === 'toggle_hidden') { UI_STATE.showHidden = !UI_STATE.showHidden; openShopConfig(UI_STATE.shopId); }
                else if (['buy', 'hide', 'fav'].includes(action)) { UI_STATE.mode = action; openShopConfig(UI_STATE.shopId); }
                else if (action === 'exportShop') { exportShopData(); }
                else if (action === 'triggerShopImport') { triggerShopImportData(); }
            }
        };
    }

    function exportShopData() {
        if (!UI_STATE.shopId) return;
        const { getSaveVal } = unsafeWindow.HWHFuncs;
        const shopName = SHOPS_CONFIG[UI_STATE.shopId].name.replace(/\s+/g, '_');
        const data = getSaveVal(CONFIG.storagePrefix + UI_STATE.shopId, {});
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hwh_${shopName}_config.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function triggerShopImportData() {
        if (!UI_STATE.shopId) return;
        const { I18N } = unsafeWindow.HWHFuncs;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const newData = JSON.parse(event.target.result);
                    const { getSaveVal, setSaveVal } = unsafeWindow.HWHFuncs;
                    const key = CONFIG.storagePrefix + UI_STATE.shopId;
                    const currentData = getSaveVal(key, {});
                    const merged = { ...currentData, ...newData };
                    setSaveVal(key, merged);
                    alert(I18N('AB_PRO_ALERT_IMPORT_SUCCESS'));
                    openShopConfig(UI_STATE.shopId);
                } catch(err) {
                    alert(I18N('AB_PRO_ALERT_INVALID_JSON'));
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function injectButton() {
        if (!unsafeWindow.HWHData?.buttons) return;
        const { I18N } = unsafeWindow.HWHFuncs;
        const buttonAction = {
            get name() { return I18N('AB_PRO_BTN_LABEL'); },
            get title() { return I18N('AB_PRO_BTN_TOOLTIP'); },
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
            exportData[shopId] = getSaveVal(CONFIG.storagePrefix + shopId, {});
        });
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "hwh_autobuyer_FULL_profile.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function importSettings(jsonData) {
        const { setSaveVal, I18N } = unsafeWindow.HWHFuncs;
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            let count = 0;
            Object.keys(data).forEach(shopId => {
                if (SHOPS_CONFIG[shopId]) {
                    setSaveVal(CONFIG.storagePrefix + shopId, data[shopId]);
                    count++;
                }
            });
            alert(I18N('AB_PRO_ALERT_FULL_IMPORT_SUCCESS', { count }));
        } catch (e) {
            alert(I18N('AB_PRO_ALERT_FULL_IMPORT_FAIL'));
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
        const { I18N } = unsafeWindow.HWHFuncs;
        unsafeWindow.HWHFuncs.setProgress(I18N('AB_PRO_PROG_DOWNLOAD', { key }));
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            importSettings(json);
            unsafeWindow.HWHFuncs.setProgress(I18N('AB_PRO_PROG_LOADED'), true);
        } catch (e) {
            console.error(e);
            unsafeWindow.HWHFuncs.setProgress(I18N('AB_PRO_PROG_DOWNLOAD_FAIL'), true);
        }
    }

    async function showMainMenu() {
        const { popup, getSaveVal, I18N } = unsafeWindow.HWHFuncs;
        const menuButtons = [
            { msg: I18N('AB_PRO_RUN_ALL'), result: 'run_all', color: 'green' }
        ];
        Object.keys(SHOPS_CONFIG).forEach(shopId => {
            menuButtons.push({ msg: SHOPS_CONFIG[shopId].name, result: `conf_${shopId}`, color: 'blue' });
        });
        menuButtons.push({ msg: I18N('AB_PRO_EXPORT_FULL'), result: 'export', color: 'graphite' });
        menuButtons.push({ msg: I18N('AB_PRO_IMPORT_FULL'), result: 'import', color: 'graphite' });
        menuButtons.push({ msg: I18N('AB_PRO_WEB_1'), result: 'web_1', color: 'orange' });
        menuButtons.push({ msg: I18N('AB_PRO_WEB_2'), result: 'web_2', color: 'orange' });
        menuButtons.push({ msg: I18N('AB_PRO_WEB_3'), result: 'web_3', color: 'orange' });
        menuButtons.push({ result: false, isClose: true });

        const globalSettings = getSaveVal(CONFIG.globalSettingsKey, { runOnStartup: false, checkHourly: false });
        const checkBoxes = [
            { name: 'runOnStartup', label: I18N('AB_PRO_RUN_ON_STARTUP'), checked: globalSettings.runOnStartup },
            { name: 'checkHourly', label: I18N('AB_PRO_CHECK_HOURLY'), checked: globalSettings.checkHourly }
        ];

        const answer = await popup.confirm(I18N('AB_PRO_MAIN_TITLE'), menuButtons, checkBoxes);

        const newCheckboxes = popup.getCheckBoxes();
        if (newCheckboxes && newCheckboxes.length > 0) {
            const newSettings = {};
            newCheckboxes.forEach(cb => newSettings[cb.name] = cb.checked);
            unsafeWindow.HWHFuncs.setSaveVal(CONFIG.globalSettingsKey, newSettings);
            rescheduleTimers();
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
        const { popup, getSaveVal, I18N } = unsafeWindow.HWHFuncs;
        const { lib, cheats } = unsafeWindow;
        const shopDef = SHOPS_CONFIG[shopId];
        const storageKey = CONFIG.storagePrefix + shopId;
        const savedData = getSaveVal(storageKey, {});
        const currentThreshold = savedData._threshold !== undefined ? savedData._threshold : CONFIG.defaultThreshold;

        const htmlContent = `
            <div class="hwh-header-wrapper">
                <div class="hwh-controls-left">
                    <div class="hwh-toolbar-row">
                        ${getNativeBtnHTML(I18N('AB_PRO_BTN_BACK'), 'red', 'back')}
                        ${getNativeBtnHTML(UI_STATE.showHidden ? I18N('AB_PRO_BTN_HIDE_ITEMS') : I18N('AB_PRO_BTN_SHOW_ITEMS'), 'blue', 'toggle_hidden')}
                        ${getNativeBtnHTML(I18N('AB_PRO_BTN_APPLY'), 'green', 'apply')}
                    </div>
                    <div class="hwh-toolbar-row">
                        ${getNativeBtnHTML(I18N('AB_PRO_MODE_BUY'), 'graphite', 'buy', UI_STATE.mode === 'buy')}
                        ${getNativeBtnHTML(I18N('AB_PRO_MODE_HIDE'), 'graphite', 'hide', UI_STATE.mode === 'hide')}
                        ${getNativeBtnHTML(I18N('AB_PRO_MODE_FAV'), 'graphite', 'fav', UI_STATE.mode === 'fav')}
                    </div>
                </div>
                <div class="hwh-search-right">
                    <div class="hwh-shop-title">${shopDef.name}</div>
                    <div style="display:flex; gap:5px; margin-bottom:5px;">
                        <div style="flex:1">
                            <div class="hwh-input-label">${I18N('AB_PRO_LBL_MIN_RESERVE')}</div>
                            <input type="number" id="hwh-threshold-input" value="${currentThreshold}" step="1000" placeholder="8000">
                        </div>
                        <div style="flex:2">
                            <div class="hwh-input-label">${I18N('AB_PRO_LBL_SEARCH')}</div>
                            <input type="text" id="hwh-search-input" placeholder="${I18N('AB_PRO_PH_SEARCH')}" autocomplete="off">
                        </div>
                    </div>
                    <div class="hwh-toolbar-row">
                        ${getNativeBtnHTML(I18N('AB_PRO_BTN_IMPORT'), 'bronze', 'triggerShopImport')}
                        ${getNativeBtnHTML(I18N('AB_PRO_BTN_EXPORT'), 'bronze', 'exportShop')}
                    </div>
                    <div style="text-align:center; font-size:10px; color:#aaa; margin-top:2px">
                        ${I18N('AB_PRO_LBL_MODE')} <span style="color:#fff">${UI_STATE.mode.toUpperCase()}</span>
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
                try { name = cheats.translate(`LIB_${libType}_NAME_${id}`); } catch(e) { name = null; }
            }
            if (!name || name.includes('LIB_')) name = `Item ${id} (${type})`;
            let label = name;
            if (settings.fav) label = `<span class="hwh-item-fav">⭐ ${label}</span>`;
            if (settings.hidden) label = `<span class="hwh-item-hidden">🚫 ${label}</span>`;
            let isChecked = false;
            if (UI_STATE.mode === 'buy') isChecked = settings.buy;
            if (UI_STATE.mode === 'hide') isChecked = settings.hidden;
            if (UI_STATE.mode === 'fav') isChecked = settings.fav;
            itemsToDisplay.push({ name: itemKey, label: label, checked: isChecked, _sortName: name, _isFav: settings.fav });
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
        setTimeout(() => {
            const popupEl = document.querySelector('.PopUp_');
            if (popupEl) popupEl.classList.add('hwh-ab-grid');
            const searchInput = document.getElementById('hwh-search-input');
            if (searchInput) {
                searchInput.focus();
                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    document.querySelectorAll('.PopUp_checkboxes label').forEach(lbl => {
                        lbl.style.display = lbl.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
                    });
                });
            }
        }, 100);

        if (await popupPromise === false) {
            unsafeWindow.HWH_AutoBuyer.handleAction('close');
        }
    }

    async function runAutoBuy() {
        const { Caller, HWHFuncs, cheats } = unsafeWindow;
        const { getSaveVal, I18N } = HWHFuncs;
        HWHFuncs.setProgress(I18N('AB_PRO_PROG_SCANNING'));
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
                const shopThreshold = savedData._threshold !== undefined ? savedData._threshold : CONFIG.defaultThreshold;
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
                        if (balance >= (cost + shopThreshold)) {
                            buyCalls.push({ name: 'shopBuy', args: { shopId: +shopId, slot: slot.id, cost: slot.cost, reward: slot.reward } });
                            const itemName = cheats.translate(`LIB_${normalizedType.toUpperCase()}_NAME_${rId}`) || itemKey;
                            log.push(`[${SHOPS_CONFIG[shopId].name}] Bought: ${itemName}`);
                            if (costType === 'gold') userInfo.gold -= cost;
                            else if (coinId) inventory.coin[coinId] -= cost;
                        }
                    }
                });
            });
            if (buyCalls.length > 0) {
                HWHFuncs.setProgress(I18N('AB_PRO_PROG_BUYING', { count: buyCalls.length }), false);
                await Caller.send(buyCalls);
                HWHFuncs.setProgress(I18N('AB_PRO_PROG_SUCCESS', { count: buyCalls.length }), true);
                console.log('[HWH-AutoBuyer] Purchase Log:', log);
            } else {
                HWHFuncs.setProgress(I18N('AB_PRO_PROG_NOTHING'), true);
            }
        } catch (e) {
            console.error('[HWH-AutoBuyer] Error:', e);
            HWHFuncs.setProgress(I18N('AB_PRO_PROG_ERROR'), true);
        }
    }
})();