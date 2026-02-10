// ==UserScript==
// @name            HWH Titan Monitor
// @namespace       HWH_Titan_Monitor
// @version         3.2.2
// @description     Active Risk Control: Forced DOM Injection
// @author          Extension Architect
// @match           https://www.hero-wars.com/*
// @match           https://apps-1701433570146040.apps.fbsbx.com/*
// @grant           none
// @run-at          document-start
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        id: 'TITAN_MONITOR',
        label: 'TiStats',
        color: '#8e44ad',
        anchorId: 'doOthers'
    };

    const DATA_SOURCE = 'HWH_TitanStats';
    const UPDATE_INTERVAL_MS = 2000;
    const CONTAINER_ID = 'hwh-titan-live-monitor-content';

    let lastAppliedProfile = null;

    /**
     * INIEZIONE FORZATA
     * Crea un elemento script fisico nella pagina per eseguire il comando
     * nel contesto globale (window) saltando l'isolamento degli userscript.
     */
    function executeInGlobalContext(profileNum) {
        console.log(`[RiskControl] Sending Profile ${profileNum} to Global Context`);

        const code = `
            if (window.HWH_Dgn_Profiles && typeof window.HWH_Dgn_Profiles.apply === 'function') {
                window.HWH_Dgn_Profiles.apply(${profileNum});
                console.log('%c[Monitor Trigger] Profile ${profileNum} Applied Successfully', 'color: #8e44ad; font-weight: bold;');
            } else {
                console.error('[Monitor Trigger] HWH_Dgn_Profiles not found in global window');
            }
        `;

        const script = document.createElement('script');
        script.textContent = code;
        (document.head || document.documentElement).appendChild(script);
        script.remove(); // Pulizia immediata
    }

    const RiskEngine = {
        calculate: function(data) {
            if (!data || !data.view) return 0;

            let minHP = 100, minEnergyElements = 1000, titansFound = false;
            const energyFilter = ['fire', 'earth', 'water'];

            for (const element in data.view) {
                const titans = data.view[element];
                const isEnergyElement = energyFilter.includes(element);
                titans.forEach(t => {
                    const status = t.status || "";
                    const hpMatch = status.match(/❤️(\d+)/), enMatch = status.match(/⚡(\d+)/);
                    if (hpMatch && enMatch) {
                        const hp = parseInt(hpMatch[1]), en = parseInt(enMatch[1]);
                        if (hp < minHP) minHP = hp;
                        if (isEnergyElement && en < minEnergyElements) minEnergyElements = en;
                        titansFound = true;
                    }
                });
            }

            if (!titansFound) return 0;

            const total = parseFloat((Math.abs(data.dungeonBuff || 0) + (100 - minHP) + ((1000 - minEnergyElements) / 10 * 0.3)).toFixed(1));
            this.handleProfileSync(total);
            return total;
        },

        handleProfileSync: function(score) {
            let currentProfile = 1;
            if (score >= 81) currentProfile = 4;
            else if (score >= 56) currentProfile = 3;
            else if (score >= 29) currentProfile = 2;
            else currentProfile = 1;

            if (currentProfile !== lastAppliedProfile) {
                executeInGlobalContext(currentProfile);
                lastAppliedProfile = currentProfile;
            }
        },

        getColor: function(score) {
            if (score >= 81) return '#ff4d4d'; // Rosso
            if (score >= 56) return '#ff9f43'; // Arancio
            if (score >= 29) return '#adff2f'; // Giallo/Verde
            return '#2ecc71';                // Verde
        }
    };

    // --- Interfaccia Grafica ---

    function generateContentHtml(data) {
        const riskScore = RiskEngine.calculate(data);
        const riskColor = RiskEngine.getColor(riskScore);
        const elements = [
            { key: 'water', icon: '🌊', color: '#3498db' }, { key: 'fire', icon: '🔥', color: '#e74c3c' },
            { key: 'earth', icon: '🌍', color: '#2ecc71' }, { key: 'light', icon: '☀️', color: '#f1c40f' },
            { key: 'dark', icon: '🌑', color: '#9b59b6' }
        ];

        return `
        <div style="padding: 15px; min-width: 600px; font-family: sans-serif; background: #1a1a1a; color: #eee; border-radius: 10px;">
            <div style="margin-bottom: 12px; padding: 10px; border: 2px solid ${riskColor}; border-radius: 8px; background: rgba(0,0,0,0.3); text-align: center; position: relative;">
                <div style="font-size: 10px; color: #888; text-transform: uppercase;">Titan Risk Factor</div>
                <div style="font-size: 36px; font-weight: bold; color: ${riskColor};">${riskScore}</div>
                <div style="position: absolute; right: 15px; top: 15px; font-size: 10px; color: ${riskColor}; border: 1px solid ${riskColor}; padding: 2px 6px; border-radius: 4px;">
                    PROFILE ${lastAppliedProfile || 1}
                </div>
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

    function renderColumn(el, data) {
        const titans = (data && data.view && data.view[el.key]) ? data.view[el.key] : [];
        return `<div style="flex: 1; border: 2px solid #444; border-radius: 6px; padding: 6px; background: rgba(0,0,0,0.4);">
            <div style="text-align: center; color: ${el.color}; font-weight: bold; border-bottom: 1px solid #555; margin-bottom: 5px; font-size: 16px;">${el.icon}</div>
            ${titans.map(t => `<div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px;">
                <span style="color: #ccc; overflow: hidden; white-space: nowrap; max-width: 75px;">${t.name}</span>
                <span style="color: #fff; font-family: monospace;">${t.status}</span>
            </div>`).join('')}
        </div>`;
    }

    function renderBuffCard(data) {
        const buff = data?.dungeonBuff || 0;
        const color = buff < 0 ? '#e74c3c' : (buff > 0 ? '#2ecc71' : '#95a5a6');
        return `<div style="flex: 1; border: 2px solid ${color}; border-radius: 6px; padding: 8px; background: rgba(0,0,0,0.6); display: flex; flex-direction: column; justify-content: center; text-align: center;">
            <div style="color: #f39c12; font-weight: bold; font-size: 14px;">🔮 BUFF</div>
            <div style="font-size: 24px; font-weight: bold; color: ${color};">${buff}%</div>
        </div>`;
    }

    function openLivePanel() {
        const wrapperHtml = `<div id="${CONTAINER_ID}">${generateContentHtml(window[DATA_SOURCE])}</div>`;
        const p = window.HWHFuncs.popup.confirm(wrapperHtml, [{ msg: 'Close', result: false, isCancel: true }], []);
        if (p && typeof p === 'object') {
            p.isCloseButton = true;
            if (p.render) p.render();
            const footer = document.querySelector('.hwh-popup-footer');
            if (footer) footer.style.display = 'none';
        }
        const updateTimer = setInterval(() => {
            const container = document.getElementById(CONTAINER_ID);
            if (!container) return clearInterval(updateTimer);
            container.innerHTML = generateContentHtml(window[DATA_SOURCE]);
        }, UPDATE_INTERVAL_MS);
    }

    function init() {
        if (!window.HWHData || !window.HWHData.buttons) return;
        const oldButtons = window.HWHData.buttons;
        const newButtons = {};
        for (const key in oldButtons) {
            newButtons[key] = oldButtons[key];
            if (key === CONFIG.anchorId) {
                newButtons[CONFIG.id] = { get name() { return CONFIG.label; }, color: CONFIG.color, onClick: openLivePanel };
            }
        }
        window.HWHData.buttons = newButtons;
    }

    const loader = setInterval(() => {
        if (typeof window.HWHClasses !== 'undefined' && typeof window.HWHData !== 'undefined') {
            clearInterval(loader);
            setTimeout(init, 1000);
        }
    }, 500);
})();