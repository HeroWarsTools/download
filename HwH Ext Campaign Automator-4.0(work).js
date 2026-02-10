// ==UserScript==
// @name         HWH Ext Campaign Automator
// @namespace    HWH_Extensions
// @version      4.0.0
// @description  v4.0: Full I18N (En/Ru), Fixed Force Raid Logic, Auto-Loop, Compact UI.
// @author       ZingerY (Logic) & Gemini (Architect)
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    /**
     * @AI-REFERENCE: CONFIGURATION
     */
    const CONFIG = {
        id: 'hwh_campaign_auto_arch',
        // Label will be set via I18N in init
        color: 'purple',
        anchorId: 'dailyQuests',
        dbName: 'HeroWarsHelper',
        storeName: 'settings'
    };

    const WEB_PROFILES = {
        'WEB': 'https://raw.githubusercontent.com/HeroWarsTools/profiles/main/campaign.json',
        'W2': 'https://raw.githubusercontent.com/HeroWarsTools/profiles/main/campaign2.json',
        'W3': 'https://raw.githubusercontent.com/HeroWarsTools/profiles/main/campaign3.json'
    };

    // --- TRANSLATION DATA ---
    const i18n_en = {
        CAMP_LABEL: "Campaign Auto",
        CAMP_TOOLTIP: "Automate Campaign Missions",
        CAMP_TITLE: "Campaign Auto v4.0",
        CAMP_METHOD: "Method",
        CAMP_MISSION: "Mission",
        CAMP_REPS: "Reps",
        CAMP_ENERGY: "Energy >",
        CAMP_AUTO_START: "Auto Start",
        CAMP_AUTO_SYNC: "Auto Sync",
        CAMP_FORCE_RAID: "Force Raid",
        CAMP_OPT_SKIP: "Skip (Manual)",
        CAMP_OPT_SEQ: "Sequence",
        CAMP_OPT_RAID1: "Raid x1",
        CAMP_OPT_RAIDM: "Raid Multi",
        CAMP_BTN_MENU: "MENU",
        CAMP_BTN_START: "START",
        CAMP_BTN_SAVE: "SAVE",
        CAMP_BTN_SAVETO: "SAVE TO...",
        CAMP_BTN_EXPORT: "Export",
        CAMP_BTN_IMPORT: "Import",
        CAMP_BTN_CLOSE: "CLOSE",
        CAMP_PROFILES: "PROFILES",
        CAMP_STATUS_PREP: "Preparing...",
        CAMP_STATUS_RAID: "Raid",
        CAMP_STATUS_BATTLE: "Battle",
        CAMP_STATUS_QUESTS: "Collecting Quests...",
        CAMP_STATUS_SYNC: "Syncing...",
        CAMP_STATUS_DONE: "Done.",
        CAMP_STATUS_LOOP: "Auto-Loop: Restarting...",
        CAMP_STATUS_WAIT: "Auto-Loop: Waiting Energy...",
        CAMP_MSG_SAVED: "Settings Saved",
        CAMP_MSG_LOADED: "Profile Loaded",
        CAMP_MSG_EMPTY: "Profile is empty",
        CAMP_MSG_SELECT_PROF: "Select P1-P6 to overwrite",
        CAMP_SEL_TITLE: "Select Mission",
        CAMP_SEL_SEARCH: "Search..."
    };

    const i18n_ru = {
        CAMP_LABEL: "Авто-Кампания",
        CAMP_TOOLTIP: "Автоматизация миссий кампании",
        CAMP_TITLE: "Авто-Кампания v4.0",
        CAMP_METHOD: "Метод",
        CAMP_MISSION: "Миссия",
        CAMP_REPS: "Повторы",
        CAMP_ENERGY: "Энергия >",
        CAMP_AUTO_START: "Авто-старт",
        CAMP_AUTO_SYNC: "Авто-синх.",
        CAMP_FORCE_RAID: "Форс. Рейд",
        CAMP_OPT_SKIP: "Пропуск (Руч.)",
        CAMP_OPT_SEQ: "Секвенция",
        CAMP_OPT_RAID1: "Рейд x1",
        CAMP_OPT_RAIDM: "Рейд Мульти",
        CAMP_BTN_MENU: "МЕНЮ",
        CAMP_BTN_START: "СТАРТ",
        CAMP_BTN_SAVE: "СОХР.",
        CAMP_BTN_SAVETO: "СОХР. В...",
        CAMP_BTN_EXPORT: "Экспорт",
        CAMP_BTN_IMPORT: "Импорт",
        CAMP_BTN_CLOSE: "ЗАКРЫТЬ",
        CAMP_PROFILES: "ПРОФИЛИ",
        CAMP_STATUS_PREP: "Подготовка...",
        CAMP_STATUS_RAID: "Рейд",
        CAMP_STATUS_BATTLE: "Битва",
        CAMP_STATUS_QUESTS: "Сбор квестов...",
        CAMP_STATUS_SYNC: "Синхронизация...",
        CAMP_STATUS_DONE: "Готово.",
        CAMP_STATUS_LOOP: "Авто-цикл: Перезапуск...",
        CAMP_STATUS_WAIT: "Авто-цикл: Ждем энергию...",
        CAMP_MSG_SAVED: "Настройки сохранены",
        CAMP_MSG_LOADED: "Профиль загружен",
        CAMP_MSG_EMPTY: "Профиль пуст",
        CAMP_MSG_SELECT_PROF: "Выберите P1-P6 для записи",
        CAMP_SEL_TITLE: "Выбор Миссии",
        CAMP_SEL_SEARCH: "Поиск..."
    };

    let isAutomationRunning = false;
    let autoCheckInterval = null;
    let uiPollingInterval = null;
    let isSavingMode = false;

    /**
     * @AI-REFERENCE: DATABASE MODULE
     */
    class HWHExtensionDB {
        constructor(dbName, storeName) { this.dbName = dbName; this.storeName = storeName; this.db = null; }
        async open() { return new Promise((resolve, reject) => { const request = indexedDB.open(this.dbName); request.onsuccess = () => { this.db = request.result; resolve(); }; request.onerror = () => reject(); }); }
        async get(key, def) { return new Promise((resolve) => { try { if (!this.db) { resolve(def); return; } const transaction = this.db.transaction([this.storeName], 'readonly'); const request = transaction.objectStore(this.storeName).get(key); request.onsuccess = () => resolve(request.result === undefined ? def : request.result); } catch (e) { resolve(def); } }); }
        async set(key, value) { return new Promise(async (resolve, reject) => { try { if (!this.db) await this.open(); const transaction = this.db.transaction([this.storeName], 'readwrite'); transaction.objectStore(this.storeName).put(value, key); transaction.oncomplete = () => resolve(); } catch (e) { reject(e); } }); }
    }
    const db = new HWHExtensionDB(CONFIG.dbName, CONFIG.storeName);

    /**
     * @AI-REFERENCE: LIFECYCLE
     */
    const loader = setInterval(() => {
        if (typeof unsafeWindow.HWHClasses !== 'undefined' &&
            typeof unsafeWindow.HWHFuncs !== 'undefined' &&
            typeof unsafeWindow.HWHData !== 'undefined') {
            clearInterval(loader);
            setTimeout(init, 500);
        }
    }, 500);

    async function init() {
        console.log(`[HWH Ext] Campaign Automator v${GM_info.script.version} Loaded`);

        // Inject Translations
        Object.assign(unsafeWindow.HWHData.i18nLangData.en, i18n_en);
        Object.assign(unsafeWindow.HWHData.i18nLangData.ru, i18n_ru);

        await db.open();
        injectMenuButton();
        exposeAPI();

        if (autoCheckInterval) clearInterval(autoCheckInterval);
        autoCheckInterval = setInterval(() => backgroundEnergyCheck(false), 10 * 60 * 1000);

        setTimeout(() => {
            console.log("[HWH CampAuto] 12s Auto-Start Check...");
            backgroundEnergyCheck(true);
        }, 12000);
    }

    function injectMenuButton() {
        const I18N = unsafeWindow.HWHFuncs.I18N;
        const buttonAction = {
            get name() { return I18N('CAMP_LABEL'); },
            get title() { return I18N('CAMP_TOOLTIP'); },
            color: CONFIG.color,
            onClick: openMainPopup
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
        unsafeWindow.HWHFuncs.addExtentionName("CampaignAuto Arch", GM_info.script.version, "Architect");
    }

    function exposeAPI() {
        unsafeWindow.HWH_CampAuto_API = {
            updateName: updateMissionNameDisplay,
            handleProfileClick: handleProfileClick,
            run: runAutomationSequence,
            toggleSaveMode: toggleSaveMode,
            exportData: exportData,
            importData: importData,
            importWeb: importWebProfile,
            applyVipRules: applyVip5Rules,
            openMenu: openMissionSelectorPopup,
            selectMission: selectMissionFromList,
            toggleFavorite: toggleFavoriteMission,
            checkAuto: () => backgroundEnergyCheck(true),
            autoSave: saveCurrentStateUI,
            handleForceRaid: handleForceRaidChange
        };
    }

    /**
     * @AI-REFERENCE: MAIN POPUP UI
     */
    async function openMainPopup() {
        const { popup, getUserInfo, I18N } = unsafeWindow.HWHFuncs;
        const userId = getUserInfo()?.id;
        const settings = await getSettings(userId);
        const vipInfo = await checkVipStatus();
        isSavingMode = false;

        // Dynamic Options
        let methodOptions = `
            <option value="skip_battle" ${settings.method === 'skip_battle' ? 'selected' : ''}>${I18N('CAMP_OPT_SKIP')}</option>
            <option value="sequence" ${settings.method === 'sequence' ? 'selected' : ''}>${I18N('CAMP_OPT_SEQ')}</option>
        `;

        if (vipInfo.canRaidSingle || settings.forceRaid) {
            methodOptions += `<option value="raid_single" ${settings.method === 'raid_single' ? 'selected' : ''}>${I18N('CAMP_OPT_RAID1')}</option>`;
        }
        if (vipInfo.canRaidMulti) {
            methodOptions += `<option value="raid_multi" ${settings.method === 'raid_multi' ? 'selected' : ''}>${I18N('CAMP_OPT_RAIDM')}</option>`;
        }

        let vip0Checkbox = '';
        if (!vipInfo.canRaidSingle) {
            vip0Checkbox = `
                <div style="display: flex; align-items: center; gap: 2px; font-size: 10px; color: #ff8888;">
                    <input type="checkbox" id="hwh_force_raid" ${settings.forceRaid ? 'checked' : ''} onchange="HWH_CampAuto_API.handleForceRaid()">
                    <label for="hwh_force_raid">${I18N('CAMP_FORCE_RAID')}</label>
                </div>
            `;
        }

        const html = `
            <div id="hwh_camp_ui" style="display: flex; flex-direction: column; gap: 8px; min-width: 280px; max-width: 300px; color: #fce1ac; font-size: 13px;">
                <h3 style="text-align: center; color: #fde5b6; margin: 0 0 5px 0;">${I18N('CAMP_TITLE')}</h3>

                <!-- Row 1: Method -->
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label>${I18N('CAMP_METHOD')}:</label>
                    <select id="hwh_method" onchange="HWH_CampAuto_API.updateName(); HWH_CampAuto_API.applyVipRules(); HWH_CampAuto_API.autoSave()"
                        style="width: 140px; background: #170d07; color: #fce1ac; border: 1px solid #cf9250; padding: 2px;">
                        ${methodOptions}
                    </select>
                </div>

                <!-- Row 2: Mission ID + Menu -->
                <div style="display: flex; align-items: center; gap: 5px;">
                    <label style="width: 60px;">${I18N('CAMP_MISSION')}:</label>
                    <input type="number" id="hwh_mission_id"
                        oninput="HWH_CampAuto_API.updateName(); HWH_CampAuto_API.applyVipRules(); HWH_CampAuto_API.autoSave()"
                        value="${settings.missionId || ''}"
                        placeholder="ID"
                        style="width: 60px; background: #170d07; color: #fce1ac; border: 1px solid #cf9250; text-align: center;">

                    <div onclick="HWH_CampAuto_API.openMenu()" class="PopUp_btnGap blue" style="flex-grow: 1; cursor: pointer; padding: 1px;">
                        <div class="PopUp_btnPlate" style="padding: 3px; font-size: 11px; height: 16px;">${I18N('CAMP_BTN_MENU')}</div>
                    </div>
                </div>

                <div id="hwh_mission_name_display" style="text-align: center; color: #f0e68c; font-style: italic; font-size: 11px; min-height: 14px;">...</div>

                <!-- Row 3: Reps + Force Raid -->
                <div style="display: flex; align-items: center; gap: 5px;">
                    <label style="width: 60px;">${I18N('CAMP_REPS')}:</label>
                    <input type="number" id="hwh_repetitions" value="${settings.reps || 1}" onchange="HWH_CampAuto_API.autoSave()"
                        style="width: 60px; background: #170d07; color: #fce1ac; border: 1px solid #cf9250; text-align: center;">
                    ${vip0Checkbox}
                </div>

                <hr style="border: 0; border-top: 1px solid #ce976755; width: 100%; margin: 2px 0;">

                <!-- Automation Settings -->
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label title="Auto-start energy">${I18N('CAMP_ENERGY')}</label>
                    <input type="number" id="hwh_energy_threshold" value="${settings.energyThreshold || 120}" onchange="HWH_CampAuto_API.autoSave()"
                        style="width: 50px; background: #170d07; color: #fce1ac; border: 1px solid #cf9250; text-align: center;">
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 12px;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <input type="checkbox" id="hwh_auto_start_toggle" ${settings.autoStartEnabled ? 'checked' : ''}
                            onchange="HWH_CampAuto_API.autoSave(); setTimeout(() => HWH_CampAuto_API.checkAuto(), 1000)">
                        <label for="hwh_auto_start_toggle">${I18N('CAMP_AUTO_START')}</label>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <input type="checkbox" id="hwh_auto_sync_toggle" ${settings.autoSyncEnabled ? 'checked' : ''} onchange="HWH_CampAuto_API.autoSave()">
                        <label for="hwh_auto_sync_toggle">${I18N('CAMP_AUTO_SYNC')}</label>
                    </div>
                </div>

                <div id="hwh_camp_status" style="text-align: center; color: #88ff88; font-weight: bold; font-size: 11px; min-height: 15px;"></div>

                <!-- Main Action Buttons -->
                <div style="display: flex; gap: 5px; margin-top: 5px;">
                    <div onclick="HWH_CampAuto_API.run()" class="PopUp_btnGap green" style="flex: 1; cursor: pointer;">
                        <div class="PopUp_btnPlate" style="font-weight: bold;">${I18N('CAMP_BTN_START')}</div>
                    </div>
                    <div id="hwh_btn_save_mode" onclick="HWH_CampAuto_API.toggleSaveMode()" class="PopUp_btnGap brown" style="flex: 1; cursor: pointer;">
                        <div class="PopUp_btnPlate" style="font-weight: bold;">${I18N('CAMP_BTN_SAVETO')}</div>
                    </div>
                </div>

                <!-- Profiles -->
                <div style="text-align: center; margin-top: 5px;">
                    <span style="font-size: 10px; color: #888;">${I18N('CAMP_PROFILES')}</span>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; margin: 2px auto; width: 90%;">
                        ${[1, 2, 3, 4, 5, 6].map(i => `
                            <div onclick="HWH_CampAuto_API.handleProfileClick(${i})" class="PopUp_btnGap beige" style="padding: 1px; cursor: pointer;" title="P${i}">
                                <div class="PopUp_btnPlate" style="padding: 2px; font-size: 10px; height: 14px;">P${i}</div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="display: flex; gap: 8px; justify-content: center; margin-top: 8px; align-items: center;">
                        <span onclick="HWH_CampAuto_API.exportData()" style="cursor: pointer; font-size: 10px; text-decoration: underline; color: #ce9767;">${I18N('CAMP_BTN_EXPORT')}</span>
                        <span onclick="HWH_CampAuto_API.importData()" style="cursor: pointer; font-size: 10px; text-decoration: underline; color: #ce9767;">${I18N('CAMP_BTN_IMPORT')}</span>
                    </div>
                    <div style="display: flex; gap: 4px; justify-content: center; margin-top: 4px;">
                        ${Object.keys(WEB_PROFILES).map(k => `
                            <div onclick="HWH_CampAuto_API.importWeb('${k}')" class="PopUp_btnGap indigo" style="cursor: pointer; padding: 1px; width: 30px;">
                                <div class="PopUp_btnPlate" style="padding: 1px; font-size: 9px;">${k}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        if (uiPollingInterval) clearInterval(uiPollingInterval);
        uiPollingInterval = setInterval(() => {
            if (document.getElementById('hwh_mission_id')) {
                updateMissionNameDisplay();
            } else {
                clearInterval(uiPollingInterval);
            }
        }, 3000);

        await popup.confirm(html, [{ result: false, isClose: true }]);

        updateMissionNameDisplay();
        applyVip5Rules();
    }

    /**
     * @AI-REFERENCE: PROFILE LOGIC
     */
    function toggleSaveMode() {
        const I18N = unsafeWindow.HWHFuncs.I18N;
        isSavingMode = !isSavingMode;
        const btn = document.getElementById('hwh_btn_save_mode');
        if (btn) {
            if (isSavingMode) {
                btn.classList.remove('brown');
                btn.classList.add('orange');
                unsafeWindow.HWHFuncs.setProgress(I18N('CAMP_MSG_SELECT_PROF'), false);
            } else {
                btn.classList.remove('orange');
                btn.classList.add('brown');
                unsafeWindow.HWHFuncs.setProgress("", true);
            }
        }
    }

    async function handleProfileClick(n) {
        const I18N = unsafeWindow.HWHFuncs.I18N;
        if (isSavingMode) {
            await saveCurrentStateUI(n);
            unsafeWindow.HWHFuncs.setProgress(`${I18N('CAMP_MSG_SAVED')} P${n}!`, true);
            toggleSaveMode();
        } else {
            await loadProfileWrapper(n);
        }
    }

    async function loadProfileWrapper(n) {
        const { getUserInfo, setProgress, I18N } = unsafeWindow.HWHFuncs;
        const userId = getUserInfo()?.id;
        const allSettings = await db.get(userId, {});
        const pData = allSettings.campaignAutomator?.profiles?.[n];

        if (pData) {
            const vipInfo = await checkVipStatus();

            // Downgrade Logic
            let method = pData.method;
            if (method === 'raid_multi' && !vipInfo.canRaidMulti) method = 'raid_single';
            if (method === 'raid_single' && !vipInfo.canRaidSingle && !pData.forceRaid) method = 'skip_battle';

            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };

            setVal('hwh_method', method);
            setVal('hwh_mission_id', pData.missionId);
            setVal('hwh_repetitions', pData.reps);
            setVal('hwh_energy_threshold', pData.energyThreshold);
            setChk('hwh_auto_start_toggle', pData.autoStartEnabled);
            setChk('hwh_auto_sync_toggle', pData.autoSyncEnabled);
            if (document.getElementById('hwh_force_raid')) {
                setChk('hwh_force_raid', pData.forceRaid || false);
                handleForceRaidChange(true);
            }

            updateMissionNameDisplay();
            applyVip5Rules();
            saveCurrentStateUI();
            setProgress(`${I18N('CAMP_MSG_LOADED')} P${n}`, true);
        } else {
            setProgress(`${I18N('CAMP_MSG_EMPTY')} P${n}`, true);
        }
    }

    // Point 9: Force Raid Logic (Corrected)
    function handleForceRaidChange(skipSave = false) {
        const I18N = unsafeWindow.HWHFuncs.I18N;
        const checkbox = document.getElementById('hwh_force_raid');
        const select = document.getElementById('hwh_method');
        if (!checkbox || !select) return;

        const isChecked = checkbox.checked;
        const raidOptionExists = select.querySelector('option[value="raid_single"]');

        if (isChecked) {
            if (!raidOptionExists) {
                const opt = document.createElement('option');
                opt.value = 'raid_single';
                opt.text = I18N('CAMP_OPT_RAID1');
                select.add(opt);
            }
            // Only switch if current is skip, as requested
            if (select.value === 'skip_battle') {
                select.value = 'raid_single';
            }
        } else {
            // If unchecked, we don't remove the option immediately to avoid UI jumping,
            // but if the user was on raid_single and they are VIP0, they might want to switch back.
            // However, the prompt says "maintain the same function... because Raid x1 is already there".
            // So we do nothing on uncheck regarding selection, unless it's invalid.
        }

        if (!skipSave) saveCurrentStateUI();
    }

    /**
     * @AI-REFERENCE: MISSION SELECTOR
     */
    async function openMissionSelectorPopup() {
        const { popup, getUserInfo, I18N } = unsafeWindow.HWHFuncs;
        const userId = getUserInfo()?.id;
        const settings = await getSettings(userId);
        const favorites = settings.favorites || [];

        const allMissions = Object.values(unsafeWindow.lib.data.mission)
            .filter(m => m.id < 1000)
            .map(m => ({
                id: m.id,
                name: unsafeWindow.cheats.translate("LIB_MISSION_NAME_" + m.id)
            }));

        const renderList = (filter = "") => {
            const container = document.getElementById('hwh_sel_list');
            if(!container) return;
            container.innerHTML = "";

            const filtered = allMissions.filter(m =>
                m.id.toString().includes(filter) ||
                m.name.toLowerCase().includes(filter.toLowerCase())
            );

            filtered.sort((a, b) => {
                const favA = favorites.includes(a.id);
                const favB = favorites.includes(b.id);
                if (favA && !favB) return -1;
                if (!favA && favB) return 1;
                return a.id - b.id;
            });

            filtered.forEach(m => {
                const isFav = favorites.includes(m.id);
                const row = document.createElement('div');
                row.style.cssText = "display: flex; justify-content: space-between; padding: 4px; border-bottom: 1px solid #444; cursor: pointer; font-size: 12px;";
                row.innerHTML = `
                    <span onclick="HWH_CampAuto_API.selectMission(${m.id})" style="flex-grow: 1;">${m.id}: ${m.name}</span>
                    <span id="fav_star_${m.id}" onclick="HWH_CampAuto_API.toggleFavorite(${m.id})" style="color: ${isFav ? 'gold' : 'gray'}; font-weight: bold; padding: 0 5px; font-size: 14px;">${isFav ? '★' : '☆'}</span>
                `;
                container.appendChild(row);
            });
        };

        unsafeWindow.HWH_CampAuto_API.renderSelector = renderList;

        const htmlContent = (complete) => {
            const div = document.createElement('div');
            div.style.cssText = "display: flex; flex-direction: column; height: 350px; width: 260px; gap: 8px; color: #fce1ac;";
            div.innerHTML = `
                <h3 style="text-align:center; margin:0; font-size: 14px;">${I18N('CAMP_SEL_TITLE')}</h3>
                <input type="text" id="hwh_sel_search" placeholder="${I18N('CAMP_SEL_SEARCH')}"
                    style="width: 100%; padding: 4px; background: #170d07; color: #fce1ac; border: 1px solid #cf9250; box-sizing: border-box;">
                <div id="hwh_sel_list" style="flex-grow: 1; overflow-y: auto; border: 1px solid #ce976755;"></div>

                <div onclick="document.getElementById('hwh_sel_close_btn').click()" class="PopUp_btnGap red" style="cursor: pointer;">
                    <div class="PopUp_btnPlate" style="font-weight: bold;">${I18N('CAMP_BTN_CLOSE')}</div>
                </div>
                <button id="hwh_sel_close_btn" style="display:none;"></button>
            `;

            div.querySelector('#hwh_sel_search').addEventListener('input', (e) => renderList(e.target.value));
            div.querySelector('#hwh_sel_close_btn').addEventListener('click', () => {
                complete(false);
                openMainPopup();
            });

            setTimeout(() => renderList(), 50);
            return div;
        };

        popup.customPopup(async (complete) => {
            const content = htmlContent(complete);
            popup.custom.innerHTML = "";
            popup.custom.appendChild(content);
            popup.show();
        });
    }

    async function toggleFavoriteMission(id) {
        const userId = unsafeWindow.HWHFuncs.getUserInfo()?.id;
        const allSettings = await db.get(userId, {});
        let favs = allSettings.campaignAutomator?.favorites || [];

        const isFavNow = !favs.includes(id);
        const starEl = document.getElementById(`fav_star_${id}`);
        if (starEl) {
            starEl.style.color = isFavNow ? 'gold' : 'gray';
            starEl.innerText = isFavNow ? '★' : '☆';
        }

        if (isFavNow) favs.push(id);
        else favs = favs.filter(x => x !== id);

        if (!allSettings.campaignAutomator) allSettings.campaignAutomator = {};
        allSettings.campaignAutomator.favorites = favs;
        await db.set(userId, allSettings);

        setTimeout(() => {
            const searchVal = document.getElementById('hwh_sel_search')?.value || "";
            if (unsafeWindow.HWH_CampAuto_API.renderSelector) unsafeWindow.HWH_CampAuto_API.renderSelector(searchVal);
        }, 500);
    }

    /**
     * @AI-REFERENCE: LOGIC ENGINE (Auto-Loop)
     */
    async function runAutomationSequence() {
        if (isAutomationRunning) return;
        isAutomationRunning = true;

        const { Send, Calc, HWHFuncs } = unsafeWindow;
        const I18N = HWHFuncs.I18N;
        const statusDiv = document.getElementById('hwh_camp_status');
        const updateStatus = (msg) => {
            if (statusDiv) statusDiv.innerText = msg;
            HWHFuncs.setProgress(msg, false);
        };

        await saveCurrentStateUI();

        const userId = HWHFuncs.getUserInfo()?.id;
        const settings = await getSettings(userId);

        let method = settings.method;
        const missionIdStr = String(settings.missionId);
        const reps = parseInt(settings.reps) || 1;

        // Point 9: Engine Logic - NO OVERRIDE. Trust the method.
        // If user selected Skip, we do Skip. If Raid, we do Raid.

        let success = false;

        try {
            updateStatus(I18N('CAMP_STATUS_PREP'));
            const teamData = await Send('{"calls":[{"name":"teamGetAll","args":{},"ident":"t"},{"name":"teamGetFavor","args":{},"ident":"f"}]}');
            const teamGetAll = teamData.results[0].result.response;
            const teamGetFavor = teamData.results[1].result.response;

            let missionList = [];
            if (method === 'sequence' || missionIdStr.includes(',') || missionIdStr.includes('-')) {
                missionList = parseSequence(missionIdStr);
            } else {
                missionList = [parseInt(missionIdStr)];
            }

            for (const mId of missionList) {
                if (isNaN(mId)) continue;

                if (method.startsWith('raid')) {
                    const times = (method === 'raid_multi') ? reps : 1;
                    const loopCount = (method === 'raid_multi') ? 1 : reps;

                    for (let i = 0; i < loopCount; i++) {
                        updateStatus(`${I18N('CAMP_STATUS_RAID')} ${mId} (${i+1}/${loopCount})...`);
                        const res = await Send({ calls: [{ name: "missionRaid", args: { id: mId, times: times }, ident: "body" }] });
                        if (res.error || (res.results && res.results[0]?.result.error)) {
                            throw new Error(`Raid Failed ${mId}`);
                        }
                        await new Promise(r => setTimeout(r, 300));
                    }
                } else {
                    const args = {
                        id: mId,
                        heroes: teamGetAll.mission.filter(id => id < 6000),
                        pet: teamGetAll.mission.filter(id => id >= 6000).pop(),
                        favor: teamGetFavor.mission
                    };
                    const iterations = (method === 'sequence') ? 1 : reps;

                    for (let i = 0; i < iterations; i++) {
                        updateStatus(`${I18N('CAMP_STATUS_BATTLE')} ${mId} (${i+1}/${iterations})...`);
                        const start = await Send({ calls: [{ name: "missionStart", args, ident: "body" }] });
                        const battleData = start?.results?.[0]?.result?.response;
                        if (!battleData) throw new Error(`Start Failed ${mId}`);

                        const res = await Calc(battleData);
                        await HWHFuncs.countdownTimer(HWHFuncs.getTimer(res.battleTime));
                        await Send({ calls: [{ name: "missionEnd", args: { id: mId, result: res.result, progress: res.progress }, ident: "body" }] });
                    }
                }
            }

            updateStatus(I18N('CAMP_STATUS_QUESTS'));
            await collectQuestRewards();

            if (settings.autoSyncEnabled) {
                const energy = await getEnergy();
                if (energy < settings.energyThreshold) {
                    updateStatus(I18N('CAMP_STATUS_SYNC'));
                    unsafeWindow.cheats.refreshGame();
                }
            }
            updateStatus(I18N('CAMP_STATUS_DONE'));
            success = true;

        } catch (e) {
            console.error(e);
            updateStatus("Error: " + e.message);
            success = false;
        } finally {
            isAutomationRunning = false;

            // Auto-Loop Logic
            if (success && settings.autoStartEnabled) {
                const currentEnergy = await getEnergy();
                if (currentEnergy >= settings.energyThreshold) {
                    updateStatus(I18N('CAMP_STATUS_LOOP'));
                    setTimeout(runAutomationSequence, 500);
                } else {
                    updateStatus(I18N('CAMP_STATUS_WAIT'));
                }
            }
        }
    }

    /**
     * @AI-REFERENCE: HELPERS
     */
    async function saveAndClose() {
        const I18N = unsafeWindow.HWHFuncs.I18N;
        await saveCurrentStateUI();
        unsafeWindow.HWHFuncs.popup.hide();
        unsafeWindow.HWHFuncs.setProgress(I18N('CAMP_MSG_SAVED'), true);
    }

    async function getSettings(userId) {
        const all = await db.get(userId, {});
        return all.campaignAutomator || {};
    }

    async function saveCurrentStateUI(profileIndex = null) {
        const userId = unsafeWindow.HWHFuncs.getUserInfo()?.id;
        if (!userId) return;

        const el = (id) => document.getElementById(id);
        if (!el('hwh_method')) return;

        const uiState = {
            method: el('hwh_method').value,
            missionId: el('hwh_mission_id').value,
            reps: el('hwh_repetitions').value,
            energyThreshold: el('hwh_energy_threshold').value,
            autoStartEnabled: el('hwh_auto_start_toggle').checked,
            autoSyncEnabled: el('hwh_auto_sync_toggle').checked,
        };

        if (el('hwh_force_raid')) {
            uiState.forceRaid = el('hwh_force_raid').checked;
        }

        const allSettings = await db.get(userId, {});
        if (!allSettings.campaignAutomator) allSettings.campaignAutomator = {};

        Object.assign(allSettings.campaignAutomator, uiState);

        if (profileIndex) {
            if (!allSettings.campaignAutomator.profiles) allSettings.campaignAutomator.profiles = {};
            allSettings.campaignAutomator.profiles[profileIndex] = uiState;
        }

        await db.set(userId, allSettings);
    }

    function updateMissionNameDisplay() {
        const input = document.getElementById('hwh_mission_id');
        const display = document.getElementById('hwh_mission_name_display');
        if (!input || !display) return;

        const val = input.value;
        if (!val) { display.innerText = "..."; return; }

        if (val.includes(',') || val.includes('-')) {
            display.innerText = "Sequence Mode";
            return;
        }

        try {
            const name = unsafeWindow.cheats.translate("LIB_MISSION_NAME_" + parseInt(val));
            display.innerText = name.includes("LIB_") ? "Unknown ID" : name;
        } catch (e) {
            display.innerText = "";
        }
    }

    function applyVip5Rules() {
        const method = document.getElementById('hwh_method').value;
        const missionId = parseInt(document.getElementById('hwh_mission_id').value);
        const thresholdInput = document.getElementById('hwh_energy_threshold');

        if (method !== 'raid_multi' || isNaN(missionId)) return;

        let newThreshold = 0;
        if (missionId <= 84) newThreshold = 60;
        else if (missionId >= 87 && missionId <= 144) newThreshold = 80;
        else if (missionId >= 147) newThreshold = 100;

        if (newThreshold > 0 && parseInt(thresholdInput.value) < newThreshold) {
            thresholdInput.value = newThreshold;
        }
    }

    async function checkVipStatus() {
        const inventory = await unsafeWindow.Caller.send("inventoryGet");
        const userInfo = unsafeWindow.HWHFuncs.getUserInfo();
        const hasTicket = inventory.consumable && inventory.consumable[151] > 0;
        const vipPoints = parseInt(userInfo.vipPoints);
        const vipLevels = unsafeWindow.lib.data.level.vip;
        let vipLvl = 0;
        for (const lvl of Object.values(vipLevels)) {
            if (vipPoints >= lvl.vipPoints) vipLvl = lvl.level;
        }
        return {
            level: vipLvl,
            hasTicket: hasTicket,
            canRaidSingle: vipLvl >= 1 || hasTicket,
            canRaidMulti: vipLvl >= 5 || hasTicket
        };
    }

    function parseSequence(str) {
        return str.replace(/ /g, '').replace(/(\d+)-(\d+)/g, (match, start, end) =>
            Array.from({ length: end - start + 1 }, (_, i) => parseInt(start) + i).join(',')
        ).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id > 0);
    }

    async function getEnergy() {
        const info = await unsafeWindow.Send({calls:[{name:"userGetInfo", args:{}, ident:"u"}]});
        return info.results[0].result.response.refillable.find(r => r.id == 1)?.amount || 0;
    }

    async function backgroundEnergyCheck(runIfReady = false) {
        if (isAutomationRunning) return;
        const userId = unsafeWindow.HWHFuncs.getUserInfo()?.id;
        const settings = await getSettings(userId);

        if (!settings.autoStartEnabled) return;

        const energy = await getEnergy();
        if (energy >= settings.energyThreshold) {
            if (runIfReady) {
                console.log("[HWH CampAuto] Auto-Start Triggered!");
                runAutomationSequence();
            } else {
                console.log("[HWH CampAuto] Energy Ready. Waiting for trigger.");
                runAutomationSequence();
            }
        }
    }

    async function collectQuestRewards() {
        const { Send } = unsafeWindow;
        try {
            const qData = await Send({ calls: [{ name: "questGetAll", args: {}, ident: "body" }] });
            const quests = qData.results[0].result.response.filter(q => q.id < 1e6 && q.state == 2);
            if (quests.length > 0) {
                const calls = quests.map((q, i) => ({ name: "questFarm", args: { questId: q.id }, ident: "q" + i }));
                await Send({ calls });
            }
        } catch (e) { console.error("Quest Farm Error", e); }
    }

    async function exportData() {
        const userId = unsafeWindow.HWHFuncs.getUserInfo()?.id;
        const allSettings = await db.get(userId, {});
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allSettings.campaignAutomator || {}, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "hwh_campaign_settings.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    async function importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = e => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.readAsText(file, 'UTF-8');
            reader.onload = async readerEvent => {
                try {
                    const content = JSON.parse(readerEvent.target.result);
                    const userId = unsafeWindow.HWHFuncs.getUserInfo()?.id;
                    const allSettings = await db.get(userId, {});
                    allSettings.campaignAutomator = content;
                    await db.set(userId, allSettings);
                    unsafeWindow.HWHFuncs.setProgress("Data Imported! Re-open popup.", true);
                    unsafeWindow.HWHFuncs.popup.hide();
                } catch (err) {
                    alert("Invalid JSON file");
                }
            }
        }
        input.click();
    }

    async function importWebProfile(key) {
        const url = WEB_PROFILES[key];
        if (!url) return;

        unsafeWindow.HWHFuncs.setProgress(`Fetching ${key}...`, false);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network error");
            const content = await response.json();

            const userId = unsafeWindow.HWHFuncs.getUserInfo()?.id;
            const allSettings = await db.get(userId, {});
            allSettings.campaignAutomator = content;
            await db.set(userId, allSettings);

            unsafeWindow.HWHFuncs.setProgress(`${key} Imported! Re-open popup.`, true);
            unsafeWindow.HWHFuncs.popup.hide();
        } catch (e) {
            console.error(e);
            unsafeWindow.HWHFuncs.setProgress(`Error importing ${key}`, true);
        }
    }

    // --- Selectors Logic ---
    async function selectMissionFromList(id) {
        const userId = unsafeWindow.HWHFuncs.getUserInfo()?.id;
        const settings = await getSettings(userId);
        settings.missionId = id;
        const allSettings = await db.get(userId, {});
        allSettings.campaignAutomator = settings;
        await db.set(userId, allSettings);
        unsafeWindow.HWHFuncs.popup.hide();
        setTimeout(openMainPopup, 200);
    }

    async function toggleFavoriteMission(id) {
        const userId = unsafeWindow.HWHFuncs.getUserInfo()?.id;
        const allSettings = await db.get(userId, {});
        let favs = allSettings.campaignAutomator?.favorites || [];

        const isFavNow = !favs.includes(id);
        const starEl = document.getElementById(`fav_star_${id}`);
        if (starEl) {
            starEl.style.color = isFavNow ? 'gold' : 'gray';
            starEl.innerText = isFavNow ? '★' : '☆';
        }

        if (isFavNow) favs.push(id);
        else favs = favs.filter(x => x !== id);

        if (!allSettings.campaignAutomator) allSettings.campaignAutomator = {};
        allSettings.campaignAutomator.favorites = favs;
        await db.set(userId, allSettings);

        setTimeout(() => {
            const searchVal = document.getElementById('hwh_sel_search')?.value || "";
            if (unsafeWindow.HWH_CampAuto_API.renderSelector) unsafeWindow.HWH_CampAuto_API.renderSelector(searchVal);
        }, 500);
    }

})();