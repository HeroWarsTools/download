// ==UserScript==
// @name             HWH Seer's Game
// @name:en          HWH Seer's Game
// @name:ru          HWH Игра Провидца
// @namespace        HWH_SeersGame_Extension
// @version          1.0
// @description      Adds a button to the HWH 'Others' menu to automate the Seer's Game event.
// @description:en   Adds a button to the HWH 'Others' menu to automate the Seer's Game event.
// @description:ru   Добавляет кнопку в меню "Другое" HWH для автоматизации ивента Игра Провидца.
// @author           HWH Extension Architect
// @match            https://www.hero-wars.com/*
// @match            https://apps-1701433570146040.apps.fbsbx.com/*
// @grant            unsafeWindow
// @run-at           document-start
// ==/UserScript==

(function () {
    'use strict';

    // --- DO NOT EDIT THIS SECTION ---
    // Standard HWH extension loader.
    const loader = setInterval(() => {
        if (typeof unsafeWindow.HWHClasses !== 'undefined' && typeof unsafeWindow.HWHData !== 'undefined') {
            clearInterval(loader);
            setTimeout(init, 1000);
        }
    }, 500);

    /**
     * Main function, executed after HWH is loaded.
     */
    function init() {
        console.log('%c[HWH Seer\'s Game] Script initialized.', 'color: #8A2BE2; font-weight: bold;');

        const { HWHData } = unsafeWindow;
        const { othersPopupButtons } = HWHData;

        // --- @AI-REFERENCE: ANCHOR INJECTION LOGIC ---
        othersPopupButtons.push({
            msg: "Seer's Game / Игра Провидца",
            title: "Auto-play Seer's Game / Автоигра Провидца",
            color: 'violet',
            result: function () {
                console.log("[HWH Seer's Game] Button clicked, starting automation...");
                new SeerGame().start();
            }
        });
    }

    /**
     * SeerGame Class
     * Logic provided by user, adapted to use unsafeWindow for global game objects.
     */
    class SeerGame {
        constructor() {
            // Accessing global game data and caller from unsafeWindow
            this.lib = unsafeWindow.lib;
            this.Caller = unsafeWindow.Caller;

            if (!this.lib || !this.Caller) {
                console.error("[HWH Seer's Game] Error: 'lib' or 'Caller' not found in global scope.");
                return;
            }

            this.roundResumePrice = Object.values(this.lib.data.eventPicker.roundResumePrice);
            this.spentCoins = 0;
            this.endMsg = '';
        }

        async start() {
            if (!this.Caller) return;

            const [state, inventory] = await this.Caller.send(['eventPicker_getState', 'inventoryGet']);
            this.event = state.event;
            this.eventCoinId = this.lib.data.eventPicker.events[this.event.id].clientData.eventCoinId;
            this.coins = inventory.coin[this.eventCoinId];

            console.log(state, inventory);
            console.log(`Starting! Coins: ${this.coins}`);

            if (this.event.state === 'new_game') {
                const result = await this.startGame();
                if (!result) {
                    this.endGame();
                    return;
                }
            }

            if (this.event.state === 'active') {
                void this.round();
                return;
            }

            console.log('state', this.event.state);
        }

        random(min, max) {
            return Math.floor(Math.random() * (max - min + 1) + min);
        }

        async round() {
            while (1) {
                console.log(`Round ${this.event.round}, Win streak: ${this.event.win_streak}`);

                if (this.event.round === 7 && this.event.win_streak < 30) {
                    console.log('Restarting game...');
                    await this.finishGame();
                    const result = await this.startGame();
                    if (!result) {
                        this.endGame();
                        return;
                    }
                }

                const marksCount = this.event.mark_history.length;
                const nextCost = this.getResumePrice(marksCount + 1);
                if (this.coins < nextCost) {
                    console.log();
                    this.endGame('Not enough coins to continue in case of failure');
                    return;
                }

                const num = this.random(1, this.event.size);
                const playRound = await this.Caller.send({ name: 'eventPicker_playRound', args: { num } });
                console.log(`Selected card ${num}`);
                console.log('playRound', playRound);
                this.event = playRound.event;

                if (playRound.result === 'win') {
                    console.log('Success! Continuing game...');
                    continue;
                }

                if (playRound.result === 'lose') {
                    console.log('Failure!');
                    const result = await this.resumeGame();
                    if (!result) {
                        this.endGame();
                        return;
                    }
                }
            }
        }

        getResumePrice(marksCount) {
            const resumePrice = this.roundResumePrice.find((e) => e.eventId === this.event.id && e.marksCount === marksCount);
            return resumePrice.resumePrice.coin[this.eventCoinId];
        }

        async resumeGame() {
            const marksCount = this.event.mark_history.length;
            const cost = this.getResumePrice(marksCount);
            if (this.coins < cost) {
                this.endMsg = 'Not enough coins to continue the game';
                return false;
            }
            console.log(`Continuing game for ${cost} coins`);
            const resumeGame = await this.Caller.send('eventPicker_resumeGame');
            this.coins -= cost;
            this.spentCoins += cost;
            console.log('resumeGame', resumeGame);
            this.event = resumeGame.event;
            return true;
        }

        async startGame() {
            if (this.coins < 25) {
                this.endMsg = 'Not enough coins to start the game';
                return false;
            }
            console.log('Starting new game for 25 coins');
            const startGame = await this.Caller.send('eventPicker_startGame');
            this.coins -= 25;
            this.spentCoins += 25;
            console.log('startGame', startGame);
            this.event = startGame.event;
            return true;
        }

        async finishGame() {
            console.log('Finishing game, collecting rewards');
            const finishGame = await this.Caller.send('eventPicker_finishGame');
            console.log('finishGame', finishGame);
            this.event = finishGame.event;
        }

        endGame(endMsg) {
            console.log(this.endMsg || endMsg);
            console.log(`SeerGame completed, spent ${this.spentCoins} coins`);
            // Optional: Alert the user via HWH native popup when done
            if (typeof unsafeWindow.HWHFuncs !== 'undefined' && typeof unsafeWindow.HWHFuncs.confShow === 'function') {
                unsafeWindow.HWHFuncs.confShow(`Seer's Game completed! / Игра Провидца завершена!\nSpent coins: ${this.spentCoins}`);
            }
        }
    }

})();
