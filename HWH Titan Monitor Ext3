// ==UserScript==
// @name         Titan States & Dungeon GUI (Auto-Profile Edition)
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Pannello di monitoraggio avanzato con sistema di auto-profiling e calcolatrice di rischio integrata.
// @author       Gemini & You
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function() {
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
            weights: { avgHealth: 1.0, minHealth: 1.5, deadTitan: 50, avgEnergy: 0.5 },
            titaniteTiers: [
                { maxTitanite: 280, score: 20 }, { maxTitanite: 2800, score: 0 },
                { maxTitanite: 3200, score: 20 }, { maxTitanite: 3800, score: 40 },
                { maxTitanite: 4300, score: 60 }, { maxTitanite: 4800, score: 90 }
            ],
            profileThresholds: [
                { maxScore: 20, profile: 1 }, { maxScore: 40, profile: 2 },
                { maxScore: 60, profile: 3 }, { maxScore: 80, profile: 4 },
                { maxScore: 100, profile: 5 }, { maxScore: 150, profile: 6 },
                { maxScore: 200, profile: 7 }, { maxScore: 999, profile: 8 }
            ]
        },
        settings: {},
        lastTitanData: null, lastProgressData: null, lastFloorData: null,
        currentRiskScore: 0, currentProfile: 0, scoreBreakdown: {},
        isSimulatorActive: false,

        init() {
            this.loadSettings();
            document.addEventListener('titanStatesUpdated', (e) => this.onDataUpdate(e.detail, 'titans'));
            document.addEventListener('dungeonProgressUpdated', (e) => this.onDataUpdate(e.detail, 'progress'));
            document.addEventListener('floorChanged', (e) => this.onDataUpdate(e.detail, 'floor'));
        },
        loadSettings() { const saved = GM_getValue('AutoProfile_Settings_v1', null); this.settings = saved ? { ...this.defaults, ...JSON.parse(saved) } : { ...this.defaults }; },
        saveSettings() { GM_setValue('AutoProfile_Settings_v1', JSON.stringify(this.settings)); },
        onDataUpdate(data, type) {
            if (this.isSimulatorActive) return;
            if (type === 'titans') this.lastTitanData = data;
            if (type === 'progress') this.lastProgressData = data;
            if (type === 'floor') this.lastFloorData = data;
            if (this.lastTitanData && this.lastProgressData && this.lastFloorData) {
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
            if (!sourceTitanData || !sourceProgressData) return 0;

            const titans = Object.values(sourceTitanData).flat();
            const relevantTitans = titans.filter(t => !(t.hpPercent === 0 && t.energy === 0 && !t.isDead));
            if (relevantTitans.length === 0) {
                if (!simulatedData) { this.currentRiskScore = 0; this.scoreBreakdown = {}; }
                return 0;
            }

            let avgHealth, minHealth, deadCount, avgEnergy;
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
                    livingTitans.forEach(t => { totalHealth += t.hpPercent; totalEnergy += t.energy; if (t.hpPercent < minHealth) minHealth = t.hpPercent; });
                    deadCount = relevantTitans.length - livingTitans.length;
                    avgHealth = totalHealth / livingTitans.length;
                    avgEnergy = totalEnergy / livingTitans.length;
                } else {
                    deadCount = relevantTitans.length; avgHealth = 0; avgEnergy = 0;
                }
            }

            const healthFactor = (100 - avgHealth) * this.settings.weights.avgHealth;
            const minHealthFactor = (100 - minHealth) * this.settings.weights.minHealth;
            const deadTitanFactor = deadCount * this.settings.weights.deadTitan;
            const energyFactor = (100 - (avgEnergy / 10)) * this.settings.weights.avgEnergy;
            const progressScore = this.settings.titaniteTiers.find(tier => sourceProgressData.currentTitanite <= tier.maxTitanite)?.score || 0;
            const finalScore = Math.round(healthFactor + minHealthFactor + deadTitanFactor + energyFactor + progressScore);

            const breakdown = {
                "Avg Health": { value: `${avgHealth.toFixed(0)}%`, score: healthFactor.toFixed(1) },
                "Min Health": { value: `${minHealth}%`, score: minHealthFactor.toFixed(1) },
                "Dead Titans": { value: deadCount, score: deadTitanFactor.toFixed(1) },
                "Avg Energy": { value: `${(avgEnergy / 10).toFixed(0)}%`, score: energyFactor.toFixed(1) },
                "Titanite Tier": { value: sourceProgressData.currentTitanite, score: progressScore.toFixed(1) },
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
            if (indicator) indicator.textContent = `Risk: ${this.currentRiskScore}`;
        },
        evaluateProfileChange() {
            const idealProfile = this.settings.profileThresholds.find(p => this.currentRiskScore <= p.maxScore)?.profile || 8;
            if (this.currentProfile !== idealProfile) {
                this.currentProfile = idealProfile;
                document.dispatchEvent(new CustomEvent('changeDungeonProfile', { detail: { profileNumber: this.currentProfile } }));
            }
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
            <div class="info-label">Opponent:</div><div id="dungeon-opponent" class="info-value">--</div>
            <div class="info-label">Titanite:</div><div id="dungeon-titanite" class="info-value">-- / --</div>
            <div class="info-label">Last Reward:</div><div id="dungeon-reward" class="info-value">--</div>
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
    
    const simInputs = { avgHealth: 100, minHealth: 100, deadTitans: 0, avgEnergy: 0, currentTitanite: 0 };
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
        const simulatedProgress = { currentTitanite: parseInt(inputElements.currentTitanite.value, 10) || 0 };
        const simulatedTitansData = {
            avgHealth: parseInt(inputElements.avgHealth.value, 10) || 100,
            minHealth: parseInt(inputElements.minHealth.value, 10) || 100,
            deadTitans: parseInt(inputElements.deadTitans.value, 10) || 0,
            avgEnergy: parseInt(inputElements.avgEnergy.value, 10) || 0,
            titans: { dummy: [{ hpPercent: 100, energy: 100, isDead: false }] }, // Dati fittizi
            progress: simulatedProgress
        };
        const result = AutoProfiler.calculateRiskScore(simulatedTitansData);
        const idealProfile = AutoProfiler.settings.profileThresholds.find(p => result.finalScore <= p.maxScore)?.profile || 8;
        document.getElementById('sim-risk-score').textContent = result.finalScore;
        document.getElementById('sim-profile').textContent = `Profile ${idealProfile}`;
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
        const input = document.createElement('input'); input.type = 'number'; input.step = 0.1;
        input.value = AutoProfiler.settings.weights[key];
        input.onchange = () => { AutoProfiler.settings.weights[key] = parseFloat(input.value) || 0; AutoProfiler.saveSettings(); };
        weightsGrid.append(label, input);
    });
    container.appendChild(weightsSection);

    // --- Sezione Scalini della Titanite ---
    const titaniteTiersSection = document.createElement('div');
    titaniteTiersSection.className = 'calibrator-section';
    titaniteTiersSection.innerHTML = '<h4>Titanite Score Tiers</h4><div class="calibrator-grid"></div>';
    const tiersGrid = titaniteTiersSection.querySelector('.calibrator-grid');
    AutoProfiler.settings.titaniteTiers.forEach((tier, index) => {
        const label = document.createElement('label'); label.textContent = `Up to Titanite:`;
        const inputTitanite = document.createElement('input'); inputTitanite.type = 'number';
        inputTitanite.value = tier.maxTitanite;
        inputTitanite.onchange = () => { AutoProfiler.settings.titaniteTiers[index].maxTitanite = parseInt(inputTitanite.value, 10) || 99999; AutoProfiler.saveSettings(); };
        const label2 = document.createElement('label'); label2.textContent = `Score:`;
        const inputScore = document.createElement('input'); inputScore.type = 'number';
        inputScore.value = tier.score;
        inputScore.onchange = () => { AutoProfiler.settings.titaniteTiers[index].score = parseInt(inputScore.value, 10) || 0; AutoProfiler.saveSettings(); };
        tiersGrid.append(label, inputTitanite, label2, inputScore);
    });
    container.appendChild(titaniteTiersSection);
    
    // --- Sezione Soglie dei Profili ---
    const thresholdsSection = document.createElement('div');
    thresholdsSection.className = 'calibrator-section';
    thresholdsSection.innerHTML = '<h4>Profile Thresholds</h4><div class="calibrator-grid"></div>';
    const thresholdsGrid = thresholdsSection.querySelector('.calibrator-grid');
    AutoProfiler.settings.profileThresholds.forEach((threshold, index) => {
        const label = document.createElement('label'); label.textContent = `Activate Profile ${threshold.profile} if Risk <=`;
        const input = document.createElement('input'); input.type = 'number';
        input.value = threshold.maxScore;
        input.onchange = () => { AutoProfiler.settings.profileThresholds[index].maxScore = parseInt(input.value, 10) || 99999; AutoProfiler.saveSettings(); };
        thresholdsGrid.append(label, input);
    });
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
        const elements = [ { name: 'water', emoji: '🌊', className: 'titan-name-water' }, { name: 'fire', emoji: '🔥', className: 'titan-name-fire' }, { name: 'earth', emoji: '🌍', className: 'titan-name-earth' }, { name: 'light', emoji: '☀️', className: '' }, { name: 'dark', emoji: '🌑', className: '' }, ];
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
        if (dungeonData.primeElement !== undefined) { const opEl = document.getElementById('dungeon-opponent'); opEl.textContent = `${dungeonData.primeElement.toUpperCase()}`; opEl.className = `info-value ${dungeonData.primeElement}`; }
        if (dungeonData.currentTitanite !== undefined) document.getElementById('dungeon-titanite').textContent = `${dungeonData.currentTitanite} / ${dungeonData.maxTitanite}`;
        if (dungeonData.lastReward) { const rewardText = Object.entries(dungeonData.lastReward).map(([key, value]) => `${key.replace('dungeonActivity', 'titanite')}: ${value}`).join(', '); document.getElementById('dungeon-reward').textContent = rewardText; }
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
