// ==UserScript==
// @name         HWH Time-Based Account Switcher
// @namespace    HWH.Addons
// @version      1.9.0
// @description  Manages time-based account switching with Container Isolation (LocalStorage) and Native GUI.
// @description:ru Управляет переключением учетных записей по времени с изоляцией контейнеров (LocalStorage) и нативным GUI.
// @author       HWH Extension Architect
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        unsafeWindow
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- [1] CONFIGURATION & DEBUG ---
    const DEBUG_MODE = true;

    // --- [2] STORAGE KEYS ---
    const SCRIPT_KEY = "hwh_time_switcher_key_v3_container_isolated"; // Changed key to force fresh start
    const FIXED_MASTER_KEY = "dasda%3445fsfczSGFDSFsfre252";

    // We now use localStorage for EVERYTHING to ensure Firefox Container isolation.
    // GM_storage is global across containers, which causes data mixing.
    const STORAGE_PREFIX = 'HWH_TBS_';
    const ENCRYPTED_ACCOUNTS_KEY = STORAGE_PREFIX + 'EncryptedAccounts';
    const CONFIG_CACHE_KEY = STORAGE_PREFIX + 'ConfigCache';
    const ID_EMAIL_MAP_KEY = STORAGE_PREFIX + 'IdEmailMap';
    const LOGIN_ATTEMPT_KEY = STORAGE_PREFIX + 'LoginAttempt';

    // --- [3] DOM SELECTORS ---
    const USER_MENU_ICON_SELECTOR = 'button:has(.user-control-menu-button-icon)';
    const LOGOUT_BUTTON_SELECTOR = '.sidebar__profile-user-logout-button-label';
    const EMAIL_INPUT_SELECTOR = 'input[name="email"]';
    const PASSWORD_INPUT_SELECTOR = 'input[name="password"]';
    const PLAY_BUTTON_SELECTOR = '.holder.play.login .button';

    // --- [4] STATE ---
    let accountConfigs = [];
    let idEmailMap = {};
    let isSwitching = false;

    // --- [5] UTILITY ---
    function simpleCipher(data, key) {
        let output = "";
        for (let i = 0; i < data.length; i++) output += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        return output;
    }

    function timeToMinutes(timeStr) {
        if (timeStr === '24:00') return 0;
        const parts = timeStr.split(':');
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }

    function minutesToTime(totalMinutes) {
        totalMinutes = (totalMinutes + 1440) % 1440;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    function isMinuteInInterval(minute, start, end) {
        const s = timeToMinutes(start);
        const e = timeToMinutes(end);
        return (e <= s) ? (minute >= s || minute < e) : (minute >= s && minute < e);
    }

    function logDebug(msg, ...args) {
        if (DEBUG_MODE) console.log(`[HWH-Switcher] ${msg}`, ...args);
    }

    // --- [6] STORAGE HELPERS (Container Safe) ---
    // Wrappers for localStorage to replace GM_getValue/setValue
    function storageGet(key, defaultValue) {
        const val = localStorage.getItem(key);
        return val !== null ? val : defaultValue;
    }

    function storageSet(key, value) {
        localStorage.setItem(key, value);
    }

    // --- [7] OVERLAP CHECK ---
    function checkOverlap(configs, newStart, newEnd) {
        const newS = timeToMinutes(newStart);
        const newE = timeToMinutes(newEnd);
        const isNewCross = newE <= newS;

        for (let i = 0; i < configs.length; i++) {
            const existing = configs[i];
            const exS = timeToMinutes(existing.start);
            const exE = timeToMinutes(existing.end);
            const isExCross = exE <= exS;

            const isInside = (min, s, e, cross) => cross ? (min >= s || min < e) : (min >= s && min < e);

            const startIn = isInside(newS, exS, exE, isExCross);
            const endIn = isInside((newE - 1 + 1440) % 1440, exS, exE, isExCross);
            const exStartIn = isInside(exS, newS, newE, isNewCross);

            if (startIn || endIn || exStartIn) return true;
        }
        return false;
    }

    // --- [8] TIME INPUT HANDLERS ---
    function adjustTime(input, deltaMinutes) {
        const val = input.value.trim();
        if (!/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$|^24:00$/.test(val)) return;

        let mins = (val === '24:00') ? (deltaMinutes < 0 ? 1440 : 0) : timeToMinutes(val);
        let newTime = minutesToTime(mins + deltaMinutes);

        if (newTime === '00:00' && val !== '00:01' && deltaMinutes !== 1) newTime = '24:00';
        input.value = newTime;
    }

    function handleTimeKeydown(e) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            adjustTime(e.target, e.key === 'ArrowUp' ? 1 : -1);
        }
        if (e.code === 'KeyW' || e.code === 'KeyS') {
            e.preventDefault();
            adjustTime(e.target, e.code === 'KeyW' ? 60 : -60);
        }
    }

    // --- [9] DATA MANAGEMENT ---
    function loadData() {
        // Load ID-Email Map from LocalStorage (Container Isolated)
        try {
            const mapData = storageGet(ID_EMAIL_MAP_KEY, '{}');
            idEmailMap = JSON.parse(mapData);
        } catch (e) { idEmailMap = {}; }

        // Load Configs
        try {
            const saved = storageGet(CONFIG_CACHE_KEY, null);
            const decrypted = localStorage.getItem(ENCRYPTED_ACCOUNTS_KEY);

            if (saved && decrypted) {
                const decData = JSON.parse(simpleCipher(decrypted, FIXED_MASTER_KEY + SCRIPT_KEY));
                const rawConfigs = JSON.parse(saved);

                accountConfigs = rawConfigs
                    .filter(c => c.email && c.email.trim() !== "")
                    .map(c => {
                        const creds = decData.find(d => d.email.toLowerCase() === c.email.toLowerCase());
                        return { ...c, password: creds ? creds.password : '' };
                    });
            } else {
                accountConfigs = [];
            }
        } catch (e) { console.error("Load Error:", e); accountConfigs = []; }
    }

    function saveConfigs(configs) {
        const validConfigs = configs.filter(c => c.email && c.email.trim() !== "" && c.password);

        const encData = validConfigs.map(c => ({ email: c.email, password: c.password }));
        localStorage.setItem(ENCRYPTED_ACCOUNTS_KEY, simpleCipher(JSON.stringify(encData), FIXED_MASTER_KEY + SCRIPT_KEY));

        const cacheData = validConfigs.map(c => ({ name: c.name, email: c.email, start: c.start, end: c.end }));
        storageSet(CONFIG_CACHE_KEY, JSON.stringify(cacheData));

        accountConfigs = validConfigs;
    }

    // --- [10] LOGIC: LOGIN / LOGOUT / CHECK ---
    function getCurrentAccountId() {
        const info = unsafeWindow.HWHFuncs?.getUserInfo?.();
        return (info && info.accountId) ? String(info.accountId) : null;
    }

    function performLogin(email, password) {
        if (!email || !password || email.trim() === "") return;

        logDebug(`Attempting login as ${email}...`);
        const emailIn = document.querySelector(EMAIL_INPUT_SELECTOR);
        const passIn = document.querySelector(PASSWORD_INPUT_SELECTOR);
        const btn = document.querySelector(PLAY_BUTTON_SELECTOR);

        if (emailIn && passIn && btn) {
            sessionStorage.setItem(LOGIN_ATTEMPT_KEY, email);

            emailIn.value = '';
            passIn.value = '';

            emailIn.value = email;
            passIn.value = password;
            emailIn.dispatchEvent(new Event('input', { bubbles: true }));
            passIn.dispatchEvent(new Event('input', { bubbles: true }));

            setTimeout(() => btn.click(), 100);
        } else {
            // Fallback: check if already logged in
            const curId = getCurrentAccountId();
            if (curId) {
                logDebug(`Already logged in as ID ${curId}. Mapping to ${email}.`);
                idEmailMap[curId] = email;
                storageSet(ID_EMAIL_MAP_KEY, JSON.stringify(idEmailMap));
                sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
                window.location.reload();
            } else {
                sessionStorage.setItem(LOGIN_ATTEMPT_KEY, email);
            }
        }
    }

    function performLogout() {
        logDebug("Logging out...");
        const menuBtn = document.querySelector(USER_MENU_ICON_SELECTOR);
        if (menuBtn) {
            menuBtn.click();
            setTimeout(() => {
                const logoutBtn = document.querySelector(LOGOUT_BUTTON_SELECTOR);
                if (logoutBtn) logoutBtn.click();
            }, 500);
        }
    }

    function checkAndPerformSwitch() {
        if (isSwitching) return;

        const now = new Date();
        const mins = now.getHours() * 60 + now.getMinutes();
        const target = accountConfigs.find(c => isMinuteInInterval(mins, c.start, c.end));
        const currentId = getCurrentAccountId();

        if (!unsafeWindow.HWHFuncs) return;

        // --- IDLE MODE CHECK ---
        if (!target) {
            if (sessionStorage.getItem(LOGIN_ATTEMPT_KEY)) {
                logDebug("[IDLE MODE] Clearing stale login attempt key.");
                sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
            }
            return;
        }

        if (!target.email || !target.password) return;

        const targetEmail = target.email.toLowerCase();

        // Auto-Learn Mapping
        const pendingEmail = sessionStorage.getItem(LOGIN_ATTEMPT_KEY);
        if (currentId && pendingEmail) {
            if (!idEmailMap[currentId] && pendingEmail.toLowerCase() === targetEmail) {
                logDebug(`[AUTO-LEARN] Mapping ID ${currentId} to ${targetEmail}`);
                idEmailMap[currentId] = targetEmail;
                storageSet(ID_EMAIL_MAP_KEY, JSON.stringify(idEmailMap));
            }
            sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
        }

        const currentEmail = (currentId && idEmailMap[currentId]) ? idEmailMap[currentId].toLowerCase() : null;

        if (currentEmail === targetEmail) return;

        isSwitching = true;

        if (currentId && currentEmail !== targetEmail) {
            logDebug(`Wrong account (${currentEmail || 'Unknown'}). Switching to ${targetEmail}`);
            sessionStorage.setItem(LOGIN_ATTEMPT_KEY, targetEmail);
            performLogout();
            return;
        }

        if (!currentId) {
            performLogin(target.email, target.password);
        }
    }

    // --- [11] JSON IMPORT/EXPORT ---
    function exportConfig() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(accountConfigs, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "hwh_accounts.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function validateAndLoadConfig(data) {
        if (!Array.isArray(data)) { alert("Invalid JSON format."); return false; }
        const validData = data.filter(c => c.email && c.email.trim() !== "" && c.password && c.start && c.end);
        if (validData.length === 0 && data.length > 0) { alert("No valid accounts found."); return false; }
        saveConfigs(validData);
        return true;
    }

    function importConfigFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    if (validateAndLoadConfig(JSON.parse(event.target.result))) {
                        alert("Imported! Reopening...");
                        unsafeWindow.HWHFuncs.popup.hide();
                        setTimeout(openGUI, 500);
                    }
                } catch (err) { alert("Error parsing JSON."); }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function importConfigUrl() {
        const url = prompt("Enter JSON URL:");
        if (!url) return;
        GM_xmlhttpRequest({
            method: "GET", url: url,
            onload: function(response) {
                try {
                    if (validateAndLoadConfig(JSON.parse(response.responseText))) {
                        alert("Imported! Reopening...");
                        unsafeWindow.HWHFuncs.popup.hide();
                        setTimeout(openGUI, 500);
                    }
                } catch (err) { alert("Error parsing JSON from URL."); }
            },
            onerror: function() { alert("Failed to fetch URL."); }
        });
    }

    // --- [12] GUI ---
    function renderList() {
        const cont = document.getElementById('hwh-config-list');
        if (!cont) return;
        cont.innerHTML = '';
        accountConfigs.forEach((c, i) => {
            const row = `
                <div class="c-item" data-i="${i}" style="display:flex; gap:5px; margin-bottom:5px; background:#222; padding:5px; border-radius:4px;">
                    <input class="c-name" value="${c.name||''}" placeholder="Name" style="width:15%; background:#333; color:#fff; border:1px solid #555;">
                    <input class="c-email" value="${c.email}" placeholder="Email" style="width:25%; background:#333; color:#fff; border:1px solid #555;">
                    <input class="c-pass" value="${c.password}" type="password" placeholder="Pass" style="width:20%; background:#333; color:#fff; border:1px solid #555;">

                    <div style="position:relative; width:12%;">
                        <input class="c-time t-start" value="${c.start}" style="width:100%; text-align:center; background:#333; color:#fff; border:1px solid #555; padding-left:15px; padding-right:15px;">
                        <span class="t-arr h-u" style="position:absolute; left:2px; top:0; cursor:pointer; font-size:9px; color:#aaa;">▲</span>
                        <span class="t-arr h-d" style="position:absolute; left:2px; bottom:0; cursor:pointer; font-size:9px; color:#aaa;">▼</span>
                        <span class="t-arr m-u" style="position:absolute; right:2px; top:0; cursor:pointer; font-size:9px; color:#aaa;">▲</span>
                        <span class="t-arr m-d" style="position:absolute; right:2px; bottom:0; cursor:pointer; font-size:9px; color:#aaa;">▼</span>
                    </div>

                    <span style="align-self:center;">to</span>

                    <div style="position:relative; width:12%;">
                        <input class="c-time t-end" value="${c.end}" style="width:100%; text-align:center; background:#333; color:#fff; border:1px solid #555; padding-left:15px; padding-right:15px;">
                        <span class="t-arr h-u" style="position:absolute; left:2px; top:0; cursor:pointer; font-size:9px; color:#aaa;">▲</span>
                        <span class="t-arr h-d" style="position:absolute; left:2px; bottom:0; cursor:pointer; font-size:9px; color:#aaa;">▼</span>
                        <span class="t-arr m-u" style="position:absolute; right:2px; top:0; cursor:pointer; font-size:9px; color:#aaa;">▲</span>
                        <span class="t-arr m-d" style="position:absolute; right:2px; bottom:0; cursor:pointer; font-size:9px; color:#aaa;">▼</span>
                    </div>

                    <button class="c-del" style="background:#d00; color:#fff; border:none; cursor:pointer;">X</button>
                </div>`;
            cont.insertAdjacentHTML('beforeend', row);
        });

        cont.querySelectorAll('.c-del').forEach(b => b.onclick = e => {
            accountConfigs.splice(e.target.closest('.c-item').dataset.i, 1);
            renderList();
        });
        cont.querySelectorAll('.c-time').forEach(i => i.onkeydown = handleTimeKeydown);

        cont.querySelectorAll('.t-arr.m-u').forEach(s => s.onclick = e => adjustTime(e.target.parentElement.querySelector('input'), 1));
        cont.querySelectorAll('.t-arr.m-d').forEach(s => s.onclick = e => adjustTime(e.target.parentElement.querySelector('input'), -1));
        cont.querySelectorAll('.t-arr.h-u').forEach(s => s.onclick = e => adjustTime(e.target.parentElement.querySelector('input'), 60));
        cont.querySelectorAll('.t-arr.h-d').forEach(s => s.onclick = e => adjustTime(e.target.parentElement.querySelector('input'), -60));
    }

    function openGUI() {
        const { popup } = unsafeWindow.HWHFuncs;
        popup.customPopup(async (complete) => {
            popup.setMsgText('Account Switcher (Container Isolated)');
            popup.custom.innerHTML = `
                <div style="text-align:center; color:#aaa; font-size:12px; margin-bottom:10px;">
                    Credentials encrypted in LocalStorage (Container Safe). <br>
                    <span style="color:#f04747;">Warning: Exported JSON contains plain text passwords.</span><br>
                    <span style="color:#888;">Use W/S for Hours, Arrows for Minutes.</span>
                </div>
                <div style="display:flex; gap:5px; margin-bottom:10px; justify-content:center;">
                    <button id="hwh-export" style="background:#555; color:#fff; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">Export JSON</button>
                    <button id="hwh-import-file" style="background:#555; color:#fff; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">Import File</button>
                    <button id="hwh-import-url" style="background:#555; color:#fff; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">Import URL</button>
                </div>
                <div id="hwh-config-list" style="max-height:300px; overflow-y:auto;"></div>
                <button id="hwh-add" style="width:100%; margin-top:10px; background:#484; color:#fff; border:none; padding:5px;">+ Add Account</button>
            `;
            renderList();

            popup.custom.querySelector('#hwh-add').onclick = () => {
                accountConfigs.push({ name:'', email:'', password:'', start:'00:00', end:'00:00' });
                renderList();
            };
            popup.custom.querySelector('#hwh-export').onclick = exportConfig;
            popup.custom.querySelector('#hwh-import-file').onclick = importConfigFile;
            popup.custom.querySelector('#hwh-import-url').onclick = importConfigUrl;

            const close = (val) => { unsafeWindow.HWHFuncs.popup.hide(); complete(val); };

            popup.addButton({ msg: 'Save', color: 'green' }, () => {
                const newC = [];
                let err = false;
                popup.custom.querySelectorAll('.c-item').forEach(el => {
                    const c = {
                        name: el.querySelector('.c-name').value.trim(),
                        email: el.querySelector('.c-email').value.trim(),
                        password: el.querySelector('.c-pass').value,
                        start: el.querySelector('.t-start').value,
                        end: el.querySelector('.t-end').value
                    };
                    if(!c.email || !c.password) err = true;
                    newC.push(c);
                });
                if(err) return alert('Missing fields');

                for (let i = 0; i < newC.length; i++) {
                    if (checkOverlap(newC.slice(0, i), newC[i].start, newC[i].end)) {
                         return alert(`Time overlap detected for ${newC[i].email}! Please fix intervals.`);
                    }
                }

                saveConfigs(newC);
                close(true);
            });

            popup.addButton({ msg: 'Cancel', color: 'red' }, () => close(false));
            popup.addButton({ isClose: true }, () => close(false));
            popup.show();
        });
    }

    // --- [13] INIT ---
    function init() {
        try {
            loadData();

            const curId = getCurrentAccountId();
            const attemptEmail = sessionStorage.getItem(LOGIN_ATTEMPT_KEY);

            if (curId && attemptEmail) {
                const now = new Date();
                const mins = now.getHours() * 60 + now.getMinutes();
                const cfg = accountConfigs.find(c => c.email.toLowerCase() === attemptEmail.toLowerCase());

                if (cfg && isMinuteInInterval(mins, cfg.start, cfg.end)) {
                    logDebug(`Post-logout detected & Schedule Valid. Logging in as ${attemptEmail}`);
                    performLogin(cfg.email, cfg.password);
                } else {
                    logDebug(`Post-logout detected but schedule invalid (Idle Mode). Clearing attempt.`);
                    sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
                }
            }
            else if (curId && attemptEmail) {
                sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
            }

            GM_registerMenuCommand("Account Switcher", openGUI);
            setInterval(checkAndPerformSwitch, 30000);

        } catch (e) { console.error(e); }
    }

    const loader = setInterval(() => {
        if (unsafeWindow.HWHClasses && unsafeWindow.HWHData && unsafeWindow.HWHFuncs) {
            clearInterval(loader);
            setTimeout(init, 1000);
        } else if (document.querySelector(EMAIL_INPUT_SELECTOR)) {
            clearInterval(loader);
            init();
        }
    }, 500);

})();
