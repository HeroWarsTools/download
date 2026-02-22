// ==UserScript==
// @name         HWH Time-Based Account Switcher
// @namespace    HWH.Addons
// @version      2.4.0
// @description  Advanced switcher with DOM Email Extraction, Tri-trigger Auto-fill, Single-line GUI.
// @description:ru Продвинутый переключатель с извлечением Email из DOM, тройным автозаполнением и однострочным GUI.
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
    const SCRIPT_KEY = "hwh_time_switcher_key_v3_container_isolated";
    const FIXED_MASTER_KEY = "dasda%3445fsfczSGFDSFsfre252";

    const STORAGE_PREFIX = 'HWH_TBS_V2_';
    const CONFIG_KEY = STORAGE_PREFIX + 'Configuration';
    const KNOWN_ACCOUNTS_KEY = STORAGE_PREFIX + 'KnownAccounts';
    const KNOWN_CHARACTERS_KEY = STORAGE_PREFIX + 'KnownCharacters';
    const LOGIN_ATTEMPT_KEY = STORAGE_PREFIX + 'LoginAttempt';

    // --- [3] DOM SELECTORS ---
    const USER_MENU_ICON_SELECTOR = 'button:has(.user-control-menu-button-icon)';
    const LOGOUT_BUTTON_SELECTOR = '.sidebar__profile-user-logout-button-label';
    const EMAIL_INPUT_SELECTOR = 'input[name="email"]';
    const PASSWORD_INPUT_SELECTOR = 'input[name="password"]';
    const PLAY_BUTTON_SELECTOR = '.holder.play.login .button';

    // --- [4] STATE ---
    let accountConfigs = [];
    let knownAccounts = [];
    let knownCharacters = [];
    let isSwitching = false;
    let isAutofillEnabled = true;

    // --- [5] UTILITY ---
    function simpleCipher(data, key, encrypt = true) {
        if (!data) return "";
        try {
            if (encrypt) {
                let output = "";
                for (let i = 0; i < data.length; i++) output += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
                return btoa(output);
            } else {
                let binary = atob(data);
                let output = "";
                for (let i = 0; i < binary.length; i++) output += String.fromCharCode(binary.charCodeAt(i) ^ key.charCodeAt(i % key.length));
                return output;
            }
        } catch (e) {
            console.error("Cipher error:", e);
            return "";
        }
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

    // --- [6] OVERLAP CHECK ---
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

    // --- [7] TIME INPUT HANDLERS ---
    function adjustTime(input, deltaMinutes) {
        const val = input.value.trim();
        if (!/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$|^24:00$/.test(val)) return;
        let mins = (val === '24:00') ? (deltaMinutes < 0 ? 1440 : 0) : timeToMinutes(val);
        let newTime = minutesToTime(mins + deltaMinutes);
        if (newTime === '00:00' && val !== '00:01' && deltaMinutes !== 1) newTime = '24:00';
        input.value = newTime;
    }

    function handleTimeKeydown(e) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); adjustTime(e.target, e.key === 'ArrowUp' ? 1 : -1); }
        if (e.code === 'KeyW' || e.code === 'KeyS') { e.preventDefault(); adjustTime(e.target, e.code === 'KeyW' ? 60 : -60); }
    }

    // --- [8] DATA MANAGEMENT & LEARNING ---
    function loadData() {
        try {
            knownAccounts = JSON.parse(localStorage.getItem(KNOWN_ACCOUNTS_KEY) || '[]');
            knownCharacters = JSON.parse(localStorage.getItem(KNOWN_CHARACTERS_KEY) || '[]');
            const encryptedConfigs = localStorage.getItem(CONFIG_KEY);
            if (encryptedConfigs) {
                const decrypted = simpleCipher(encryptedConfigs, FIXED_MASTER_KEY + SCRIPT_KEY, false);
                accountConfigs = JSON.parse(decrypted);
            }
        } catch (e) {
            console.error("Load Data Error:", e);
            accountConfigs = []; knownAccounts = []; knownCharacters = [];
        }
    }

    function saveConfigs(configs) {
        const validConfigs = configs.filter(c => c.email && c.password && c.start && c.end);
        const encrypted = simpleCipher(JSON.stringify(validConfigs), FIXED_MASTER_KEY + SCRIPT_KEY, true);
        localStorage.setItem(CONFIG_KEY, encrypted);
        accountConfigs = validConfigs;
    }

    // NEW: Extract Email from DOM if missing
    function extractEmailFromDOM(accountId) {
        const menuBtn = document.querySelector(USER_MENU_ICON_SELECTOR);
        if (!menuBtn) return;

        logDebug("Opening menu to extract email...");
        menuBtn.click();

        setTimeout(() => {
            const emailElement = document.querySelector('.sidebar__profile-data-meta-name');
            let foundEmail = "";

            if (emailElement && emailElement.textContent.includes('@')) {
                foundEmail = emailElement.textContent.trim();
            } else {
                const allElements = Array.from(document.querySelectorAll('.sidebar__profile-user-info *'));
                const fallbackEl = allElements.find(el => el.children.length === 0 && el.textContent.includes('@'));
                if (fallbackEl) foundEmail = fallbackEl.textContent.trim();
            }

            if (foundEmail) {
                logDebug("Learned email from DOM: " + foundEmail);
                let acc = knownAccounts.find(a => String(a.accountId) === String(accountId));
                if (acc) {
                    acc.email = foundEmail;
                } else {
                    knownAccounts.push({ email: foundEmail, accountId: String(accountId), password: '' });
                }
                localStorage.setItem(KNOWN_ACCOUNTS_KEY, JSON.stringify(knownAccounts));
            }

            menuBtn.click(); // Close menu
        }, 800);
    }

    function learnFromUserInfo(userInfo) {
        if (!userInfo || !userInfo.accountId) return;

        // FIX: Use serverId instead of server
        const { accountId, id, name, serverId } = userInfo;

        // 1. Learn Character
        let char = knownCharacters.find(c => String(c.id) === String(id));
        if (char) {
            char.name = name; char.serverId = serverId; char.accountId = accountId;
        } else {
            knownCharacters.push({ id, name, serverId, accountId });
        }
        localStorage.setItem(KNOWN_CHARACTERS_KEY, JSON.stringify(knownCharacters));

        // 2. Check if we know the email for this accountId
        let acc = knownAccounts.find(a => String(a.accountId) === String(accountId));
        if (!acc || !acc.email) {
            // If we don't know the email, extract it from the DOM
            extractEmailFromDOM(accountId);
        }
    }

    function learnFromGUI(configs) {
        configs.forEach(c => {
            if (c.email && c.accountId) {
                let acc = knownAccounts.find(a => String(a.accountId) === String(c.accountId));
                if (acc) { acc.email = c.email; acc.password = c.password; }
                else { knownAccounts.push({ email: c.email, accountId: c.accountId, password: c.password }); }
            }
            if (c.id && c.name && c.serverId && c.accountId) {
                let char = knownCharacters.find(ch => String(ch.id) === String(c.id));
                if (char) { char.name = c.name; char.serverId = c.serverId; char.accountId = c.accountId; }
                else { knownCharacters.push({ id: c.id, name: c.name, serverId: c.serverId, accountId: c.accountId }); }
            }
        });
        localStorage.setItem(KNOWN_ACCOUNTS_KEY, JSON.stringify(knownAccounts));
        localStorage.setItem(KNOWN_CHARACTERS_KEY, JSON.stringify(knownCharacters));
    }

    // --- [9] LOGIC: LOGIN / LOGOUT / CHECK ---
    function getCurrentUserInfo() {
        return unsafeWindow.HWHFuncs?.getUserInfo?.();
    }

    function performLogin(email, password) {
        if (!email || !password) return;
        logDebug(`Attempting login as ${email}...`);
        sessionStorage.setItem(LOGIN_ATTEMPT_KEY, email);

        const emailIn = document.querySelector(EMAIL_INPUT_SELECTOR);
        const passIn = document.querySelector(PASSWORD_INPUT_SELECTOR);
        const btn = document.querySelector(PLAY_BUTTON_SELECTOR);

        if (emailIn && passIn && btn) {
            emailIn.value = ''; passIn.value = '';
            emailIn.value = email; passIn.value = password;
            emailIn.dispatchEvent(new Event('input', { bubbles: true }));
            passIn.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => btn.click(), 100);
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

        const userInfo = getCurrentUserInfo();
        if (userInfo) learnFromUserInfo(userInfo);

        const now = new Date();
        const mins = now.getHours() * 60 + now.getMinutes();
        const target = accountConfigs.find(c => isMinuteInInterval(mins, c.start, c.end));

        if (!unsafeWindow.HWHFuncs) return;

        if (!target || !target.email || !target.password) {
            if (sessionStorage.getItem(LOGIN_ATTEMPT_KEY)) {
                sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
            }
            return;
        }

        const targetAccountId = target.accountId;
        const targetId = target.id;
        const currentAccountId = userInfo ? String(userInfo.accountId) : null;
        const currentId = userInfo ? String(userInfo.id) : null;

        let isAccountCorrect = false;
        if (targetAccountId && currentAccountId) {
            isAccountCorrect = (targetAccountId === currentAccountId);
        } else {
            const knownAcc = knownAccounts.find(a => String(a.accountId) === currentAccountId);
            const currentEmail = knownAcc ? knownAcc.email.toLowerCase() : null;
            isAccountCorrect = (currentEmail === target.email.toLowerCase());
        }

        if (!isAccountCorrect) {
            isSwitching = true;
            if (currentAccountId) {
                logDebug(`Wrong account. Logging out to switch to ${target.email}`);
                sessionStorage.setItem(LOGIN_ATTEMPT_KEY, target.email);
                performLogout();
            } else {
                logDebug(`Not logged in. Logging in as ${target.email}`);
                performLogin(target.email, target.password);
            }
            return;
        }

        if (targetId && currentId !== targetId) {
            isSwitching = true;
            logDebug(`Correct account, wrong server. Switching to ID ${targetId}`);
            unsafeWindow.Caller.send({ name: 'userChange', args: { id: targetId } })
                .then(() => window.location.reload())
                .catch(err => { console.error("Server switch failed:", err); isSwitching = false; });
            return;
        }
    }

    // --- [10] JSON IMPORT/EXPORT ---
    function exportConfig() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(accountConfigs, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "hwh_accounts_advanced.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function validateAndLoadConfig(data) {
        if (!Array.isArray(data)) { alert("Invalid JSON format."); return false; }
        const validData = data.filter(c => c.email && c.password && c.start && c.end);
        if (validData.length === 0 && data.length > 0) { alert("No valid accounts found."); return false; }
        saveConfigs(validData);
        learnFromGUI(validData);
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

    // --- [11] GUI & AUTO-FILL 3.0 ---
    function generateDatalists() {
        let html = '<datalist id="hwh-email-list">';
        knownAccounts.forEach(acc => { if (acc.email) html += `<option value="${acc.email}">`; });
        html += '</datalist><datalist id="hwh-name-list">';
        knownCharacters.forEach(char => { if (char.name) html += `<option value="${char.name}">${char.name} (Srv: ${char.serverId})</option>`; });
        html += '</datalist><datalist id="hwh-id-list">';
        knownCharacters.forEach(char => { if (char.id) html += `<option value="${char.id}">${char.name} (Srv: ${char.serverId})</option>`; });
        html += '</datalist>';
        return html;
    }

    function validateRowColors(row) {
        const emailIn = row.querySelector('.c-email');
        const accIdIn = row.querySelector('.c-accountId');
        const nameIn = row.querySelector('.c-name');
        const idIn = row.querySelector('.c-id');
        const srvIn = row.querySelector('.c-server');

        [emailIn, accIdIn, nameIn, idIn, srvIn].forEach(el => el.style.backgroundColor = '#333');

        let acc = knownAccounts.find(a => a.email === emailIn.value.trim() && String(a.accountId) === accIdIn.value.trim());
        if (acc && emailIn.value.trim() !== '') {
            emailIn.style.backgroundColor = 'rgba(0, 128, 0, 0.4)';
            accIdIn.style.backgroundColor = 'rgba(0, 128, 0, 0.4)';
        }

        let char = knownCharacters.find(c => String(c.id) === idIn.value.trim() && c.name === nameIn.value.trim() && String(c.serverId) === srvIn.value.trim());
        if (char && idIn.value.trim() !== '') {
            nameIn.style.backgroundColor = 'rgba(0, 128, 0, 0.4)';
            idIn.style.backgroundColor = 'rgba(0, 128, 0, 0.4)';
            srvIn.style.backgroundColor = 'rgba(0, 128, 0, 0.4)';
        }
    }

    function applyAutofill(row, triggerField, value) {
        if (!isAutofillEnabled || !value) {
            validateRowColors(row);
            return;
        }

        if (triggerField === 'email') {
            const acc = knownAccounts.find(a => a.email === value);
            if (acc) {
                if (acc.accountId) row.querySelector('.c-accountId').value = acc.accountId;
                if (acc.password) row.querySelector('.c-pass').value = acc.password;
            }
        }
        else if (triggerField === 'name') {
            const char = knownCharacters.find(c => c.name === value);
            if (char) {
                row.querySelector('.c-id').value = char.id;
                row.querySelector('.c-server').value = char.serverId;
                if (char.accountId) {
                    row.querySelector('.c-accountId').value = char.accountId;
                    const acc = knownAccounts.find(a => String(a.accountId) === String(char.accountId));
                    if (acc) {
                        row.querySelector('.c-email').value = acc.email;
                        if (acc.password) row.querySelector('.c-pass').value = acc.password;
                    }
                }
            }
        }
        else if (triggerField === 'id') {
            const char = knownCharacters.find(c => String(c.id) === String(value));
            if (char) {
                row.querySelector('.c-name').value = char.name;
                row.querySelector('.c-server').value = char.serverId;
                if (char.accountId) {
                    row.querySelector('.c-accountId').value = char.accountId;
                    const acc = knownAccounts.find(a => String(a.accountId) === String(char.accountId));
                    if (acc) {
                        row.querySelector('.c-email').value = acc.email;
                        if (acc.password) row.querySelector('.c-pass').value = acc.password;
                    }
                }
            }
        }

        validateRowColors(row);
    }

    function renderList() {
        const cont = document.getElementById('hwh-config-list');
        if (!cont) return;
        cont.innerHTML = '';
        accountConfigs.forEach((c, i) => {
            // FIX: Single line layout using flex-wrap: nowrap and min-width
            const rowHTML = `
                <div class="c-item" data-i="${i}" style="display:flex; flex-wrap:nowrap; gap:4px; margin-bottom:5px; background:#222; padding:5px; border-radius:4px; align-items:center;">
                    <input class="c-email" list="hwh-email-list" value="${c.email||''}" placeholder="Email" style="flex:2; min-width:0; background:#333; color:#fff; border:1px solid #555; padding:3px;">
                    <input class="c-pass" value="${c.password||''}" type="password" placeholder="Pass" style="flex:1.5; min-width:0; background:#333; color:#fff; border:1px solid #555; padding:3px;">
                    <input class="c-accountId" value="${c.accountId||''}" placeholder="Acc ID" style="flex:1.5; min-width:0; background:#333; color:#fff; border:1px solid #555; padding:3px;">
                    <input class="c-name" list="hwh-name-list" value="${c.name||''}" placeholder="Char Name" style="flex:1.5; min-width:0; background:#333; color:#fff; border:1px solid #555; padding:3px;">
                    <input class="c-id" list="hwh-id-list" value="${c.id||''}" placeholder="Player ID" style="flex:1.5; min-width:0; background:#333; color:#fff; border:1px solid #555; padding:3px;">
                    <input class="c-server" value="${c.serverId||''}" placeholder="Srv" style="width:40px; min-width:40px; background:#333; color:#fff; border:1px solid #555; padding:3px; text-align:center;">

                    <div style="position:relative; width:70px; min-width:70px;">
                        <input class="c-time t-start" value="${c.start||'00:00'}" style="width:100%; text-align:center; background:#333; color:#fff; border:1px solid #555; padding:3px 10px; box-sizing:border-box;">
                        <span class="t-arr h-u" style="position:absolute; left:2px; top:0; cursor:pointer; font-size:9px; color:#aaa;">▲</span><span class="t-arr h-d" style="position:absolute; left:2px; bottom:0; cursor:pointer; font-size:9px; color:#aaa;">▼</span>
                        <span class="t-arr m-u" style="position:absolute; right:2px; top:0; cursor:pointer; font-size:9px; color:#aaa;">▲</span><span class="t-arr m-d" style="position:absolute; right:2px; bottom:0; cursor:pointer; font-size:9px; color:#aaa;">▼</span>
                    </div>
                    <span style="color:#888; font-size:10px;">to</span>
                    <div style="position:relative; width:70px; min-width:70px;">
                        <input class="c-time t-end" value="${c.end||'00:00'}" style="width:100%; text-align:center; background:#333; color:#fff; border:1px solid #555; padding:3px 10px; box-sizing:border-box;">
                        <span class="t-arr h-u" style="position:absolute; left:2px; top:0; cursor:pointer; font-size:9px; color:#aaa;">▲</span><span class="t-arr h-d" style="position:absolute; left:2px; bottom:0; cursor:pointer; font-size:9px; color:#aaa;">▼</span>
                        <span class="t-arr m-u" style="position:absolute; right:2px; top:0; cursor:pointer; font-size:9px; color:#aaa;">▲</span><span class="t-arr m-d" style="position:absolute; right:2px; bottom:0; cursor:pointer; font-size:9px; color:#aaa;">▼</span>
                    </div>
                    <button class="c-del" style="background:#d00; color:#fff; border:none; cursor:pointer; border-radius:3px; padding:3px 6px;">X</button>
                </div>`;
            cont.insertAdjacentHTML('beforeend', rowHTML);
            validateRowColors(cont.lastElementChild);
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

        cont.querySelectorAll('.c-email, .c-name, .c-id').forEach(input => {
            input.oninput = (e) => {
                const row = e.target.closest('.c-item');
                let field = 'email';
                if (e.target.classList.contains('c-name')) field = 'name';
                if (e.target.classList.contains('c-id')) field = 'id';
                applyAutofill(row, field, e.target.value.trim());
            };
        });

        cont.querySelectorAll('.c-accountId, .c-server').forEach(input => {
            input.oninput = (e) => validateRowColors(e.target.closest('.c-item'));
        });
    }

    function openGUI() {
        const { popup } = unsafeWindow.HWHFuncs;
        popup.customPopup(async (complete) => {
            popup.setMsgText('Account & Server Switcher');

            const datalistsHTML = generateDatalists();

            popup.custom.innerHTML = datalistsHTML + `
                <div style="text-align:center; color:#aaa; font-size:12px; margin-bottom:10px;">
                    <label style="color:#fce1ac; font-weight:bold; cursor:pointer;"><input type="checkbox" id="hwh-autofill-toggle" ${isAutofillEnabled ? 'checked' : ''}> Enable Auto-fill & Suggestions</label><br>
                    <span style="color:#888;">Type Email, Char Name, or ID. Green fields indicate verified data.</span>
                </div>
                <div style="display:flex; gap:5px; margin-bottom:10px; justify-content:center;">
                    <button id="hwh-export" style="background:#555; color:#fff; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">Export JSON</button>
                    <button id="hwh-import-file" style="background:#555; color:#fff; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">Import File</button>
                    <button id="hwh-import-url" style="background:#555; color:#fff; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">Import URL</button>
                </div>
                <div id="hwh-config-list" style="max-height:400px; overflow-y:auto; padding-right:5px; min-width: 800px;"></div>
                <button id="hwh-add" style="width:100%; margin-top:10px; background:#484; color:#fff; border:none; padding:5px; border-radius:3px; cursor:pointer;">+ Add Rule</button>
            `;
            renderList();

            popup.custom.querySelector('#hwh-add').onclick = () => {
                accountConfigs.push({ email:'', password:'', accountId:'', id:'', name:'', serverId:'', start:'00:00', end:'00:00' });
                renderList();
            };
            popup.custom.querySelector('#hwh-autofill-toggle').onchange = (e) => { isAutofillEnabled = e.target.checked; };
            popup.custom.querySelector('#hwh-export').onclick = exportConfig;
            popup.custom.querySelector('#hwh-import-file').onclick = importConfigFile;
            popup.custom.querySelector('#hwh-import-url').onclick = importConfigUrl;

            const close = (val) => { unsafeWindow.HWHFuncs.popup.hide(); complete(val); };

            popup.addButton({ msg: 'Save', color: 'green' }, () => {
                const newConfigs = [];
                let err = false;
                popup.custom.querySelectorAll('.c-item').forEach(el => {
                    const c = {
                        email: el.querySelector('.c-email').value.trim(),
                        password: el.querySelector('.c-pass').value,
                        accountId: el.querySelector('.c-accountId').value.trim(),
                        id: el.querySelector('.c-id').value.trim(),
                        name: el.querySelector('.c-name').value.trim(),
                        serverId: el.querySelector('.c-server').value.trim(),
                        start: el.querySelector('.t-start').value,
                        end: el.querySelector('.t-end').value
                    };
                    if(!c.email || !c.password) err = true;
                    newConfigs.push(c);
                });

                if(err) return alert('Email and Password are required for all rules.');

                for (let i = 0; i < newConfigs.length; i++) {
                    if (checkOverlap(newConfigs.slice(0, i), newConfigs[i].start, newConfigs[i].end)) {
                         return alert(`Time overlap detected for ${newConfigs[i].email || 'a rule'}! Please fix intervals.`);
                    }
                }

                saveConfigs(newConfigs);
                learnFromGUI(newConfigs);
                close(true);
            });

            popup.addButton({ msg: 'Cancel', color: 'red' }, () => close(false));
            popup.addButton({ isClose: true }, () => close(false));
            popup.show();
        });
    }

    // --- [12] INIT ---
    function init() {
        try {
            loadData();

            const userInfo = getCurrentUserInfo();
            const attemptEmail = sessionStorage.getItem(LOGIN_ATTEMPT_KEY);

            if (userInfo) {
                learnFromUserInfo(userInfo);
                if (attemptEmail) sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
            } else if (attemptEmail) {
                const now = new Date();
                const mins = now.getHours() * 60 + now.getMinutes();
                const cfg = accountConfigs.find(c => c.email.toLowerCase() === attemptEmail.toLowerCase());

                if (cfg && isMinuteInInterval(mins, cfg.start, cfg.end)) {
                    logDebug(`Post-logout detected. Logging in as ${attemptEmail}`);
                    performLogin(cfg.email, cfg.password);
                } else {
                    logDebug(`Post-logout detected but schedule invalid. Clearing attempt.`);
                    sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
                }
            }

            GM_registerMenuCommand("Account/Server Switcher", openGUI);
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