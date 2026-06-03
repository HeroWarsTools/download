// ==UserScript==
// @name         switch_Titan_panel
// @namespace    http://tampermonkey.net/
// @version      4.0.5 buffs
// @description  Pannello di monitoraggio avanzato con sistema di auto-profiling e calcolatrice di rischio integrata.
// @author       Gemini & You
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ===============================================
    // Impostazioni del Pannello (Posizione, Dimensioni, etc.)
    // ===============================================
    function savePanelSettings(settings) { GM_setValue('titanDungeonPanelSettings_v2', JSON.stringify(settings)); }
    function loadPanelSettings() {
        const defaultSettings = {
            left: 'auto', right: '50px', top: '20px',
            width: '500px', height: '90vh',
            minimized: false, collapsed: false, zoomLevel: 1.0,
            titanSectionHeight: '60%',
            dungeonSectionHeight: '40%'
        };
        const savedSettings = GM_getValue('titanDungeonPanelSettings_v2', null);
        return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    }
    let panelSettings = loadPanelSettings();
    const BASE_FONT_SIZE = 12;

    // ===============================================
    // Auto-Profiler System
    // ===============================================
    const AutoProfiler = {
        defaults: {
            enabled: true,
            hysteresisThreshold: 10,
            weights: { avgHealth: 1.0, minHealth: 1.8, deadTitan: 50, avgEnergy: 0.4, healingBuff: 2.1 },
            profileThresholds: [
                { maxScore: 40, profile: 0 },  // SWITCH: Profile 0 = RED engine
                { maxScore: 70, profile: 3 },  // Profiles 1-2 disabled, jump to 3
                { maxScore: 95, profile: 4 },
                { maxScore: 120, profile: 5 },
                { maxScore: 150, profile: 6 },
                { maxScore: 200, profile: 7 },
                { maxScore: 999, profile: 8 }
            ]
        },
        settings: {},
        lastTitanData: null, lastProgressData: null, lastFloorData: null,
        titaniteHistory: [],
        currentRiskScore: null, currentProfile: 0, scoreBreakdown: {},
        isSimulatorActive: false, lastEngineSwitch: 0, engineSwitchCooldown: 30000,
        lastMaxTitanite: null, _lastHealingBuff: 0, _switchInProgress: false,

        init() {
            this.loadSettings();
            document.addEventListener('titanStatesUpdated', (e) => this.onDataUpdate(e.detail, 'titans'));
            document.addEventListener('dungeonProgressUpdated', (e) => this.onDataUpdate(e.detail, 'progress'));
            document.addEventListener('floorChanged', (e) => this.onDataUpdate(e.detail, 'floor'));
            // -- FIX: Se l'utente forza un profilo, resettiamo lo stato interno per permettere nuovi scatti
            document.addEventListener('manualProfileChanged', () => { this.currentProfile = 0; });
            // SWITCH: Safe Start uses Profile 0 (RED). When data arrives, will recalculate.
            if (this.settings.enabled) {
                // SWITCH: Force initial dispatch of current profile (RED/profile 0 by default)
                this.dispatchEngineCommand(true);
                this.evaluateProfileChange();
                setInterval(() => {
                    if (this.settings.enabled) {
                        // Skip profile evaluation while engine is busy or switch is in progress
                        if (!this._switchInProgress && !unsafeWindow.__engineBusy) {
                            this.evaluateProfileChange();
                        }

                        if (this.currentProfile > 0 && this.evo1ActiveProfile && this.evo1ActiveProfile !== this.currentProfile) {
                            // Only re-sync if engine is idle (avoid divergence spam during battles)
                            if (unsafeWindow.__engineBusy) return;
                            console.log(`[AutoProfiler] Evo1 divergence detected. Expected: ${this.currentProfile}, Evo1 reports: ${this.evo1ActiveProfile}. Re-syncing...`);
                            this.dispatchEngineCommand();
                        }
                    }
                }, 5000);
            }

            // Ascolta lo stato di Evo1
            document.addEventListener('dungeonProfileState', (e) => {
                if (e.detail && e.detail.profileNumber !== undefined) {
                    this.evo1ActiveProfile = e.detail.profileNumber;
                }
            });
        },

        // SWITCH: Dispatch the correct engine command based on profile
        dispatchEngineCommand(force = false) {
            // Cancel any pending scheduled switch
            if (this._pendingSwitchTimer) {
                clearTimeout(this._pendingSwitchTimer);
                this._pendingSwitchTimer = null;
            }

            if (force) {
                // Immediate execution (used for initialization, no waiting)
                this._switchInProgress = true;
                this._executeEngineSwitch();
                this._switchInProgress = false;
                return;
            }

            this._switchInProgress = true;
            // Capture the profile at call time
            const targetProfile = this.currentProfile;

            // Polling checker: battle timer → cooldown → engineBusy → +5s delay
            const checkAndSchedule = () => {
                const now = Date.now();

                // 1. Read the anti-cheat battle timer from DOM (div.scriptMenu_status)
                //    More precise than a blind cooldown: wait for it to expire + 1s
                const timerEl = document.querySelector('.scriptMenu_status');
                const text = timerEl?.innerText?.trim() || '';
                const isDungeonTimer = text && !timerEl.classList.contains('scriptMenu_statusHide')
                    && (text.includes('Dungeon') || text.includes('TITANIT') || text.includes('Healing'));
                if (isDungeonTimer) {
                    const match = text.match(/(\d+\.?\d*)\s*$/);
                    let remaining = match ? parseFloat(match[1]) : -1;
                    if (remaining > 0.05 && remaining < 120) {
                        // Real dungeon battle timer — wait for it + 2s
                        const waitMs = Math.min(Math.ceil((remaining + 2) * 1000), 30000);
                        console.log(`[AutoProfiler] Battle timer ${remaining.toFixed(2)}s, waiting ${waitMs}ms...`);
                        this._pendingSwitchTimer = setTimeout(checkAndSchedule, Math.min(waitMs, 2000));
                        return;
                    }
                    if (remaining >= 0 && remaining <= 0.05) {
                        // Timer just expired — +2s buffer after battle ends before switching
                        console.log('[AutoProfiler] Battle timer expired, +2s buffer...');
                        this._pendingSwitchTimer = setTimeout(checkAndSchedule, 2000);
                        return;
                    }
                    // remaining >= 120 or unparseable — ignore (not our timer)
                    if (remaining >= 120) {
                        console.log(`[AutoProfiler] Ignoring non-dungeon timer ${remaining.toFixed(2)}s`);
                    }
                }

                // 2. Fallback cooldown (used when no DOM timer is visible)
                if (now - this.lastEngineSwitch < this.engineSwitchCooldown) {
                    const remaining = this.engineSwitchCooldown - (now - this.lastEngineSwitch);
                    console.log(`[AutoProfiler] Cooldown (${Math.round(remaining / 1000)}s), waiting...`);
                    this._pendingSwitchTimer = setTimeout(checkAndSchedule, Math.min(remaining + 100, 3000));
                    return;
                }
                // 3. Wait for engine busy flag (unsafeWindow, shared across TM sandboxes)
                console.log('[AutoProfiler] __engineBusy:', unsafeWindow.__engineBusy, '| lastSwitch:', new Date(this.lastEngineSwitch).toLocaleTimeString());
                if (unsafeWindow.__engineBusy) {
                    console.log('[AutoProfiler] Engine busy, waiting 2s...');
                    this._pendingSwitchTimer = setTimeout(checkAndSchedule, 2000);
                    return;
                }
                // 4. All clear → wait 5s then execute
                console.log('[AutoProfiler] All clear, switching in 5s...');
                this._pendingSwitchTimer = setTimeout(() => {
                    this.currentProfile = targetProfile;
                    this._executeEngineSwitch();
                }, 5000);
            };

            checkAndSchedule();
        },

        _executeEngineSwitch() {
            this._pendingSwitchTimer = null;
            this._switchInProgress = false;
            this.lastEngineSwitch = Date.now();
            if (this.currentProfile === 0) {
                // Profile 0 → activate RED engine
                document.dispatchEvent(new CustomEvent('setDungeonEngine', { detail: { engine: 'red' } }));
                document.dispatchEvent(new CustomEvent('changeDungeonProfile', { detail: { profileNumber: 0 } }));
            } else {
                // Profile 3+ → activate Evo1 engine
                document.dispatchEvent(new CustomEvent('setDungeonEngine', { detail: { engine: 'evo1' } }));
                document.dispatchEvent(new CustomEvent('changeDungeonProfile', { detail: { profileNumber: this.currentProfile } }));
            }
            // SWITCH: Auto-start dungeon on the new engine (deferred to let profile load complete)
            if (this.lastMaxTitanite) {
                const titanite = this.lastMaxTitanite;
                setTimeout(() => document.dispatchEvent(new CustomEvent('autoStartDungeon', { detail: { maxTitanite: titanite } })), 800);
            }
        },
        loadSettings() {
            const saved = GM_getValue('AutoProfile_Settings_v1', null);
            this.settings = JSON.parse(JSON.stringify(this.defaults));
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    for (const key in parsed) {
                        if (key === 'weights' && typeof parsed[key] === 'object') {
                            this.settings.weights = { ...this.defaults.weights, ...parsed.weights };
                        } else {
                            this.settings[key] = parsed[key];
                        }
                    }
                } catch (e) { console.warn("Failed to parse settings", e); }
            }
            // SWITCH: Auto-migrate old format thresholds (profile 1 as first entry → profile 0 + skip 1-2)
            const thresholds = this.settings.profileThresholds;
            if (thresholds && thresholds.length > 0 && thresholds[0].profile === 1) {
                console.log('[AutoProfiler] Detected old profileThresholds format (1-8). Migrating to 0,3-8...');
                const newThresholds = [
                    { maxScore: thresholds[0].maxScore, profile: 0 },
                ];
                for (let i = 2; i < thresholds.length; i++) {
                    newThresholds.push({
                        maxScore: thresholds[i].maxScore,
                        profile: thresholds[i].profile
                    });
                }
                this.settings.profileThresholds = newThresholds;
                this.saveSettings();
                console.log('[AutoProfiler] Thresholds migrated:', JSON.stringify(newThresholds));
            }
        },
        saveSettings() { GM_setValue('AutoProfile_Settings_v1', JSON.stringify(this.settings)); },
        onDataUpdate(data, type) {
            if (this.isSimulatorActive) return;
            if (type === 'titans') this.lastTitanData = data;
            if (type === 'progress') { this.lastProgressData = data; if (data.maxTitanite) this.lastMaxTitanite = data.maxTitanite; }
            if (type === 'floor') this.lastFloorData = data;
            // Persist last known healing buff value (survives across floors, reset on F5)
            // [OLD METHOD - commented out for reversibility]
            // if (data && data.healingBuffs !== undefined) this._lastHealingBuff = data.healingBuffs;
            // NEW METHOD A: read healing buff from DOM (div.scriptMenu_status) when Evo1 shows it
            try {
                const hbEl = document.querySelector('.scriptMenu_status');
                if (hbEl && !hbEl.classList.contains('scriptMenu_statusHide')) {
                    const hbMatch = hbEl.innerText.match(/Healing Buff:\s*-(\d+)/i);
                    if (hbMatch) {
                        const parsed = -parseInt(hbMatch[1], 10);
                        if (parsed < 0) this._lastHealingBuff = parsed;
                    }
                }
            } catch (e) {}
            // FALLBACK: read from unsafeWindow (shared by Evo1 via updatePower)
            if (unsafeWindow._lastHealingBuff !== undefined && unsafeWindow._lastHealingBuff < 0) {
                this._lastHealingBuff = unsafeWindow._lastHealingBuff;
            }
            // SWITCH: Only calculate risk when BOTH titan AND progress data are available.
            // This prevents a false Safe Start (score 495 -> Profile 8) when events arrive
            // sequentially from RED script's dispatchPanelEvents().
            if (this.lastTitanData && this.lastProgressData) {
                this.calculateRiskScore();
                this.updateRiskIndicator();
                if (this.settings.enabled) {
                    this.evaluateProfileChange();
                }
            }
        },
        calculateRiskScore(simulatedData = null) {
            const sourceTitanData = simulatedData ? simulatedData.titans : this.lastTitanData;
            const sourceProgressData = simulatedData ? simulatedData.progress : this.lastProgressData;

            let avgHealth, minHealth, deadCount, avgEnergy;
            let isSafeStart = false;

            if (!sourceTitanData || !sourceProgressData) {
                if (!simulatedData) {
                    // Safe Start Attivato (Assenza di dati) — valori inventati 60% finché non arrivano dati reali
                    isSafeStart = true;
                    avgHealth = 60;
                    minHealth = 60;
                    deadCount = 0;
                    avgEnergy = 600;
                } else {
                    return { finalScore: 0, breakdown: {} };
                }
            } else {
                const titans = Object.values(sourceTitanData).flat();
                const relevantTitans = titans.filter(t => !(t.hpPercent === 0 && t.energy === 0 && !t.isDead));
                if (relevantTitans.length === 0) {
                    if (!simulatedData) { this.currentRiskScore = null; this.scoreBreakdown = {}; }
                    return { finalScore: 0, breakdown: {} };
                }

                const livingTitans = relevantTitans.filter(t => !t.isDead);

                if (simulatedData) {
                    minHealth = simulatedData.minHealth;
                    deadCount = simulatedData.deadTitans;
                    avgHealth = livingTitans.length > 0 ? simulatedData.avgHealth : 0;
                    avgEnergy = livingTitans.length > 0 ? simulatedData.avgEnergy : 0;
                } else {
                    let totalHealth = 0, totalEnergy = 0;
                    minHealth = 100;
                    if (livingTitans.length > 0) {
                        livingTitans.forEach(t => {
                            totalHealth += t.hpPercent;
                            totalEnergy += t.energy;
                            if (t.hpPercent < minHealth) minHealth = t.hpPercent;
                        });
                        deadCount = relevantTitans.length - livingTitans.length;
                        avgHealth = totalHealth / livingTitans.length;
                        avgEnergy = totalEnergy / livingTitans.length;
                    } else {
                        deadCount = relevantTitans.length; avgHealth = 0; avgEnergy = 0;
                    }
                }
            }

            const healthFactor = (100 - avgHealth) * this.settings.weights.avgHealth;
            const minHealthFactor = (100 - minHealth) * this.settings.weights.minHealth;
            const deadTitanFactor = deadCount * this.settings.weights.deadTitan;
            const energyFactor = (100 - (avgEnergy / 10)) * this.settings.weights.avgEnergy;

            const sourceFloorData = simulatedData ? simulatedData.floor : (this.lastFloorData || this.lastProgressData);
            // Healing buff: ignore RED's sentinel -85, use 0 for safe start (conservative)
            let rawHealingBuff;
            if (isSafeStart) {
                rawHealingBuff = 0;
            } else if (sourceFloorData && sourceFloorData.healingBuffs !== undefined && sourceFloorData.healingBuffs !== -85) {
                rawHealingBuff = sourceFloorData.healingBuffs;
            } else {
                rawHealingBuff = this._lastHealingBuff;
            }
            const healingBuffPoints = Math.abs(rawHealingBuff);
            const healingBuffScore = healingBuffPoints * (this.settings.weights.healingBuff || 1.0);

            let finalScore = Math.round(healthFactor + minHealthFactor + deadTitanFactor + energyFactor + healingBuffScore);
            // SWITCH: NaN guard — if any factor produced NaN, treat as high risk to avoid cascade to profile 8
            if (!isFinite(finalScore) || isNaN(finalScore)) {
                finalScore = 999;
                console.warn('[AutoProfiler] calculateRiskScore produced NaN, defaulting to 999 (high risk)');
            }

            const breakdown = {
                "Avg Health": { value: isSafeStart ? `60% (default)` : `${avgHealth.toFixed(0)}%`, score: healthFactor.toFixed(1) },
                "Min Health": { value: isSafeStart ? `60% (default)` : `${minHealth}%`, score: minHealthFactor.toFixed(1) },
                "Dead Titans": { value: isSafeStart ? `0 (default)` : deadCount, score: deadTitanFactor.toFixed(1) },
                "Avg Energy": { value: isSafeStart ? `60% (default)` : `${(avgEnergy / 10).toFixed(0)}%`, score: energyFactor.toFixed(1) },
                "Healing Buff": { value: isSafeStart ? `N/A (safe)` : `-${healingBuffPoints}%`, score: healingBuffScore.toFixed(1) },
                "<b>Total Score</b>": { value: "", score: `<b>${finalScore}</b>` }
            };

            if (!simulatedData) {
                this.currentRiskScore = finalScore;
                this.scoreBreakdown = breakdown;
            }
            return { finalScore, breakdown };
        },
        updateRiskIndicator() {
            if (this.isSimulatorActive) return;
            const indicator = document.getElementById('risk-score-indicator');
            if (indicator) indicator.textContent = (this.currentRiskScore !== null) ? `Risk: ${this.currentRiskScore}` : `Risk: --`;
        },
        evaluateProfileChange() {
            const score = this.currentRiskScore;
            if (score === null) return;
            const hysteresis = this.settings.hysteresisThreshold || 10;
            const thresholds = this.settings.profileThresholds;
            const idealProfile = thresholds.find(p => score <= p.maxScore)?.profile ?? 8;

            if (this.currentProfile !== idealProfile) {
                // Find the crossover threshold index between current and ideal
                const curIdx = thresholds.findIndex(p => p.profile === this.currentProfile);
                const targetIdx = thresholds.findIndex(p => p.profile === idealProfile);
                let shouldSwitch = true;
                if (curIdx !== -1 && targetIdx !== -1) {
                    if (idealProfile > this.currentProfile) {
                        // Going UP: need score > threshold + hysteresis
                        const crossThreshold = thresholds[curIdx].maxScore;
                        if (score <= crossThreshold + hysteresis) shouldSwitch = false;
                    } else {
                        // Going DOWN: need score <= threshold - hysteresis
                        const crossThreshold = thresholds[targetIdx].maxScore;
                        if (score > crossThreshold - hysteresis) shouldSwitch = false;
                    }
                }
                if (shouldSwitch) {
                    this.currentProfile = idealProfile;
                    this.dispatchEngineCommand();
                }
            }
        },
        calculateTitaniteSpeed(currentTitanite) {
            const now = Date.now();
            const history = this.titaniteHistory;

            if (history.length > 0 && currentTitanite < history[history.length - 1].titanite) {
                history.length = 0;
            }
            history.push({ titanite: currentTitanite, time: now });
            if (history.length > 20) history.shift();

            if (history.length < 2) return null;

            const first = history[0];
            const last = history[history.length - 1];
            const deltaTitanite = last.titanite - first.titanite;
            const deltaHours = (last.time - first.time) / 3600000;

            if (deltaHours <= 0) return null;
            const rate = deltaTitanite / deltaHours;
            return Math.round(rate * 10) / 10;
        }
    };

    // ===============================================
    // Stili CSS
    // ===============================================
    GM_addStyle(`
        #titanStatsPanel { position: fixed; top: ${panelSettings.top}; left: ${panelSettings.left}; right: ${panelSettings.right}; width: ${panelSettings.width}; max-width: 95vw; height: ${panelSettings.height}; max-height: 98vh; background-color: rgba(30, 30, 30, 0.95); color: #eee; border: 1px solid #444; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5); resize: none; overflow: hidden; z-index: 10000; display: flex; flex-direction: column; font-family: Arial, sans-serif; font-size: ${BASE_FONT_SIZE * panelSettings.zoomLevel}px; min-width: 220px; min-height: 100px; }
        #titanStatsPanel.minimized { height: auto !important; width: auto !important; max-width: fit-content; resize: none; }
        #titanStatsPanel .panel-header { background-color: #444; color: #fff; padding: 8px 10px; cursor: move; border-bottom: 1px solid #555; font-weight: bold; display: flex; justify-content: space-between; align-items: center; user-select: none; }
        #titanStatsPanel .panel-header:active { cursor: grabbing; }
        #titanStatsPanel .panel-buttons { display: flex; align-items: center; gap: 5px; }
        #titanStatsPanel .panel-button { background: #555; border: 1px solid #666; color: #fff; cursor: pointer; font-size: 0.8em; padding: 2px 5px; border-radius: 3px; transition: background-color 0.2s; }
        #titanStatsPanel .panel-button:hover { background-color: #777; }
        #zoom-percentage { font-size: 0.9em; padding: 0 5px; min-width: 40px; text-align: center; }
        #titanStatsPanel .panel-content { flex-grow: 1; overflow: hidden; display: flex; flex-direction: column; position: relative; }
        .panel-sub-section { overflow-y: auto; padding: 10px; }
        #titan-section { height: ${panelSettings.titanSectionHeight}; min-height: 50px; }
        #dungeon-section { height: ${panelSettings.dungeonSectionHeight}; min-height: 50px; }
        #resize-handle-vertical { height: 8px; background-color: #444; cursor: ns-resize; flex-shrink: 0; transition: background-color 0.2s; }
        #resize-handle-vertical:hover { background-color: #666; }
        #titanStatsPanel.collapsed .panel-content, #titanStatsPanel.minimized .panel-content { display: none; }
        #dungeon-section .info-grid { display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; align-items: center; }
        #dungeon-section .info-label { font-weight: bold; color: #aaa; text-align: right; }
        #dungeon-section .info-value { color: #fff; font-family: monospace; }
        #dungeon-section .value-big { font-size: 1.5em; }
        #dungeon-section .info-value.fire { color: #FF4500; font-weight: bold; }
        #dungeon-section .info-value.water { color: #1E90FF; font-weight: bold; }
        #dungeon-section .info-value.earth { color: #7CFC00; font-weight: bold; }
        .titan-element-header { font-weight: bold; color: #fff; background-color: #666; padding: 3px 6px; margin-top: 10px; border-radius: 4px; text-align: center; font-size: 1.5em; }
        .titan-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed; }
        .titan-table th, .titan-table td { padding: 4px 6px; border: 1px solid #555; text-align: left; }
        .titan-name-water { color: #1E90FF; } .titan-name-fire { color: #FF4500; } .titan-name-earth { color: #7CFC00; }
        .progress-bar-container { width: 100%; border-radius: 3px; overflow: hidden; height: 2px; margin-top: 2px; }
        .hp-container { background-color: darkred; } .energy-container { background-color: #4b0082; }
        .hp-bar { height: 100%; background-color: #2ecc71; width: 0%; transition: width 0.3s ease-out; }
        .energy-bar { height: 100%; background-color: #f1c40f; width: 0%; transition: width 0.3s ease-out; }
        small { font-size: 0.8em; display: block; text-align: right; margin-top: 2px; line-height: 1; }
        .resize-handle { position: absolute; z-index: 10001; }
        .resize-handle.right { top: 0; right: 0; width: 8px; height: 100%; cursor: ew-resize; }
        .resize-handle.bottom { left: 0; bottom: 0; width: 100%; height: 8px; cursor: ns-resize; }
        .resize-handle.bottom-right { bottom: 0; right: 0; width: 16px; height: 16px; cursor: nwse-resize; }
		.resize-handle.left { top: 0; left: 0; width: 8px; height: 100%; cursor: ew-resize; }
        .resize-handle.bottom-left { bottom: 0; left: 0; width: 16px; height: 16px; cursor: nesw-resize; }
        .autoprofiler-footer { display: flex; justify-content: space-between; align-items: center; padding: 5px 10px; background: #222; flex-shrink: 0; }
        .autoprofiler-right-footer { display: flex; align-items: center; }
        .autoprofiler-debug-icon, .autoprofiler-gear { cursor: pointer; font-size: 1.5em; transition: transform 0.3s; }
        .autoprofiler-debug-icon { margin-left: 10px; }
        .autoprofiler-gear:hover, .autoprofiler-debug-icon:hover { transform: rotate(90deg); }
        #risk-score-indicator { font-family: monospace; color: #0f0; }
        .calibrator-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(40, 40, 55, 0.98); z-index: 10002; overflow-y: auto; padding: 15px; display: none; }
        .calibrator-overlay.visible { display: block; }
        .calibrator-section { margin-bottom: 20px; }
        .calibrator-section h4 { margin: 0 0 10px; color: #0af; border-bottom: 1px solid #0af; padding-bottom: 5px; }
        .calibrator-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: center; }
        .calibrator-grid label { text-align: right; padding-right: 10px; font-weight: 300; }
        .calibrator-grid input { width: 100%; box-sizing: border-box; background: #1e1e2d; color: #fff; border: 1px solid #5a5a7a; border-radius: 4px; padding: 5px; }
        .risk-breakdown-tooltip { display: none; position: absolute; bottom: 40px; right: 5px; background: #1e1e2d; border: 1px solid #0af; border-radius: 5px; padding: 10px; z-index: 10003; width: 250px; font-size: 16px; pointer-events: none; }
        .risk-breakdown-tooltip.visible { display: block; }
        .risk-breakdown-tooltip table { width: 100%; border-collapse: collapse; }
        .risk-breakdown-tooltip td { padding: 2px 4px; }
        .risk-breakdown-tooltip .label { color: #aaa; }
        .risk-breakdown-tooltip .value { color: #ccc; text-align: right; }
        .risk-breakdown-tooltip .score { color: #0f0; font-weight: bold; text-align: right; }
        #simulator-section { border: 1px dashed #0af; padding: 10px; margin-top: 15px; border-radius: 5px; }
        #simulator-output { background: #111; padding: 10px; margin-top: 10px; border-radius: 5px; font-family: monospace; }
    `);

    // ===============================================
    // Funzioni di Creazione e Aggiornamento della GUI
    // ===============================================
    function createGUI() {
        let panel = document.getElementById('titanStatsPanel');
        if (panel) return;
        panel = document.createElement('div');
        panel.id = 'titanStatsPanel';
        document.body.appendChild(panel);

        const header = document.createElement('div'); header.className = 'panel-header'; panel.appendChild(header);
        const title = document.createElement('div'); title.textContent = '🛡️ Dungeon & Titan Monitor'; header.appendChild(title);
        const buttonsContainer = document.createElement('div'); buttonsContainer.className = 'panel-buttons'; header.appendChild(buttonsContainer);
        const zoomOutButton = document.createElement('button'); zoomOutButton.className = 'panel-button'; zoomOutButton.textContent = '-'; buttonsContainer.appendChild(zoomOutButton);
        const zoomIndicator = document.createElement('div'); zoomIndicator.id = 'zoom-percentage'; zoomIndicator.textContent = `${Math.round(panelSettings.zoomLevel * 100)}%`; buttonsContainer.appendChild(zoomIndicator);
        const zoomInButton = document.createElement('button'); zoomInButton.className = 'panel-button'; zoomInButton.textContent = '+'; buttonsContainer.appendChild(zoomInButton);
        const collapseButton = document.createElement('button'); collapseButton.className = 'panel-button'; collapseButton.textContent = panelSettings.collapsed ? '▼' : '▲'; buttonsContainer.appendChild(collapseButton);
        const minimizeButton = document.createElement('button'); minimizeButton.className = 'panel-button'; minimizeButton.textContent = panelSettings.minimized ? '🗗' : '🗕'; buttonsContainer.appendChild(minimizeButton);

        const content = document.createElement('div'); content.className = 'panel-content'; panel.appendChild(content);
        const titanSection = document.createElement('div'); titanSection.id = 'titan-section'; titanSection.className = 'panel-sub-section'; content.appendChild(titanSection);
        const vResizeHandle = document.createElement('div'); vResizeHandle.id = 'resize-handle-vertical'; content.appendChild(vResizeHandle);
        const dungeonSection = document.createElement('div'); dungeonSection.id = 'dungeon-section'; dungeonSection.className = 'panel-sub-section'; content.appendChild(dungeonSection);
        dungeonSection.innerHTML = `<div class="info-grid">
            <div class="info-label">Floor:</div><div id="dungeon-floor" class="info-value">Waiting for data...</div>
            <div class="info-label">Titanite Speed:</div><div id="dungeon-titanite-speed" class="info-value value-big">--</div>
            <div class="info-label">Healing Buffs:</div><div id="dungeon-healing-buffs" class="info-value value-big">--</div>
            <div class="info-label">Opponent:</div><div id="dungeon-opponent" class="info-value">--</div>
            <div class="info-label">Titanite:</div><div id="dungeon-titanite" class="info-value value-big">-- / --</div>
            <div class="info-label">Active Profile:</div><div id="dungeon-profile" class="info-value">--</div>
        </div>`;
        const calibratorOverlay = document.createElement('div'); calibratorOverlay.className = 'calibrator-overlay'; content.appendChild(calibratorOverlay);
        if (panelSettings.minimized) panel.classList.add('minimized'); else if (panelSettings.collapsed) panel.classList.add('collapsed');

        const footer = document.createElement('div'); footer.className = 'autoprofiler-footer';
        const riskIndicator = document.createElement('div'); riskIndicator.id = 'risk-score-indicator'; riskIndicator.textContent = 'Risk: --';
        const rightFooter = document.createElement('div'); rightFooter.className = 'autoprofiler-right-footer';
        const debugIcon = document.createElement('div'); debugIcon.className = 'autoprofiler-debug-icon'; debugIcon.textContent = '🔍'; debugIcon.title = 'Show Risk Score Breakdown';
        const gearButton = document.createElement('div'); gearButton.className = 'autoprofiler-gear'; gearButton.textContent = '⚙️'; gearButton.title = 'Open Auto-Profile Tuner';
        rightFooter.append(debugIcon, gearButton);
        footer.append(riskIndicator, rightFooter);
        panel.appendChild(footer);
        const riskTooltip = document.createElement('div'); riskTooltip.className = 'risk-breakdown-tooltip'; panel.appendChild(riskTooltip);

        // --- Logica di Interazione (NON OMESSA) ---
        function savePositionAndSize() {
            if (panel.classList.contains('minimized') || panel.classList.contains('collapsed')) return;
            const rect = panel.getBoundingClientRect();
            panelSettings.left = `${rect.left}px`;
            panelSettings.top = `${rect.top}px`;
            panelSettings.width = `${rect.width}px`;
            panelSettings.height = `${rect.height}px`;
            savePanelSettings(panelSettings);
        }
        window.addEventListener('resize', () => { if (!panel.classList.contains('minimized')) { panel.style.height = `90vh`; panelSettings.height = `90vh`; savePanelSettings(panelSettings); } });
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.panel-button')) return;
            let isDragging = true;
            let offset = { x: e.clientX - panel.offsetLeft, y: e.clientY - panel.offsetTop };
            document.body.style.userSelect = 'none';
            function onMouseMove(e) { if (isDragging) { panel.style.left = `${e.clientX - offset.x}px`; panel.style.top = `${e.clientY - offset.y}px`; panel.style.right = 'auto'; } }
            function onMouseUp() { isDragging = false; document.body.style.userSelect = ''; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); savePositionAndSize(); }
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        // Sostituisci il vecchio blocco forEach con questo
        ['right', 'bottom', 'bottom-right', 'left', 'bottom-left'].forEach(side => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${side}`;
            panel.appendChild(handle);

            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = panel.offsetWidth;
                const startHeight = panel.offsetHeight;
                const startLeft = panel.offsetLeft;

                function onResizeMove(e) {
                    // Logica per l'allargamento a destra
                    if (side.includes('right')) {
                        const newWidth = startWidth + e.clientX - startX;
                        panel.style.width = `${Math.max(220, newWidth)}px`;
                    }

                    // NUOVA LOGICA per l'allargamento a sinistra
                    if (side.includes('left')) {
                        const deltaX = startX - e.clientX;
                        const newWidth = startWidth + deltaX;
                        if (newWidth > 220) {
                            panel.style.width = `${newWidth}px`;
                            panel.style.left = `${startLeft - deltaX}px`;
                        }
                    }

                    // Logica per l'allargamento in basso (invariata)
                    if (side.includes('bottom')) {
                        const newHeight = startHeight + e.clientY - startY;
                        panel.style.height = `${Math.max(100, newHeight)}px`;
                    }
                }

                function onResizeUp() {
                    document.removeEventListener('mousemove', onResizeMove);
                    document.removeEventListener('mouseup', onResizeUp);
                    savePositionAndSize();
                }

                document.addEventListener('mousemove', onResizeMove);
                document.addEventListener('mouseup', onResizeUp);
            });
        });
        collapseButton.addEventListener('click', () => { panelSettings.collapsed = !panelSettings.collapsed; panel.classList.toggle('collapsed'); collapseButton.textContent = panelSettings.collapsed ? '▼' : '▲'; savePanelSettings(panelSettings); });
        minimizeButton.addEventListener('click', () => { panelSettings.minimized = !panelSettings.minimized; panel.classList.toggle('minimized'); minimizeButton.textContent = panelSettings.minimized ? '🗗' : '🗕'; savePanelSettings(panelSettings); });
        zoomOutButton.addEventListener('click', () => { if (panelSettings.zoomLevel > 0.5) { updateZoom(Math.round((panelSettings.zoomLevel - 0.1) * 10) / 10); } });
        zoomInButton.addEventListener('click', () => { if (panelSettings.zoomLevel < 2.0) { updateZoom(Math.round((panelSettings.zoomLevel + 0.1) * 10) / 10); } });
        vResizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startTitanHeight = titanSection.offsetHeight;
            const startDungeonHeight = dungeonSection.offsetHeight;
            const totalHeight = startTitanHeight + startDungeonHeight;
            function onVResizeMove(e) {
                const deltaY = e.clientY - startY;
                let newTitanHeight = startTitanHeight + deltaY;
                let newDungeonHeight = startDungeonHeight - deltaY;
                if (newTitanHeight < 50) { newTitanHeight = 50; newDungeonHeight = totalHeight - 50; }
                if (newDungeonHeight < 50) { newDungeonHeight = 50; newTitanHeight = totalHeight - 50; }
                titanSection.style.height = `${(newTitanHeight / totalHeight) * 100}%`;
                dungeonSection.style.height = `${(newDungeonHeight / totalHeight) * 100}%`;
            }
            function onVResizeUp() {
                document.removeEventListener('mousemove', onVResizeMove);
                document.removeEventListener('mouseup', onVResizeUp);
                panelSettings.titanSectionHeight = titanSection.style.height;
                panelSettings.dungeonSectionHeight = dungeonSection.style.height;
                savePanelSettings(panelSettings);
            }
            document.addEventListener('mousemove', onVResizeMove);
            document.addEventListener('mouseup', onVResizeUp);
        });
        debugIcon.addEventListener('mouseenter', () => showRiskBreakdown(true));
        debugIcon.addEventListener('mouseleave', () => showRiskBreakdown(false));
        function showRiskBreakdown(visible) {
            if (visible) {
                let tableHtml = '<table>';
                for (const [key, data] of Object.entries(AutoProfiler.scoreBreakdown)) { tableHtml += `<tr><td class="label">${key}:</td><td class="value">${data.value}</td><td class="score">${data.score}</td></tr>`; }
                tableHtml += '</table>';
                riskTooltip.innerHTML = tableHtml;
                riskTooltip.classList.add('visible');
            } else { riskTooltip.classList.remove('visible'); }
        }
        gearButton.addEventListener('click', () => {
            calibratorOverlay.classList.toggle('visible');
            if (calibratorOverlay.classList.contains('visible') && calibratorOverlay.innerHTML === '') {
                populateCalibrationPanel(calibratorOverlay);
            }
        });
    }

    function populateCalibrationPanel(container) {
        container.innerHTML = ''; // Pulisce il contenuto precedente

        // --- Sezione Abilitazione Sistema ---
        const enabledSection = document.createElement('div');
        enabledSection.className = 'calibrator-section';
        enabledSection.innerHTML = `<h4>Auto-Profile System</h4>`;
        const enabledLabel = document.createElement('label');
        enabledLabel.style.cssText = 'display: flex; align-items: center; cursor: pointer;';
        const enabledCheckbox = document.createElement('input');
        enabledCheckbox.type = 'checkbox';
        enabledCheckbox.checked = AutoProfiler.settings.enabled;
        enabledCheckbox.onchange = () => {
            AutoProfiler.settings.enabled = enabledCheckbox.checked;
            AutoProfiler.saveSettings();
        };
        enabledLabel.append(enabledCheckbox, ' Enable Automatic Profile Switching');
        enabledSection.appendChild(enabledLabel);
        container.appendChild(enabledSection);

        // --- Sezione Calcolatrice / Simulatore ---
        const simulatorSection = document.createElement('div');
        simulatorSection.className = 'calibrator-section';
        simulatorSection.innerHTML = `<h4>Risk Score Calculator</h4>`;

        const simulatorLabel = document.createElement('label');
        simulatorLabel.style.cssText = 'display: flex; align-items: center; cursor: pointer;';
        const simulatorCheckbox = document.createElement('input');
        simulatorCheckbox.type = 'checkbox';
        simulatorCheckbox.checked = AutoProfiler.isSimulatorActive;

        const simulatorInputsContainer = document.createElement('div');
        simulatorInputsContainer.style.display = AutoProfiler.isSimulatorActive ? 'block' : 'none';
        simulatorInputsContainer.style.marginTop = '10px';
        simulatorInputsContainer.innerHTML = '<div class="calibrator-grid"></div>';
        const simulatorGrid = simulatorInputsContainer.querySelector('.calibrator-grid');

        simulatorCheckbox.onchange = () => {
            AutoProfiler.isSimulatorActive = simulatorCheckbox.checked;
            simulatorInputsContainer.style.display = AutoProfiler.isSimulatorActive ? 'block' : 'none';
            if (!AutoProfiler.isSimulatorActive) {
                AutoProfiler.updateRiskIndicator();
            } else {
                updateSimulator(); // Update calculator when activated
            }
        };
        simulatorLabel.append(simulatorCheckbox, ' Enable Calculator Mode');
        simulatorSection.appendChild(simulatorLabel);
        simulatorSection.appendChild(simulatorInputsContainer);

        const simInputs = { avgHealth: 100, minHealth: 100, deadTitans: 0, avgEnergy: 0, healingBuffs: 85 };
        const inputElements = {};

        Object.keys(simInputs).forEach(key => {
            const label = document.createElement('label'); label.textContent = `${key}:`;
            const input = document.createElement('input'); input.type = 'number'; input.value = simInputs[key];
            inputElements[key] = input;
            simulatorGrid.append(label, input);
        });

        const outputContainer = document.createElement('div');
        outputContainer.id = 'simulator-output';
        outputContainer.innerHTML = `Calculated Risk Score: <b id="sim-risk-score">--</b><br>Suggested Profile: <b id="sim-profile">--</b>`;
        simulatorInputsContainer.appendChild(outputContainer);

        function updateSimulator() {
            if (!AutoProfiler.isSimulatorActive) return;
            const simulatedFloor = { healingBuffs: parseInt(inputElements.healingBuffs.value, 10) || 0 };
            const simulatedTitansData = {
                avgHealth: parseInt(inputElements.avgHealth.value, 10) || 100,
                minHealth: parseInt(inputElements.minHealth.value, 10) || 100,
                deadTitans: parseInt(inputElements.deadTitans.value, 10) || 0,
                avgEnergy: parseInt(inputElements.avgEnergy.value, 10) || 0,
                titans: { dummy: [{ hpPercent: 100, energy: 100, isDead: false }] }, // Dati fittizi
                progress: {},
                floor: simulatedFloor
            };
            const result = AutoProfiler.calculateRiskScore(simulatedTitansData);
            const idealProfile = AutoProfiler.settings.profileThresholds.find(p => result.finalScore <= p.maxScore)?.profile ?? 8;
            const profileLabel = idealProfile === 0 ? '🚀 RED (Profile 0)' : `Profile ${idealProfile}`;
            document.getElementById('sim-risk-score').textContent = result.finalScore;
            document.getElementById('sim-profile').textContent = profileLabel;
        }

        Object.values(inputElements).forEach(input => input.addEventListener('input', updateSimulator));
        container.appendChild(simulatorSection);
        if (AutoProfiler.isSimulatorActive) updateSimulator();

        // --- Sezione Pesi del Rischio ---
        const weightsSection = document.createElement('div');
        weightsSection.className = 'calibrator-section';
        weightsSection.innerHTML = '<h4>Risk Weights</h4><div class="calibrator-grid"></div>';
        const weightsGrid = weightsSection.querySelector('.calibrator-grid');
        Object.keys(AutoProfiler.settings.weights).forEach(key => {
            const label = document.createElement('label'); label.textContent = `${key}:`;
            const input = document.createElement('input'); input.type = 'number'; input.step = 0.05;
            input.value = AutoProfiler.settings.weights[key];
            input.onchange = () => { AutoProfiler.settings.weights[key] = parseFloat(input.value) || 0; AutoProfiler.saveSettings(); };
            weightsGrid.append(label, input);
        });
        container.appendChild(weightsSection);



        // --- Sezione Soglie dei Profili ---
        const thresholdsSection = document.createElement('div');
        thresholdsSection.className = 'calibrator-section';
        thresholdsSection.innerHTML = '<h4>Profile Thresholds</h4><div class="calibrator-grid"></div>';
        const thresholdsGrid = thresholdsSection.querySelector('.calibrator-grid');
        AutoProfiler.settings.profileThresholds.forEach((threshold, index) => {
            const labelText = threshold.profile === 0 ? 'Activate 🚀 RED (Profile 0) if Risk <=' : `Activate Profile ${threshold.profile} if Risk <=`;
            const label = document.createElement('label'); label.textContent = labelText;
            const input = document.createElement('input'); input.type = 'number';
            input.value = threshold.maxScore;
            input.onchange = () => { AutoProfiler.settings.profileThresholds[index].maxScore = parseInt(input.value, 10) || 99999; AutoProfiler.saveSettings(); };
            thresholdsGrid.append(label, input);
        });
        // Hysteresis threshold
        const hystLabel = document.createElement('label'); hystLabel.textContent = 'Hysteresis (dead zone ±)';
        const hystInput = document.createElement('input'); hystInput.type = 'number'; hystInput.min = 0; hystInput.max = 100;
        hystInput.value = AutoProfiler.settings.hysteresisThreshold || 10;
        hystInput.onchange = () => { AutoProfiler.settings.hysteresisThreshold = parseInt(hystInput.value, 10) || 0; AutoProfiler.saveSettings(); };
        thresholdsGrid.append(hystLabel, hystInput);
        container.appendChild(thresholdsSection);

        // --- Sezione Azioni di Gestione ---
        const actionsSection = document.createElement('div');
        actionsSection.className = 'calibrator-section';
        actionsSection.innerHTML = '<h4>Actions</h4>';
        actionsSection.style.display = 'flex';
        actionsSection.style.gap = '10px';

        const importBtn = document.createElement('button'); importBtn.textContent = 'Import Tuning'; importBtn.className = 'save-profile-modal-btn';
        importBtn.onclick = () => {
            const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = '.json,application/json';
            fileInput.onchange = (event) => {
                const file = event.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedSettings = JSON.parse(e.target.result);
                        if (importedSettings && importedSettings.weights && importedSettings.profileThresholds) {
                            if (confirm('Tuning file loaded. Apply settings?')) {
                                Object.assign(AutoProfiler.settings, importedSettings);
                                AutoProfiler.saveSettings();
                                populateCalibrationPanel(container);
                                alert('Tuning settings successfully imported.');
                            }
                        } else { alert('Error: Invalid tuning file.'); }
                    } catch (error) { alert('Error: Could not parse file.'); }
                };
                reader.readAsText(file);
            };
            fileInput.click();
        };

        const exportBtn = document.createElement('button'); exportBtn.textContent = 'Export Tuning'; exportBtn.className = 'save-profile-modal-btn';
        exportBtn.onclick = () => {
            const jsonString = JSON.stringify(AutoProfiler.settings, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'autoprofiler-tuning.json';
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        };

        const resetBtn = document.createElement('button'); resetBtn.textContent = 'Reset Tuning'; resetBtn.className = 'save-profile-modal-btn'; resetBtn.style.background = '#800';
        resetBtn.onclick = () => {
            if (confirm('Are you sure you want to reset all tuning parameters to their defaults?')) {
                AutoProfiler.settings = JSON.parse(JSON.stringify(AutoProfiler.defaults));
                AutoProfiler.saveSettings();
                populateCalibrationPanel(container);
                alert('Tuning settings have been reset to default.');
            }
        };

        actionsSection.append(importBtn, exportBtn, resetBtn);
        container.appendChild(actionsSection);
    }

    function updateTitanGUI(titansData) {
        const titanSection = document.getElementById('titan-section');
        if (!titanSection) return;
        titanSection.innerHTML = '';
        const elements = [{ name: 'water', emoji: '🌊', className: 'titan-name-water' }, { name: 'fire', emoji: '🔥', className: 'titan-name-fire' }, { name: 'earth', emoji: '🌍', className: 'titan-name-earth' }, { name: 'light', emoji: '☀️', className: '' }, { name: 'dark', emoji: '🌑', className: '' },];
        elements.forEach(element => {
            if (titansData && titansData[element.name] && titansData[element.name].length > 0) {
                const header = document.createElement('div'); header.className = 'titan-element-header';
                header.innerHTML = `${element.emoji} ${element.name.charAt(0).toUpperCase() + element.name.slice(1)} Titans`;
                titanSection.appendChild(header);
                const table = document.createElement('table'); table.className = 'titan-table';
                table.innerHTML = `<thead><tr><th>Name</th><th>HP</th><th>Energy</th></tr></thead><tbody></tbody>`;
                const tbody = table.querySelector('tbody');
                titansData[element.name].forEach(titan => {
                    const energyPercent = Math.floor(titan.energy / 10);
                    const nameClass = element.className ? `class="${element.className}"` : '';
                    const row = document.createElement('tr');
                    row.innerHTML = `<td ${nameClass}>${titan.name} ${titan.isDead ? '💀' : ''}</td><td><div class="progress-bar-container hp-container"><div class="hp-bar" style="width: ${titan.hpPercent}%;"></div></div><small>${titan.hpPercent}%</small></td><td><div class="progress-bar-container energy-container"><div class="energy-bar" style="width: ${energyPercent}%;"></div></div><small>${energyPercent}%</small></td>`;
                    tbody.appendChild(row);
                });
                titanSection.appendChild(table);
            }
        });
    }

    function updateDungeonGUI(dungeonData) {
        if (!document.getElementById('titanStatsPanel')) createGUI();
        if (dungeonData.floorNumber !== undefined) document.getElementById('dungeon-floor').textContent = `${dungeonData.floorNumber} (${dungeonData.floorType || 'info'})`;
        const hbValue = (dungeonData.healingBuffs !== undefined) ? dungeonData.healingBuffs : AutoProfiler._lastHealingBuff;
        if (hbValue) {
            const buffEl = document.getElementById('dungeon-healing-buffs');
            const weight = AutoProfiler.settings.weights.healingBuff || 1.0;
            if (buffEl) buffEl.innerHTML = `-${Math.abs(hbValue)}% <span style="color:#aaa; font-size:0.8em;">(Risk x${weight})</span>`;
        }
        if (dungeonData.primeElement !== undefined) { const opEl = document.getElementById('dungeon-opponent'); opEl.textContent = `${dungeonData.primeElement.toUpperCase()}`; opEl.className = `info-value ${dungeonData.primeElement}`; }
        if (dungeonData.currentTitanite !== undefined) {
            document.getElementById('dungeon-titanite').textContent = `${dungeonData.currentTitanite} / ${dungeonData.maxTitanite}`;
            const speed = AutoProfiler.calculateTitaniteSpeed(dungeonData.currentTitanite);
            const speedEl = document.getElementById('dungeon-titanite-speed');
            if (speedEl) {
                speedEl.textContent = speed !== null ? `${speed}/h` : '--';
            }
        }
        const profileEl = document.getElementById('dungeon-profile');
        if (profileEl) profileEl.textContent = AutoProfiler.currentProfile === 0 ? "🚀 RED (Profile 0)" : `Profile ${AutoProfiler.currentProfile}`;
    }

    // ===============================================
    // Ascoltatori di Eventi e Avvio
    // ===============================================
    AutoProfiler.init();
    createGUI();
    document.addEventListener('titanStatesUpdated', (e) => { if (e.detail) updateTitanGUI(e.detail); });
    document.addEventListener('floorChanged', (e) => { if (e.detail) updateDungeonGUI(e.detail); });
    document.addEventListener('dungeonProgressUpdated', (e) => { if (e.detail) updateDungeonGUI(e.detail); });

})();
