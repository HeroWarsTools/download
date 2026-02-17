// ==UserScript==
// @name            HWH Titan Monitor
// @namespace       HWH_Titan_Monitor
// @version         8.0.0
// @description     Active Risk Control with Smart Start Strategy & IndexedDB
// @author          Extension Architect
// @match           https://www.hero-wars.com/*
// @match           https://apps-1701433570146040.apps.fbsbx.com/*
// @grant           unsafeWindow
// @run-at          document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- SCRIPT CONFIGURATION ---
    const DATA_SOURCE = 'HWH_TitanStats';
    const UPDATE_INTERVAL_MS = 2000;
    const CONTAINER_ID = 'hwh-titan-live-monitor-content';
    
    // DB CONFIGURATION
    const DB_NAME = "HWH_TitanMonitor_DB";
    const DB_VERSION = 2;
    const STORE_NAME = "profile";
    const OLD_STORE_NAME = "profiles";
    
    const ACTIVE_PROFILE_KEY = 'active_profile';
    const CUSTOM_DEFAULT_KEY = 'HWH_TitanMonitor_CustomDefault';

    // --- DEFAULT PROFILE (Updated for v8.0.0) ---
    const FALLBACK_DEFAULT_PROFILE = {
        name: "Default",
        weights: { hp: 1.0, energy: 0.3, buff: 1.0, deadTitan: 20 },
        thresholds: { profile4: 81, profile3: 56, profile2: 29, baseProfile: 1 },
        startStrategy: { startProfile: 4, stabilityCount: 30 } // New Strategy
    };

    let lastAppliedProfile = null;
    let currentTitanSettings = { ...FALLBACK_DEFAULT_PROFILE };
    
    // --- STATE VARIABLES ---
    let isStartModeActive = true; // Starts active by default
    let currentStabilityCount = 0;

    // --- PROFILE MANAGER (IndexedDB) ---
    unsafeWindow.HWH_Titan_ProfileManager = {
        db: null,

        async init() {
            return new Promise((resolve) => {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (db.objectStoreNames.contains(OLD_STORE_NAME)) db.deleteObjectStore(OLD_STORE_NAME);
                    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
                };
                req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
                req.onerror = (e) => { console.error("[TitanMonitor DB] Init Error", e); resolve(); };
            });
        },

        async get() {
            return new Promise((resolve) => {
                if (!this.db) return resolve(null);
                try {
                    const tx = this.db.transaction([STORE_NAME], "readonly");
                    const req = tx.objectStore(STORE_NAME).get(ACTIVE_PROFILE_KEY);
                    req.onsuccess = (e) => {
                        const data = e.target.result ? e.target.result.data : null;
                        // Merge with default to ensure new keys (startStrategy) exist
                        resolve(data ? { ...FALLBACK_DEFAULT_PROFILE, ...data, startStrategy: { ...FALLBACK_DEFAULT_PROFILE.startStrategy, ...(data.startStrategy || {}) } } : null);
                    };
                    req.onerror = () => resolve(null);
                } catch (e) { resolve(null); }
            });
        },

        async set(data) {
            return new Promise((resolve) => {
                if (!this.db) return resolve(false);
                try {
                    const tx = this.db.transaction([STORE_NAME], "readwrite");
                    tx.objectStore(STORE_NAME).put({ id: ACTIVE_PROFILE_KEY, data: data });
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (e) { resolve(false); }
            });
        }
    };

    function executeInGlobalContext(profileNum) {
        const code = `
            if (window.HWH_Dgn_Profiles && typeof window.HWH_Dgn_Profiles.apply === 'function') {
                window.HWH_Dgn_Profiles.apply(${profileNum});
                console.log('%c[Monitor Trigger] Profile ${profileNum} Applied Successfully', 'color: #8e44ad; font-weight: bold;');
            } else { console.error('[Monitor Trigger] HWH_Dgn_Profiles not found'); }
        `;
        const script = document.createElement('script');
        script.textContent = code;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    }

    // --- CORE CALCULATION ENGINE ---
    const RiskEngine = {
        // Helper to check if data is valid (Anti-False Zero)
        isValidData: function(data) {
            if (!data || !data.view) return false;
            // Check if at least one titan has HP data
            for (const element in data.view) {
                if (data.view[element].length > 0) return true;
            }
            return false;
        },

        calculate: function(data, settings) {
            if (!this.isValidData(data)) return 0;

            let minHP = 100, minEnergyElements = 1000, deadTitanCount = 0;
            const energyFilter = ['fire', 'earth', 'water'];

            for (const element in data.view) {
                const titans = data.view[element];
                titans.forEach(t => {
                    const status = t.status || "";
                    if (status === '💀') { deadTitanCount++; return; }
                    const hpMatch = status.match(/❤️(\d+)/), enMatch = status.match(/⚡(\d+)/);
                    if (hpMatch && enMatch) {
                        const hp = parseInt(hpMatch[1]), en = parseInt(enMatch[1]);
                        if (hp < minHP) minHP = hp;
                        if (energyFilter.includes(element) && en < minEnergyElements) minEnergyElements = en;
                    }
                });
            }

            const buffComponent = Math.abs(data.dungeonBuff || 0) * settings.weights.buff;
            const hpComponent = (100 - minHP) * settings.weights.hp;
            const energyComponent = ((1000 - minEnergyElements) / 10) * settings.weights.energy;
            const deadTitanComponent = deadTitanCount * settings.weights.deadTitan;
            return parseFloat(buffComponent + hpComponent + energyComponent + deadTitanComponent).toFixed(1);
        },

        handleProfileSync: function(score, data) {
            const s = currentTitanSettings;
            const hasData = this.isValidData(data);

            // 1. Calculate Theoretical Profile (Standard Logic)
            let theoreticalProfile = s.thresholds.baseProfile;
            if (score >= s.thresholds.profile4) theoreticalProfile = 4;
            else if (score >= s.thresholds.profile3) theoreticalProfile = 3;
            else if (score >= s.thresholds.profile2) theoreticalProfile = 2;

            let profileToApply = theoreticalProfile;

            // 2. Start Strategy Logic
            if (isStartModeActive && s.startStrategy.startProfile > 0) {
                const startProf = s.startStrategy.startProfile;
                const targetCount = s.startStrategy.stabilityCount;
                
                // Force Start Profile
                profileToApply = startProf;

                if (hasData) {
                    // Only advance counter if we have valid data
                    if (theoreticalProfile < startProf) {
                        // Condition met: Risk is low enough to drop profile
                        currentStabilityCount++;
                    } else {
                        // Risk is high: Reset counter
                        currentStabilityCount = 0;
                    }

                    // Check if stable enough to unlock
                    if (currentStabilityCount >= targetCount) {
                        isStartModeActive = false;
                        profileToApply = theoreticalProfile; // Switch immediately
                    }
                }
                // If !hasData, we pause (do nothing), keeping Start Profile active
            }

            // 3. Apply Profile
            if (profileToApply !== lastAppliedProfile) {
                executeInGlobalContext(profileToApply);
                lastAppliedProfile = profileToApply;
            }
        },

        getColor: function(score) {
            const s = currentTitanSettings.thresholds;
            if (score >= s.profile4) return '#ff4d4d';
            if (score >= s.profile3) return '#ff9f43';
            if (score >= s.profile2) return '#adff2f';
            return '#2ecc71';
        }
    };

    // --- UI & POPUPS ---
    function generateContentHtml(data) {
        const score = RiskEngine.calculate(data, currentTitanSettings);
        RiskEngine.handleProfileSync(score, data);
        const riskColor = RiskEngine.getColor(score);
        
        // Status Indicator Logic
        let statusHTML = '';
        if (isStartModeActive && currentTitanSettings.startStrategy.startProfile > 0) {
            statusHTML = `<div style="position: absolute; right: 15px; top: 15px; font-size: 10px; color: #fff; background: #8e44ad; padding: 2px 6px; border-radius: 4px; border: 1px solid #9b59b6;">🚀 START [${currentStabilityCount}/${currentTitanSettings.startStrategy.stabilityCount}]</div>`;
        } else {
            statusHTML = `<div style="position: absolute; right: 15px; top: 15px; font-size: 10px; color: #2ecc71; border: 1px solid #2ecc71; padding: 2px 6px; border-radius: 4px;">✅ AUTO</div>`;
        }

        const elements = [
            { key: 'water', icon: '🌊', color: '#3498db' }, { key: 'fire', icon: '🔥', color: '#e74c3c' },
            { key: 'earth', icon: '🌍', color: '#2ecc71' }, { key: 'light', icon: '☀️', color: '#f1c40f' },
            { key: 'dark', icon: '🌑', color: '#9b59b6' }
        ];

        return `
        <div style="padding: 15px; min-width: 600px; font-family: sans-serif; background: #1a1a1a; color: #eee; border-radius: 10px;">
            <div style="margin-bottom: 12px; padding: 10px; border: 2px solid ${riskColor}; border-radius: 8px; background: rgba(0,0,0,0.3); text-align: center; position: relative;">
                <div style="font-size: 10px; color: #888; text-transform: uppercase;">Titan Risk Factor</div>
                <div style="font-size: 36px; font-weight: bold; color: ${riskColor};">${score}</div>
                <div style="position: absolute; left: 15px; top: 15px; font-size: 10px; color: #888;">PROFILE ${lastAppliedProfile || '?'}</div>
                ${statusHTML}
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                ${elements.slice(0, 3).map(el => renderColumn(el, data)).join('')}
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top:10px;">
                ${elements.slice(3, 5).map(el => renderColumn(el, data)).join('')}
                ${renderBuffCard(data)}
            </div>
        </div>`;
    }

    function renderColumn(el, data) { return `<div style="flex: 1; border: 2px solid #444; border-radius: 6px; padding: 6px; background: rgba(0,0,0,0.4);"><div style="text-align: center; color: ${el.color}; font-weight: bold; border-bottom: 1px solid #555; margin-bottom: 5px; font-size: 16px;">${el.icon}</div>${(data?.view?.[el.key] || []).map(t => `<div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px;"><span style="color: #ccc; overflow: hidden; white-space: nowrap; max-width: 75px;">${t.name}</span><span style="color: #fff; font-family: monospace;">${t.status}</span></div>`).join('')}</div>`; }
    function renderBuffCard(data) { const buff = data?.dungeonBuff || 0; const color = buff < 0 ? '#e74c3c' : (buff > 0 ? '#2ecc71' : '#95a5a6'); return `<div style="flex: 1; border: 2px solid ${color}; border-radius: 6px; padding: 8px; background: rgba(0,0,0,0.6); display: flex; flex-direction: column; justify-content: center; text-align: center;"><div style="color: #f39c12; font-weight: bold; font-size: 14px;">🔮 BUFF</div><div style="font-size: 24px; font-weight: bold; color: ${color};">${buff}%</div></div>`; }

    function openLivePanel() {
        const wrapperHtml = `<div id="${CONTAINER_ID}">${generateContentHtml(unsafeWindow[DATA_SOURCE])}</div>`;
        unsafeWindow.HWHFuncs.popup.confirm(wrapperHtml, [{ result: false, isClose: true }], []);
        const footer = document.querySelector('.hwh-popup-footer');
        if (footer) footer.style.display = 'none';
        const updateTimer = setInterval(() => {
            const container = document.getElementById(CONTAINER_ID);
            if (!container) return clearInterval(updateTimer);
            container.innerHTML = generateContentHtml(unsafeWindow[DATA_SOURCE]);
        }, UPDATE_INTERVAL_MS);
    }

    async function openSettingsPanel() {
        const profile = currentTitanSettings;

        const renderInputRow = (id, label, value, step = 1) => `
            <div style="display: grid; grid-template-columns: 2fr 1fr; align-items: center; margin-bottom: 8px;">
                <label for="${id}" style="color: #ccc; font-size: 14px;">${label}</label>
                <input id="${id}" type="number" step="${step}" value="${value}" style="width: 80px; background: #333; color: #fff; border: 1px solid #555; text-align: center; padding: 5px; border-radius: 4px;">
            </div>`;

        const ioButtonsHTML = `
            <div style="display:flex; justify-content:flex-end; align-items:center; gap:5px; margin-bottom:10px;">
                <button id="ticonf_import_web1" class="hwh-io-btn" style="color:#aaffaa; border-color:#448844;">WEB</button>
                <button id="ticonf_import_web2" class="hwh-io-btn" style="color:#aaffaa; border-color:#448844;">W2</button>
                <button id="ticonf_import_web3" class="hwh-io-btn" style="color:#aaffaa; border-color:#448844;">W3</button>
                <button id="ticonf_import_file" class="hwh-io-btn" title="Import JSON">📥 IN</button>
                <button id="ticonf_export_file" class="hwh-io-btn" title="Export JSON">📤 EX</button>
            </div>`;

        const contentHTML = `
            <div style="padding: 10px; font-family: sans-serif; min-width: 650px;">
                <h3 style="color: #fde5b6; text-align: center; margin-bottom: 15px;">Titan Monitor Settings</h3>
                ${ioButtonsHTML}
                <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:5px; border:1px solid #444;">
                    <div style="display:flex; align-items:center; margin-bottom: 15px;">
                        <span style="color:#ccc; font-size:14px; margin-right: 10px;">Profile Name:</span>
                        <span id="profile_name_display" style="color:#fff; font-weight:bold; font-size:16px;">${profile.name}</span>
                        <button id="edit_profile_name_btn" class="hwh-io-btn" style="margin-left:10px; font-size:12px;">Edit</button>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                        <div>
                            <h4 style="color: #e6c300; border-bottom: 1px solid #555; padding-bottom: 5px; margin-bottom: 10px;">Risk Weights</h4>
                            ${renderInputRow('setting_weight_hp', 'Lost HP Weight', profile.weights.hp, 0.05)}
                            ${renderInputRow('setting_weight_energy', 'Lost Energy Weight', profile.weights.energy, 0.05)}
                            ${renderInputRow('setting_weight_buff', 'Dungeon Buff Weight', profile.weights.buff, 0.05)}
                            ${renderInputRow('setting_weight_dead', 'Dead Titan Penalty', profile.weights.deadTitan, 1)}
                        </div>
                        <div>
                            <h4 style="color: #e6c300; border-bottom: 1px solid #555; padding-bottom: 5px; margin-bottom: 10px;">Profile Thresholds</h4>
                            ${renderInputRow('setting_thresh_p4', 'Score for Profile 4', profile.thresholds.profile4)}
                            ${renderInputRow('setting_thresh_p3', 'Score for Profile 3', profile.thresholds.profile3)}
                            ${renderInputRow('setting_thresh_p2', 'Score for Profile 2', profile.thresholds.profile2)}
                            ${renderInputRow('setting_thresh_base', 'Base Profile', profile.thresholds.baseProfile)}
                        </div>
                        <div>
                            <h4 style="color: #8e44ad; border-bottom: 1px solid #555; padding-bottom: 5px; margin-bottom: 10px;">Start Strategy</h4>
                            ${renderInputRow('setting_start_profile', 'Start Profile (0=Off)', profile.startStrategy.startProfile, 1)}
                            ${renderInputRow('setting_stability_count', 'Stability Count', profile.startStrategy.stabilityCount, 1)}
                            <div style="font-size:10px; color:#888; margin-top:10px; line-height:1.2;">
                                Forces Start Profile until risk is low for 'Count' times. <br>
                                Pauses if no data.
                            </div>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #444; text-align: right; font-size: 14px; color: #ccc;">
                    Live Risk Factor: <span id="live_risk_factor" style="font-weight: bold; color: #fff; font-family: monospace; font-size: 16px;">...</span>
                </div>
            </div>`;

        const popupButtons = [
            { msg: 'Set as Default', result: 'default', color: 'blue' },
            { msg: 'Save & Close', result: 'save', color: 'green' },
            { result: false, isClose: true }
        ];

        const styleId = 'hwh-custom-css-titanmon';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                .hwh-io-btn {
                    cursor: pointer;
                    font-size: 11px;
                    border: 1px solid #c18550;
                    padding: 3px 8px;
                    border-radius: 4px;
                    background: #1a1a1a;
                    color: #fce1ac;
                    font-family: sans-serif;
                    font-weight: bold;
                    transition: all 0.2s;
                }
                .hwh-io-btn:hover {
                    background: #333;
                    color: #fff;
                    border-color: #e1a960;
                    box-shadow: 0 0 5px rgba(225, 169, 96, 0.5);
                }
            `;
            document.head.appendChild(style);
        }

        // --- ATTACH LISTENERS ASYNC ---
        setTimeout(() => {
            const readDOM = () => ({
                name: document.getElementById('profile_name_display').textContent,
                weights: {
                    hp: parseFloat(document.getElementById('setting_weight_hp').value),
                    energy: parseFloat(document.getElementById('setting_weight_energy').value),
                    buff: parseFloat(document.getElementById('setting_weight_buff').value),
                    deadTitan: parseFloat(document.getElementById('setting_weight_dead').value)
                },
                thresholds: {
                    profile4: parseInt(document.getElementById('setting_thresh_p4').value),
                    profile3: parseInt(document.getElementById('setting_thresh_p3').value),
                    profile2: parseInt(document.getElementById('setting_thresh_p2').value),
                    baseProfile: parseInt(document.getElementById('setting_thresh_base').value)
                },
                startStrategy: {
                    startProfile: parseInt(document.getElementById('setting_start_profile').value),
                    stabilityCount: parseInt(document.getElementById('setting_stability_count').value)
                }
            });

            const updateDOM = (data) => {
                document.getElementById('profile_name_display').textContent = data.name;
                document.getElementById('setting_weight_hp').value = data.weights.hp;
                document.getElementById('setting_weight_energy').value = data.weights.energy;
                document.getElementById('setting_weight_buff').value = data.weights.buff;
                document.getElementById('setting_weight_dead').value = data.weights.deadTitan;
                document.getElementById('setting_thresh_p4').value = data.thresholds.profile4;
                document.getElementById('setting_thresh_p3').value = data.thresholds.profile3;
                document.getElementById('setting_thresh_p2').value = data.thresholds.profile2;
                document.getElementById('setting_thresh_base').value = data.thresholds.baseProfile;
                document.getElementById('setting_start_profile').value = data.startStrategy?.startProfile || 0;
                document.getElementById('setting_stability_count').value = data.startStrategy?.stabilityCount || 30;
            };

            const updatePreview = () => {
                const liveFactorSpan = document.getElementById('live_risk_factor');
                if (!liveFactorSpan) return;
                const score = RiskEngine.calculate(unsafeWindow[DATA_SOURCE], readDOM());
                liveFactorSpan.textContent = score;
                liveFactorSpan.style.color = RiskEngine.getColor(score);
            };
            const livePreviewTimer = setInterval(updatePreview, 1000);
            unsafeWindow.HWHFuncs.popup.popUp.addEventListener('DOMNodeRemoved', () => clearInterval(livePreviewTimer), { once: true });
            updatePreview();

            const editBtn = document.getElementById('edit_profile_name_btn');
            if (editBtn) {
                editBtn.onclick = async () => {
                    const tempProfile = readDOM();
                    const newName = await unsafeWindow.HWHFuncs.popup.confirm("Enter new profile name:", [{ msg: 'Save', isInput: true, default: tempProfile.name, color: 'green' }]);
                    if (newName && typeof newName === 'string') {
                        tempProfile.name = newName;
                    }
                    currentTitanSettings = tempProfile;
                    await openSettingsPanel();
                };
            }

            const setupWebImport = (btnId, url, label) => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.onclick = async () => {
                        if (!confirm(`Download and apply profile from ${label}?`)) return;
                        try {
                            const rawUrl = url.replace('/blob/', '/raw/');
                            const response = await fetch(rawUrl);
                            if (!response.ok) throw new Error(`Network Error: ${response.statusText}`);
                            const data = await response.json();
                            updateDOM(data); 
                            currentTitanSettings = data; 
                            unsafeWindow.HWHFuncs.popup.show(`Imported from ${label}!`, 1500);
                        } catch (e) { alert(`Web Import Failed: ${e.message}`); }
                    };
                }
            };
            setupWebImport('ticonf_import_web1', 'https://github.com/HeroWarsTools/dungeon/blob/main/TiConf.json', 'WEB');
            setupWebImport('ticonf_import_web2', 'https://github.com/HeroWarsTools/dungeon/blob/main/TiConf.json', 'W2');
            setupWebImport('ticonf_import_web3', 'https://github.com/HeroWarsTools/dungeon/blob/main/TiConf.json', 'W3');

            const exportBtn = document.getElementById('ticonf_export_file');
            if (exportBtn) {
                exportBtn.onclick = () => {
                    const data = JSON.stringify(readDOM(), null, 2);
                    const blob = new Blob([data], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob); a.download = `HWH_TitanMonitor_Profile.json`; a.click(); URL.revokeObjectURL(a.href);
                };
            }

            const importBtn = document.getElementById('ticonf_import_file');
            if (importBtn) {
                importBtn.onclick = () => {
                    const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
                    input.onchange = (e) => {
                        const file = e.target.files[0]; if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (re) => {
                            try {
                                const data = JSON.parse(re.target.result);
                                updateDOM(data);
                                currentTitanSettings = data;
                                unsafeWindow.HWHFuncs.popup.show('Profile Imported!', 1500);
                            } catch (err) { alert("Error importing: " + err.message); }
                        };
                        reader.readAsText(file);
                    };
                    input.click();
                };
            }

        }, 200);

        const action = await unsafeWindow.HWHFuncs.popup.confirm(contentHTML, popupButtons);

        const readDOMProfile = () => ({
            name: document.getElementById('profile_name_display').textContent,
            weights: {
                hp: parseFloat(document.getElementById('setting_weight_hp').value),
                energy: parseFloat(document.getElementById('setting_weight_energy').value),
                buff: parseFloat(document.getElementById('setting_weight_buff').value),
                deadTitan: parseFloat(document.getElementById('setting_weight_dead').value)
            },
            thresholds: {
                profile4: parseInt(document.getElementById('setting_thresh_p4').value),
                profile3: parseInt(document.getElementById('setting_thresh_p3').value),
                profile2: parseInt(document.getElementById('setting_thresh_p2').value),
                baseProfile: parseInt(document.getElementById('setting_thresh_base').value)
            },
            startStrategy: {
                startProfile: parseInt(document.getElementById('setting_start_profile').value),
                stabilityCount: parseInt(document.getElementById('setting_stability_count').value)
            }
        });

        if (action === 'save') {
            const newProfile = readDOMProfile();
            await unsafeWindow.HWH_Titan_ProfileManager.set(newProfile);
            currentTitanSettings = newProfile;
            unsafeWindow.HWHFuncs.popup.show('Profile Saved!', 1500);
        } else if (action === 'default') {
            const newDefault = readDOMProfile();
            localStorage.setItem(CUSTOM_DEFAULT_KEY, JSON.stringify(newDefault));
            unsafeWindow.HWHFuncs.popup.show('New Default Set!', 1500);
        }
    }

    // --- INITIALIZATION ---
    async function init() {
        await unsafeWindow.HWH_Titan_ProfileManager.init();

        let loadedProfile = await unsafeWindow.HWH_Titan_ProfileManager.get();
        if (!loadedProfile) {
            try {
                const customDefault = JSON.parse(localStorage.getItem(CUSTOM_DEFAULT_KEY));
                if (customDefault) loadedProfile = customDefault;
            } catch (e) { /* ignore */ }
        }
        // Merge loaded profile with default structure to ensure startStrategy exists
        currentTitanSettings = loadedProfile 
            ? { ...FALLBACK_DEFAULT_PROFILE, ...loadedProfile, startStrategy: { ...FALLBACK_DEFAULT_PROFILE.startStrategy, ...(loadedProfile.startStrategy || {}) } }
            : { ...FALLBACK_DEFAULT_PROFILE };

        if (!unsafeWindow.HWHData?.buttons) return;

        const { buttons } = unsafeWindow.HWHData;
        const I18N = unsafeWindow.HWHFuncs.I18N;

        // --- INJECT TiConf BUTTON INTO ToE GROUP ---
        if (buttons.testTitanArena && buttons.testTitanArena.isCombine) {
            buttons.testTitanArena.combineList.splice(1, 0, {
                name: '⚙️', color: 'blue', title: 'Titan Monitor Config',
                onClick: openSettingsPanel
            });
        }

        // --- CREATE Rew & Mail + TiStats GROUP ---
        if (buttons.rewardsAndMailFarm) {
            const originalButton = buttons.rewardsAndMailFarm;
            buttons.rewardsAndMailFarm = {
                isCombine: true,
                combineList: [
                    { get name() { return "Rew & Mail"; }, get title() { return I18N('REWARDS_AND_MAIL_TITLE'); }, onClick: originalButton.onClick },
                    { name: '📊', color: '#8e44ad', title: 'Titan Live Stats', onClick: openLivePanel }
                ]
            };
        }
    }

    const loader = setInterval(() => {
        if (unsafeWindow.HWHClasses && unsafeWindow.HWHData && unsafeWindow.HWHFuncs) {
            clearInterval(loader);
            setTimeout(init, 1000);
        }
    }, 500);
})();
