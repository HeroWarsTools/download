// ==UserScript==
// @name         Brawls Goodwin
// @namespace    http://tampermonkey.net/
// @version      1.9.1
// @description  Advanced automation with robust Run-click logic and compact UI.
// @author       Partner di programming
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION & STORAGE KEYS ---
    const STORAGE_KEY_AUTO = 'BrawlsGoodwin_AutoStart';
    const STORAGE_KEY_LOGOUT = 'BrawlsGoodwin_LogoutAfter';
    const FOUR_HOURS = 4 * 60 * 60 * 1000;

    // --- 1. GUI CREATION ---
    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'fixed',
        top: '5px',
        left: '220px',     // Updated to 220px as requested
        zIndex: '10000',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: 'rgba(0,0,0,0.85)',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #444',
        fontFamily: 'sans-serif',
        minWidth: '100px' // Keeps it narrow
    });

    const btnStart = document.createElement('button');
    btnStart.innerHTML = 'Go Brawls'; // Updated name
    Object.assign(btnStart.style, {
        padding: '8px', backgroundColor: '#2ecc71', color: 'white',
        border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
    });

    // Helper to create checkboxes with multi-line support
    function createCheckbox(labelColor, htmlText, storageKey) {
        const label = document.createElement('label');
        label.style.cssText = `color: ${labelColor}; font-size: 11px; cursor: pointer; display: flex; align-items: flex-start; gap: 5px; line-height: 1.2;`;
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.style.marginTop = '2px';

        const textSpan = document.createElement('span');
        textSpan.innerHTML = htmlText; // Allows <br> for narrow layout

        label.appendChild(chk);
        label.appendChild(textSpan);

        const saved = localStorage.getItem(storageKey);
        if (saved && (Date.now() - parseInt(saved) < FOUR_HOURS)) {
            chk.checked = true;
        }

        chk.addEventListener('change', () => {
            if (chk.checked) localStorage.setItem(storageKey, Date.now().toString());
            else localStorage.removeItem(storageKey);
        });

        return chk;
    }

    const autoStartChk = createCheckbox('white', 'Auto-start (4h)', STORAGE_KEY_AUTO);
    // Added <br> after Logout for narrow layout
    const logoutAfterChk = createCheckbox('#3498db', 'Logout<br>after brawls (4h)', STORAGE_KEY_LOGOUT);

    container.appendChild(btnStart);
    container.appendChild(autoStartChk.parentNode);
    container.appendChild(logoutAfterChk.parentNode);
    document.body.appendChild(container);

    // --- 2. CORE FUNCTIONS ---

    function performLogout() {
        const logoutBtn = document.getElementById('tampermonkey-logout-button'); //
        if (logoutBtn) {
            setTimeout(() => {
                logoutBtn.click();
                console.log("Brawls Goodwin: Logout clicked.");
            }, 100);
        }
    }

    // Robust function to click 'Run' with 5 attempts every 500ms
    function clickRunRobust(attemptsLeft = 15) {
        const buttons = document.querySelectorAll('.PopUp_buttonText');
        let found = false;

        buttons.forEach(el => {
            if (el.innerText.trim() === "Run") {
                el.click();
                found = true;
            }
        });

        if (found) {
            console.log("Brawls Goodwin: 'Run' clicked successfully.");
        } else if (attemptsLeft > 1) {
            console.log(`Brawls Goodwin: 'Run' not found, retrying... (${attemptsLeft - 1} attempts left)`);
            setTimeout(() => clickRunRobust(attemptsLeft - 1), 500);
        } else {
            console.log("Brawls Goodwin: Failed to find 'Run' after 5 attempts.");
        }
    }

    function fillInputs(attemptsLeft = 20) {
        const input0 = document.getElementById('PopUpInput0');
        const input1 = document.getElementById('PopUpInput1');

        if (input0 && input1) {
            // Se i campi esistono, procedi alla compilazione
            input0.value = "20";
            input0.dispatchEvent(new Event('input', { bubbles: true }));
            input1.value = "95";
            input1.dispatchEvent(new Event('input', { bubbles: true }));
            console.log("Brawls Goodwin: Campi compilati correttamente.");
            
            // Una volta compilati, avvia la ricerca del tasto Run
            setTimeout(() => clickRunRobust(50), 700);
        } else if (attemptsLeft > 1) {
            // Se non esistono, riprova tra 500ms
            console.log(`Brawls Goodwin: Campi input non trovati, riprovo... (${attemptsLeft - 1} tentativi rimasti)`);
            setTimeout(() => fillInputs(attemptsLeft - 1), 500);
        } else {
            console.log("Brawls Goodwin: Errore critico - Campi di input non apparsi in tempo.");
        }
    }

    const runMainSequence = () => {
        const menuButtons = document.querySelectorAll('.scriptMenu_buttonText'); //
        menuButtons.forEach(el => {
            if (el.innerText.includes("Auto Brawl")) {
                el.click();
                setTimeout(fillInputs, 800);
            }
        });
    };

    // --- 3. AUTOMATION LOGIC (UPDATED) ---

    const checkDependency = setInterval(() => {
        const hwMenu = document.querySelector('.scriptMenu_buttonText');
        if (hwMenu && autoStartChk.checked) {
            clearInterval(checkDependency);
            runMainSequence();
        }
    }, 1000);

    // Monitoraggio dei tasti Stop e Continue con gestione priorità
    setInterval(() => {
        const buttons = document.querySelectorAll('.PopUp_buttonText');
        let btnStop = null;
        let btnContinue = null;

        // Identifica i pulsanti presenti nel DOM
        buttons.forEach(el => {
            const text = el.innerText.trim();
            if (text === "Continue") btnContinue = el;
            if (text === "Stop") btnStop = el;
        });

        // Logica di priorità:
        // 1. Se c'è 'Continue', clicca quello e ignora lo Stop (continua la rissa)
        if (btnContinue) {
            btnContinue.click();
            console.log("Brawls Goodwin: 'Continue' cliccato. Proseguo...");
        } 
        // 2. Se NON c'è 'Continue' ma c'è 'Stop', termina e valuta il logout
        else if (btnStop) {
            btnStop.click();
            console.log("Brawls Goodwin: 'Stop' cliccato. Fine sessione.");
            if (logoutAfterChk.checked) performLogout();
        }
    }, 5000);

    btnStart.addEventListener('click', runMainSequence);

})();
