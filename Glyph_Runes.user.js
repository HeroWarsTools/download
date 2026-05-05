// ==UserScript==
// @name             HWHGlyphAndRuneExt
// @name:en          HWHGlyphAndRuneExt
// @name:ru          HWHGlyphAndRuneExt
// @namespace        HWHGlyphAndRuneExt
// @version          1.1.3
// @description      Extension for HeroWarsHelper - Manage and Enchant Heroes Glyphs
// @description:en   Extension for HeroWarsHelper - Manage and Enchant Heroes Glyphs
// @description:ru   Расширение для HeroWarsHelper - Управление и улучшение символов героев
// @author           AI Assistant
// @match            https://www.hero-wars.com/*
// @match            https://apps-1701433570146040.apps.fbsbx.com/*
// @run-at           document-start
// @grant            none
// ==/UserScript==

(async function () {
    const loader = setInterval(() => {
        if (typeof HWHClasses !== 'undefined' && typeof HWHData !== 'undefined') {
            clearInterval(loader);
            setTimeout(init, 1000);
        }
    }, 500);

    function init() {
        console.log('%cStart Extension ' + GM_info.script.name + ', v' + GM_info.script.version, 'color: #00aaff');

        const { addExtentionName } = HWHFuncs;
        addExtentionName(GM_info.script.name, GM_info.script.version, GM_info.script.author);

        const { othersPopupButtons, i18nLangData } = HWHData;
        const { popup, I18N, confShow } = HWHFuncs;

        // --- I18N Dictionaries ---
        const i18nLangDataEn = {
            GR_MENU_BUTTON: 'Glyphs & Runes',
            GR_MENU_TITLE: 'Manage Heroes Glyphs and Runes',
            GR_POPUP_TITLE: 'Select a Hero to Manage',
            GR_BTN_CLOSE: 'Close',
            GR_BTN_BACK: 'Back',
            GR_BTN_MANAGE: 'Manage Hero',
            GR_GOLD: 'Gold',
            GR_RUNES: 'Runes',
            GR_ERR_SELECT_ONE: 'Please select exactly ONE hero.',
            GR_ERR_SELECT_GLYPH: 'Please select ONE glyph to enchant.',
            GR_ERR_GOLD: 'Not enough Gold! Minimum reserve of 1M required.',
            GR_ERR_RUNES: 'Not enough Runes to perform this action.',
            GR_ERR_MAXED: 'This glyph is already at maximum level.',
            GR_SUCCESS: 'Glyph enchanted successfully!'
        };
        i18nLangData['en'] = Object.assign(i18nLangData['en'], i18nLangDataEn);

        const i18nLangDataRu = {
            GR_MENU_BUTTON: 'Символы и Руны',
            GR_MENU_TITLE: 'Управление символами и рунами героев',
            GR_POPUP_TITLE: 'Выберите героя для управления',
            GR_BTN_CLOSE: 'Закрыть',
            GR_BTN_BACK: 'Назад',
            GR_BTN_MANAGE: 'Управлять героем',
            GR_GOLD: 'Золото',
            GR_RUNES: 'Руны',
            GR_ERR_SELECT_ONE: 'Пожалуйста, выберите ровно ОДНОГО героя.',
            GR_ERR_SELECT_GLYPH: 'Пожалуйста, выберите ОДИН символ для улучшения.',
            GR_ERR_GOLD: 'Недостаточно золота! Требуется резерв 1М.',
            GR_ERR_RUNES: 'Недостаточно рун для этого действия.',
            GR_ERR_MAXED: 'Этот символ уже максимального уровня.',
            GR_SUCCESS: 'Символ успешно улучшен!'
        };
        i18nLangData['ru'] = Object.assign(i18nLangData['ru'], i18nLangDataRu);

        // --- Constants & Config ---
        const MAX_GLYPH_PROGRESS = 43750;
        const MIN_GOLD_RESERVE = 1000000;
        const GOLD_COST_PER_POINT = 100;

        const STAT_MAP = {
            1: { en: "Strength", ru: "Сила" },
            2: { en: "Intelligence", ru: "Интеллект" },
            3: { en: "Agility", ru: "Ловкость" },
            4: { en: "Health", ru: "Здоровье" },
            5: { en: "Physical Attack", ru: "Физ. атака" },
            6: { en: "Magic Attack", ru: "Маг. атака" },
            7: { en: "Armor", ru: "Броня" },
            8: { en: "Magic Defense", ru: "Защита от магии" },
            9: { en: "Critical Hit", ru: "Крит. удар" },
            10: { en: "Dodge", ru: "Уворот" },
            11: { en: "Magic Penetration", ru: "Пробив. защиты от магии" },
            12: { en: "Armor Penetration", ru: "Пробив. брони" }
        };

        // Mapping Inventory IDs (1-4) to API Enchant IDs (14-17)
        const RUNE_CONFIG = [
            { invId: 1, apiId: 14, pts: 10, color: '#ffffff', reserve: 200 },
            { invId: 2, apiId: 15, pts: 20, color: '#55ff55', reserve: 200 },
            { invId: 3, apiId: 16, pts: 50, color: '#5555ff', reserve: 0 },
            { invId: 4, apiId: 17, pts: 100, color: '#dd55ff', reserve: 0 }
        ];

        // --- Menu Injection ---
        othersPopupButtons.push({
            get msg() { return I18N('GR_MENU_BUTTON'); },
            get title() { return I18N('GR_MENU_TITLE'); },
            result: async function () { await showMainPopup(); },
            color: 'indigo',
        });

        // --- Global Handlers ---
        window.HWHGlyphExt_OpenHero = async function (heroId) {
            popup.hide();
            await showHeroPopup(heroId);
        };

        document.addEventListener('change', (e) => {
            if (e.target && e.target.classList.contains('radio_glyph')) {
                if (e.target.checked) {
                    // Uncheck others
                    const checkboxes = popup.getCheckBoxes();
                    checkboxes.forEach(cb => {
                        if (cb !== e.target && cb.classList.contains('radio_glyph')) {
                            cb.checked = false;
                        }
                    });
                    // Save to IndexedDB
                    if (window.HWHGlyphExt_CurrentHeroId) {
                        HWHFuncs.setSaveVal('GR_Hero_' + window.HWHGlyphExt_CurrentHeroId + '_CheckedGlyph', parseInt(e.target.name));
                    }
                } else {
                    // Prevent unchecking
                    e.target.checked = true;
                }
            }
        });

        // --- UI: Main Popup (Hero List) ---
        async function showMainPopup() {
            window.HWHGlyphExt_CurrentHeroId = null; // Clear hero context
            const [heroesData, userInfo, inventory] = await Caller.send(['heroGetAll', 'userGetInfo', 'inventoryGet']);
            const heroLib = lib.data.hero;
            const lang = HWHData.userLang === 'ru' ? 'ru' : 'en';

            const headerHtml = buildHeaderHtml(userInfo, inventory);
            let heroesList = [];

            for (let id in heroesData) {
                const hero = heroesData[id];
                const staticHero = heroLib[id];

                if (hero.runes && staticHero) {
                    let maxedCount = 0;
                    for (let i = 0; i < 5; i++) {
                        if ((hero.runes[i] || 0) >= MAX_GLYPH_PROGRESS) maxedCount++;
                    }

                    if (maxedCount < 5) {
                        const heroName = cheats.translate("LIB_HERO_NAME_" + id);
                        heroesList.push({
                            id: id,
                            name: heroName,
                            maxedCount: maxedCount,
                            power: hero.power
                        });
                    }
                }
            }

            heroesList.sort((a, b) => b.power - a.power);

            let gridHtml = `<div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; max-height: 55vh; min-width: 800px; overflow-y: auto; padding: 5px; margin-top: 10px; scrollbar-width: thin; scrollbar-color: #774d10 transparent;">`;
            for (let h of heroesList) {
                gridHtml += `
                    <div onclick="window.HWHGlyphExt_OpenHero('${h.id}')" 
                         style="background: #311d13; border: 1px solid #7d5b3a; border-radius: 6px; padding: 8px; cursor: pointer; text-align: center; box-shadow: inset 0 0 5px #000; transition: filter 0.1s;"
                         onmouseover="this.style.filter='brightness(1.3)'" onmouseout="this.style.filter='none'">
                        <div style="font-weight: bold; color: #fce1ac; text-shadow: 1px 1px 2px #000; font-size: 14px;">${h.name}</div>
                        <div style="font-size: 11px; color: #ffcc00; margin-top: 4px;">[Maxed: ${h.maxedCount}/5]</div>
                    </div>
                `;
            }
            gridHtml += `</div>`;

            const buttons = [
                { result: false, isClose: true }
            ];

            const msgHtml = headerHtml + `<div style="margin-bottom: 5px; font-size: 16px; color: #fff; text-align: center;"><b>${I18N('GR_POPUP_TITLE')}</b></div>` + gridHtml;
            const answer = await popup.confirm(msgHtml, buttons, []);
            if (typeof answer === 'function') answer();
        }

        // --- UI: Hero Popup (Glyph Management) ---
        async function showHeroPopup(heroId) {
            window.HWHGlyphExt_CurrentHeroId = heroId; // Set context
            const [heroesData, userInfo, inventory] = await Caller.send(['heroGetAll', 'userGetInfo', 'inventoryGet']);
            const hero = heroesData[heroId];
            const staticHero = lib.data.hero[heroId];
            const lang = HWHData.userLang === 'ru' ? 'ru' : 'en';
            const heroName = cheats.translate("LIB_HERO_NAME_" + heroId);

            const headerHtml = buildHeaderHtml(userInfo, inventory);
            let glyphsList = [];

            // Load saved preference
            let savedGlyphIndex = HWHFuncs.getSaveVal('GR_Hero_' + heroId + '_CheckedGlyph', null);
            if (savedGlyphIndex === null || savedGlyphIndex < 0 || savedGlyphIndex > 4) {
                savedGlyphIndex = 0; // Default to first
            }

            for (let i = 0; i < 5; i++) {
                const currentProgress = hero.runes[i] || 0;
                const statId = staticHero.runes[i];
                const statName = STAT_MAP[statId] ? STAT_MAP[statId][lang] : `Stat ${statId}`;

                const isMaxed = currentProgress >= MAX_GLYPH_PROGRESS;
                const color = isMaxed ? 'Lime' : '#ffcc00';
                const progressText = isMaxed ? 'MAXED' : `${currentProgress} / ${MAX_GLYPH_PROGRESS}`;

                glyphsList.push({
                    name: i, // Index 0-4
                    label: `<span style="display: inline-block; width: 180px;">${statName}</span> <span style="color: ${color}; font-weight: bold;">${progressText}</span>`,
                    checked: (i == savedGlyphIndex),
                    class: 'radio_glyph'
                });
            }

            const buttons = [
                {
                    msg: '+ 2.500',
                    color: 'blue',
                    result: async function () { await handleEnchantClick(heroId, 2500, false); }
                },
                {
                    msg: '+ 10.000',
                    color: 'purple',
                    result: async function () { await handleEnchantClick(heroId, 10000, false); }
                },
                {
                    msg: 'MAX',
                    color: 'red',
                    result: async function () { await handleEnchantClick(heroId, MAX_GLYPH_PROGRESS, true); }
                },
                {
                    msg: I18N('GR_BTN_BACK'),
                    color: 'graphite',
                    result: async function () { await showMainPopup(); }
                },
                { result: false, isClose: true }
            ];

            const titleHtml = `<div style="margin-bottom: 10px; font-size: 16px; color: #fff;">🛡️ <b>${heroName}</b></div>`;
            const answer = await popup.confirm(headerHtml + titleHtml, buttons, glyphsList);
            if (typeof answer === 'function') answer();
        }

        // --- Helper: Build Header ---
        function buildHeaderHtml(userInfo, inventory) {
            const currentGold = userInfo.gold || 0;
            const consumables = inventory.consumable || {};
            let runesHtml = '';

            RUNE_CONFIG.forEach(rune => {
                const count = consumables[rune.invId] || 0;
                runesHtml += `<span style="margin-right: 10px; display: inline-block;">[${rune.pts}pt: <span style="color: ${rune.color}; font-weight: bold;">${count}</span>]</span>`;
            });

            return `
                <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #444; border-radius: 4px; background: rgba(0,0,0,0.2); text-align: left;">
                    <div style="color: gold; font-weight: bold; margin-bottom: 5px; font-size: 14px;">
                        💰 ${I18N('GR_GOLD')}: ${currentGold.toLocaleString()}
                    </div>
                    <div style="font-size: 13px; color: #ddd;">
                        🪨 ${I18N('GR_RUNES')}: ${runesHtml}
                    </div>
                </div>
            `;
        }

        // --- Logic: Handle Button Click ---
        async function handleEnchantClick(heroId, targetPoints, isMaxing) {
            const selected = popup.getCheckBoxes().filter(cb => cb.checked);
            if (selected.length !== 1) {
                confShow(I18N('GR_ERR_SELECT_GLYPH'));
                return await showHeroPopup(heroId);
            }

            const glyphIndex = parseInt(selected[0].name);

            // Fetch fresh data before calculating
            const [heroesData, userInfo, inventory] = await Caller.send(['heroGetAll', 'userGetInfo', 'inventoryGet']);
            const currentProgress = heroesData[heroId].runes[glyphIndex] || 0;

            if (currentProgress >= MAX_GLYPH_PROGRESS) {
                confShow(I18N('GR_ERR_MAXED'));
                return await showHeroPopup(heroId);
            }

            let pointsNeeded = isMaxing ? (MAX_GLYPH_PROGRESS - currentProgress) : targetPoints;

            // Prevent over-enchanting if user clicks +10000 but only needs 2000
            if (currentProgress + pointsNeeded > MAX_GLYPH_PROGRESS) {
                pointsNeeded = MAX_GLYPH_PROGRESS - currentProgress;
            }

            const goldNeeded = pointsNeeded * GOLD_COST_PER_POINT;
            if ((userInfo.gold || 0) - goldNeeded < MIN_GOLD_RESERVE) {
                confShow(I18N('GR_ERR_GOLD'));
                return await showHeroPopup(heroId);
            }

            // Calculate Rune Payloads
            const payloads = calculateRunes(pointsNeeded, inventory.consumable || {}, isMaxing);

            if (!payloads || payloads.length === 0) {
                confShow(I18N('GR_ERR_RUNES'));
                return await showHeroPopup(heroId);
            }

            // Execute API Calls
            for (let payload of payloads) {
                await Caller.send({
                    name: 'heroEnchantRune',
                    args: {
                        heroId: parseInt(heroId),
                        tier: glyphIndex,
                        items: { consumable: { [payload.invId]: payload.count } }
                    }
                });
                // Human delay between batches
                await new Promise(res => setTimeout(res, 600));
            }

            confShow(I18N('GR_SUCCESS'));
            await showHeroPopup(heroId); // Refresh UI
        }

        // --- Logic: Rune Math Engine ---
        function calculateRunes(pointsNeeded, consumables, isMaxing) {
            let payloads = [];
            let remainingPoints = pointsNeeded;

            for (let rune of RUNE_CONFIG) {
                if (remainingPoints <= 0) break;

                let available = consumables[rune.invId] || 0;
                let usable = available - rune.reserve;

                // Exception for MAXING: Allow dipping into reserve (max 5 runes) if it finishes the job
                if (isMaxing && remainingPoints <= (rune.pts * 5) && usable < Math.ceil(remainingPoints / rune.pts)) {
                    let neededToFinish = Math.ceil(remainingPoints / rune.pts);
                    if (neededToFinish <= 5 && available >= neededToFinish) {
                        usable = neededToFinish;
                    }
                }

                if (usable <= 0) continue;

                // Apply "Multiples of 5" rule for 10pt and 20pt runes, unless it's the final exact push for MAX
                if ((rune.invId === 1 || rune.invId === 2) && !isMaxing) {
                    usable = Math.floor(usable / 5) * 5;
                }

                let maxRunesNeeded = Math.ceil(remainingPoints / rune.pts);
                let runesToUse = Math.min(usable, maxRunesNeeded);

                if (runesToUse > 0) {
                    // Batching: Max 100 per API call
                    let remainingToBatch = runesToUse;
                    while (remainingToBatch > 0) {
                        let batchSize = Math.min(remainingToBatch, 100);
                        payloads.push({ invId: rune.invId, count: batchSize });
                        remainingToBatch -= batchSize;
                    }
                    remainingPoints -= (runesToUse * rune.pts);
                }
            }

            // If we couldn't gather enough points with available runes
            if (remainingPoints > 0) return null;

            return payloads;
        }
    }
})();
