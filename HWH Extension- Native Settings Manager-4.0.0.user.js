// ==UserScript==
// @name            HWH Extension: Native Settings Manager
// @namespace       HWH.Addons
// @version         4.0.0
// @description     Manage HWH settings with File Export and Web Import (GitHub)
// @author          HWH Extension Architect
// @match           https://www.hero-wars.com/*
// @match           https://apps-1701433570146040.apps.fbsbx.com/*
// @grant           unsafeWindow
// @run-at          document-start
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        id: 'hwh_settings_mgr_btn',
        label: 'Settings Mgr',
        tooltip: 'Backup/Restore/Web Import / Управление настройками',
        color: 'blue',
        anchorId: 'extensions',
        storageKey: 'hwh_manager_saved_defaults',
        // Raw URLs for GitHub logic
        webSources: {
            web: 'https://raw.githubusercontent.com/HeroWarsTools/profiles/main/settingsmanager.json',
            W2:  'https://raw.githubusercontent.com/HeroWarsTools/profiles/main/settingsmanager2.json',
            W3:  'https://raw.githubusercontent.com/HeroWarsTools/profiles/main/settingsmanager3.json'
        }
    };

    const loader = setInterval(() => {
        if (typeof unsafeWindow.HWHClasses !== 'undefined' &&
            typeof unsafeWindow.HWHData !== 'undefined' &&
            typeof unsafeWindow.HWHFuncs !== 'undefined') {
            clearInterval(loader);
            setTimeout(init, 1000);
        }
    }, 500);

    function init() {
        console.log('[HWH-Settings] v4.0 Init...');
        injectButton();
    }

    function injectButton() {
        if (!unsafeWindow.HWHData?.buttons) return;
        const buttonAction = {
            get name() { return CONFIG.label; },
            get title() { return CONFIG.tooltip; },
            color: CONFIG.color,
            onClick: async function() { await openSettingsPopup(); }
        };
        const oldButtons = unsafeWindow.HWHData.buttons;
        const newButtons = {};
        let inserted = false;
        for (const [key, value] of Object.entries(oldButtons)) {
            newButtons[key] = value;
            if (key === CONFIG.anchorId) {
                newButtons[CONFIG.id] = buttonAction;
                inserted = true;
            }
        }
        if (!inserted) newButtons[CONFIG.id] = buttonAction;
        unsafeWindow.HWHData.buttons = newButtons;
    }

    /**
     * LOGICA DATI
     */
    function getCurrentSettings() {
        const { HWHData, HWHFuncs } = unsafeWindow;
        const settings = {
            main: {},
            doAll: HWHFuncs.getSaveVal('selectedDoIt', {}),
            quests: HWHFuncs.getSaveVal('selectedActions', {})
        };
        for (const key in HWHData.checkboxes) settings.main[key] = HWHFuncs.isChecked(key);
        for (const key in HWHData.inputs) {
            const val = HWHFuncs.getInput(key);
            settings.main[key] = isNaN(parseFloat(val)) ? val : parseFloat(val);
        }
        return settings;
    }

    function applySettings(settings) {
        if (!settings) return;
        const { HWHData, HWHFuncs } = unsafeWindow;
        if (settings.main) {
            for (const key in settings.main) {
                HWHFuncs.setSaveVal(key, settings.main[key]);
                if (HWHData.checkboxes[key]?.cbox) HWHData.checkboxes[key].cbox.checked = settings.main[key];
                if (HWHData.inputs[key]?.input) HWHData.inputs[key].input.value = settings.main[key];
            }
        }
        if (settings.doAll) HWHFuncs.setSaveVal('selectedDoIt', settings.doAll);
        if (settings.quests) HWHFuncs.setSaveVal('selectedActions', settings.quests);
        HWHFuncs.setProgress('Applied Successfully! / Успешно применено!', true);
    }

    async function fetchAndApply(url) {
        const { setProgress } = unsafeWindow.HWHFuncs;
        setProgress('Downloading... / Загрузка...', false);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network error');
            const data = await response.json();
            applySettings(data);
        } catch (e) {
            console.error('[HWH-Settings] Web Import Failed:', e);
            setProgress('Error: File not found or invalid / Ошибка: Файл не найден', true);
        }
    }

    function downloadJSON() {
        const settings = getCurrentSettings();
        const blob = new Blob([JSON.stringify(settings, null, 4)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hwh_settings_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * INTERFACCIA POPUP
     */
    async function openSettingsPopup() {
        const { popup } = unsafeWindow.HWHFuncs;

        const contentHTML = `
            <div style="text-align: center; font-size: 14px;">
                <h3 style="color: #fde5b6; margin-bottom: 5px;">Settings Manager v4</h3>
                <p>Local Backup & Web Sync</p>
                <hr style="border: 0; border-top: 1px dashed #ce9767; margin: 10px 0;">
                <p style="color: #888;">Web Profiles (GitHub):</p>
            </div>
        `;

        const popupButtons = [
            // --- ROW 1: WEB SYNC ---
            {
                msg: 'Web',
                title: 'Import Profile 1 from GitHub',
                color: 'green',
                result: () => fetchAndApply(CONFIG.webSources.web)
            },
            {
                msg: 'W2',
                title: 'Import Profile 2 from GitHub',
                color: 'green',
                result: () => fetchAndApply(CONFIG.webSources.W2)
            },
            {
                msg: 'W3',
                title: 'Import Profile 3 from GitHub',
                color: 'green',
                result: () => fetchAndApply(CONFIG.webSources.W3)
            },
            // --- ROW 2: LOCAL ---
            {
                msg: 'Save Default',
                title: 'Save current as local default',
                color: 'blue',
                isNewRow: true,
                result: () => {
                    localStorage.setItem(CONFIG.storageKey, JSON.stringify(getCurrentSettings()));
                    unsafeWindow.HWHFuncs.setProgress('Saved locally!', true);
                }
            },
            {
                msg: 'Apply Local',
                title: 'Load local saved default',
                color: 'blue',
                result: () => {
                    const saved = localStorage.getItem(CONFIG.storageKey);
                    if (saved) applySettings(JSON.parse(saved));
                }
            },
            // --- ROW 3: FILES ---
            {
                msg: 'Export JSON',
                title: 'Download settings as .json file',
                color: 'orange',
                isNewRow: true,
                result: () => downloadJSON()
            },
            {
                msg: 'Import Manual',
                title: 'Paste JSON manually',
                color: 'violet',
                result: async function() { await openImportManual(); }
            },
            { result: false, isClose: true }
        ];

        const answer = await popup.confirm(contentHTML, popupButtons);
        if (typeof answer === 'function') answer();
    }

    async function openImportManual() {
        const { popup } = unsafeWindow.HWHFuncs;
        const answer = await popup.confirm(
            'Paste JSON string / Вставьте JSON:',
            [{ msg: 'Restore', isInput: true, color: 'green' }, { result: false, isClose: true }]
        );
        if (answer && typeof answer === 'string') {
            try { applySettings(JSON.parse(answer)); } catch (e) { unsafeWindow.HWHFuncs.setProgress('Invalid JSON', true); }
        }
    }

})();