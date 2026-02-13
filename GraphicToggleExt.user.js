// ==UserScript==
// @name             HWHGraphicsToggleExt
// @name:en          HWHGraphicsToggleExt
// @name:ru          HWHGraphicsToggleExt
// @namespace        HWHGraphicsToggleExt
// @version          1.1
// @description      Toggle game graphics using emojis to avoid rendering bugs.
// @author           Senior HWH Tech
// @match            https://www.hero-wars.com/*
// @match            https://apps-1701433570146040.apps.fbsbx.com/*
// @grant            unsafeWindow
// @run-at           document-start
// ==/UserScript==

(function () {
    'use strict';

    /**
     * Attende che il framework HWH sia pronto.
     */
    function waitForHWH(callback) {
        const interval = setInterval(() => {
            if (unsafeWindow.HWHClasses && unsafeWindow.HWHData && unsafeWindow.HWHData.buttons && unsafeWindow.HWHFuncs) {
                clearInterval(interval);
                callback();
            }
        }, 100);
    }

    /**
     * Logica principale dell'estensione.
     */
    async function runExtension() {
        const SCRIPT_NAME = "HWHGraphicsToggleExt";
        console.log(`%c[${SCRIPT_NAME}] Initializing...`, 'color: red');

        const { HWHFuncs, HWHData } = unsafeWindow;
        const { addExtentionName, popup, I18N } = HWHFuncs;

        // 1. Registrazione estensione nel framework
        addExtentionName(SCRIPT_NAME, "1.1", "Senior HWH Tech");

        // 2. Traduzioni necessarie (Sostituite con Emoji)
        const i18nLangDataEn = {
            HB_GRAPHICS_SWITCH_ON_TITLE: 'Turn on game graphics',
            HB_GRAPHICS_SWITCH_OFF_TITLE: 'Turn off game graphics',
            HB_GRAPHICS_SWITCH_OFF_MESSAGE: 'You are going to turn OFF game graphics. The game will restart.',
            HB_GRAPHICS_SWITCH_ON_MESSAGE: 'You are going to turn ON game graphics. The game will restart.',
            HB_DO_NOT_SHOW_AGAIN: "Don't show again",
            HB_APPLY: 'Apply',
        };
        HWHData.i18nLangData['en'] = Object.assign(HWHData.i18nLangData['en'] || {}, i18nLangDataEn);

        // 3. Stato della grafica
        let graphicsEnabled = true;
        let doNotShowAgain = false;
        try {
            const buttonState = JSON.parse(localStorage.getItem('buttonState'));
            if (buttonState) {
                graphicsEnabled = buttonState.graphicsEnabled;
                doNotShowAgain = buttonState.doNotShowAgain;
            }
        } catch (e) {}

        // Se la grafica deve essere spenta, blocchiamo il rendering
        if (!graphicsEnabled) {
            unsafeWindow.requestAnimationFrame = async function () {
                await new Promise((resolve) => setTimeout(resolve, 100000000));
            };
        }

        // 4. Funzioni di supporto
        async function toggleGraphics() {
            if (!doNotShowAgain) {
                const msg = graphicsEnabled ? I18N('HB_GRAPHICS_SWITCH_OFF_MESSAGE') : I18N('HB_GRAPHICS_SWITCH_ON_MESSAGE');
                const answer = await popup.confirm(msg, [
                    { msg: I18N('HB_APPLY'), result: true, color: 'green' },
                    { msg: I18N('BTN_CANCEL'), result: false, isCancel: true, color: 'red' },
                ], [{ name: 'skip', label: I18N('HB_DO_NOT_SHOW_AGAIN'), checked: false }]);
                
                if (!answer) return;
                if (popup.getCheckBoxes()[0].checked) doNotShowAgain = true;
            }
            
            localStorage.setItem('buttonState', JSON.stringify({ 
                graphicsEnabled: !graphicsEnabled, 
                doNotShowAgain: doNotShowAgain 
            }));
            location.reload();
        }

        // 5. Configurazione del nuovo pulsante combinato con EMOJI
        const newDoOthersButtonConfig = {
            isCombine: true,
            combineList: [
                {
                    get name() { return I18N('OTHERS'); },
                    get title() { return I18N('OTHERS_TITLE'); },
                    onClick: async function () {
                        const { othersPopupButtons } = unsafeWindow.HWHData;
                        const buttonsToShow = othersPopupButtons.filter(b => b.result !== false);
                        buttonsToShow.push({ result: false, isClose: true });
                        const answer = await popup.confirm(`${I18N('CHOOSE_ACTION')}:`, buttonsToShow);
                        if (typeof answer === 'function') answer();
                    },
                    classes: ['scriptMenu_otherButton']
                },
                {
                    get name() { 
                        // Uso diretto delle emoji per evitare il bug di rendering
                        return graphicsEnabled ? '💡' : '⚫'; 
                    },
                    get title() {
                        return graphicsEnabled ? I18N('HB_GRAPHICS_SWITCH_OFF_TITLE') : I18N('HB_GRAPHICS_SWITCH_ON_TITLE');
                    },
                    onClick: toggleGraphics
                },
            ],
        };

        // 6. Ricostruzione ordinata dell'oggetto buttons
        const originalButtons = { ...HWHData.buttons };
        const buttonOrder = Object.keys(originalButtons);

        for (const key of buttonOrder) {
            delete HWHData.buttons[key];
        }

        for (const key of buttonOrder) {
            if (key === 'doOthers') {
                HWHData.buttons[key] = newDoOthersButtonConfig;
            } else {
                HWHData.buttons[key] = originalButtons[key];
            }
        }

        console.log(`%c[${SCRIPT_NAME}] Graphics Toggle registered with Emojis.`, 'color: green');
    }

    waitForHWH(runExtension);
})();