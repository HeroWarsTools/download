// ==UserScript==
// @name        Island Pather HwH
// @namespace   HWH_IslandPath
// @version     7.3.0
// @description Supports "T" prefix (e.g. T5780) and HWHData.buttons integration
// @author      HWH Extension Architect
// @match       https://www.hero-wars.com/*
// @match       https://apps-1701433570146040.apps.fbsbx.com/*
// @grant       unsafeWindow
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_xmlhttpRequest
// @run-at      document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- Part 1: Configuration / Часть 1: Конфигурация ---
    const UNIQUE_KEY = 'IslandPather_S18';
    // Path of April 2026
    const PREDEFINED_PATH = "21;4352,4124,4118,4112,4106,4100,4094,4316,4544,4784,5030,5282,5534,5528,5522,5780,5774,5510,5252,5000,4754,4520,4286,4280,4052,3830,3620,T3410";

    // --- Part 2: Path Execution Logic / Часть 2: Логика выполнения пути ---
    async function executeIslandPath(pathObjects, seasonId) {
        const targetWindow = unsafeWindow;
        const Send = targetWindow.Send;
        const HWHFuncs = targetWindow.HWHFuncs || {};
        const setProgress = HWHFuncs.setProgress;

        console.log(`%cHWH Pather: Starting path for Season ${seasonId}`, "color: cyan");

        for (let i = 0; i < pathObjects.length; i++) {
            const step = pathObjects[i];
            const levelId = step.id;
            const isTower = step.isTower;

            if (typeof setProgress === 'function') {
                setProgress({
                    value: (i + 1) / pathObjects.length,
                    title: `Node ${levelId} ${isTower ? '(Tower)' : ''} (${i + 1}/${pathObjects.length})`
                });
            }

            try {
                // 1. MOVEMENT (exploreLevel) / 1. ДВИЖЕНИЕ (exploreLevel)
                // Added 'ident' to fix 400 error / Добавлен 'ident' для исправления ошибки 400
                const moveResult = await Send({
                    calls: [{
                        name: "seasonAdventure_exploreLevel",
                        args: { seasonAdventureId: seasonId, levelId: levelId },
                        ident: "body"
                    }]
                });

                if (moveResult && moveResult.error) {
                    console.error(`Error moving to node ${levelId}:`, moveResult.error);
                }

                // 2. TOWER CLAIM (processLevel) / 2. СБОР БАШНИ (processLevel)
                if (isTower) {
                    console.log(`%cTower ${levelId} reached! Claiming...`, "color: orange");
                    await new Promise(r => setTimeout(r, 500));

                    const claimResult = await Send({
                        calls: [{
                            name: "seasonAdventure_processLevel",
                            args: { seasonAdventureId: seasonId, levelId: levelId },
                            ident: "body"
                        }]
                    });

                    if (claimResult && claimResult.error) {
                         console.error(`Error claiming tower ${levelId}:`, claimResult.error);
                    }
                }

            } catch (e) {
                console.error("Transmission error:", e);
                break;
            }

            // Interval between nodes / Интервал между узлами
            await new Promise(r => setTimeout(r, 600));
        }

        if (typeof setProgress === 'function') setProgress({ value: 0, title: '' });
        if (HWHFuncs.popup) {
            HWHFuncs.popup.confirm('<div style="text-align: center; color: #fde5b6;">Path execution completed! / Выполнение пути завершено!</div>', [{ msg: 'OK', result: true, isClose: true }]);
        } else {
            alert("Path execution completed!");
        }
    }

    async function handlePathClick() {
        const { popup } = unsafeWindow.HWHFuncs;
        if (!popup) {
            console.error("HWH popup module not found");
            return;
        }

        // We use GM_getValue if available, otherwise fallback to localStorage
        const getValue = typeof GM_getValue === 'function' ? GM_getValue : (k, d) => {
            const v = localStorage.getItem(k);
            return v !== null ? v : d;
        };
        const setValue = typeof GM_setValue === 'function' ? GM_setValue : (k, v) => localStorage.setItem(k, v);

        const defaultPaths = "#MENU_NAME=Island Path\nDefault Path | 18;3938,3722,3518,3314,3308,3110,3104,3098,3290,3284,3278,3272,3074,3068,3062,3254,3458,3668,3884,4106,4334,4568,4574,4580,4586,4826,4832,T4598,2912,2732,2558,2564,2570,2402,2240,2084,1934,1940,1946,2102,2264,2426,2420,2588,2768,2954,2960,3152,T3344";
        let savedPathsStr = getValue('island_paths_v2', defaultPaths);

        // Save directly to the global window context to avoid DOM lifecycle issues
        unsafeWindow.islandPatherTempText = savedPathsStr;

        const escapeHTML = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const contentHTML = `
            <div style="text-align: center; font-size: 14px; width: 600px; max-width: 90vw;">
                <h3 style="color: #fde5b6; margin-bottom: 10px;">Island Pather Configuration</h3>
                <p style="color: #888; font-size: 12px; margin-bottom: 5px;">Format: #MENU_NAME=... OR Name | Tooltip | SeasonID;Node1,Node2...</p>
                <textarea oninput="window.islandPatherTempText = this.value" style="width: 100%; height: 180px; background: #1a1a1a; color: #fff; border: 1px solid #444; padding: 5px; margin-bottom: 10px; font-family: monospace; font-size: 12px; resize: vertical;">${escapeHTML(savedPathsStr)}</textarea>
            </div>
        `;

        const buttons = [];

        // Parse saved paths to generate buttons
        const lines = savedPathsStr.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (line.startsWith('#MENU_NAME=')) continue;

            const partsStr = line.split('|');
            if (partsStr.length < 2) continue;

            const pathName = partsStr[0].trim();
            let tooltip = '';
            let pathData = '';

            if (partsStr.length >= 3) {
                tooltip = partsStr[1].trim();
                pathData = partsStr[2].trim();
            } else {
                pathData = partsStr[1].trim();
            }

            const buttonMsg = tooltip ? '<span title="' + escapeHTML(tooltip) + '">▶ ' + escapeHTML(pathName) + '</span>' : '▶ ' + escapeHTML(pathName);

            buttons.push({
                msg: buttonMsg,
                color: 'blue',
                result: { action: 'run', data: pathData }
            });
        }

        // Ghost button per tentare di separare le righe
        buttons.push({
            msg: '<div style="width:100%; height:1px;"></div>',
            color: 'none',
            result: { action: 'none' }
        });

        // Add Update from GitHub button
        buttons.push({
            msg: 'Update from GitHub',
            color: 'purple',
            result: { action: 'update_github' }
        });

        // Add Save button
        buttons.push({
            msg: 'Save / Сохранить',
            color: 'green',
            result: { action: 'save' }
        });

        // Close button
        buttons.push({ result: false, isClose: true });

        const answer = await popup.confirm(contentHTML, buttons);

        if (!answer || typeof answer !== 'object') return; // User closed

        if (answer.action === 'none') {
            setTimeout(handlePathClick, 100);
            return;
        }

        if (answer.action === 'update_github') {
            if (typeof GM_xmlhttpRequest !== 'function') {
                await popup.confirm('<div style="color:red; text-align:center;">GM_xmlhttpRequest not available.<br>Please allow it in Tampermonkey.</div>', [{ msg: 'OK', result: true, isClose: true }]);
                setTimeout(handlePathClick, 100);
                return;
            }

            GM_xmlhttpRequest({
                method: "GET",
                url: "https://github.com/HeroWarsTools/profiles/raw/refs/heads/main/island.txt?nocache=" + new Date().getTime(),
                onload: function(response) {
                    if (response.status === 200) {
                        const newText = response.responseText;
                        setValue('island_paths_v2', newText);
                        unsafeWindow.islandPatherTempText = newText;
                        setTimeout(handlePathClick, 100); // Reopen to show new layout
                    } else {
                        console.error("Failed to fetch GitHub config", response);
                        setTimeout(handlePathClick, 100);
                    }
                },
                onerror: function(err) {
                    console.error("Error fetching GitHub config", err);
                    setTimeout(handlePathClick, 100);
                }
            });
            return; // Wait for async response
        }

        if (answer.action === 'save') {
            setValue('island_paths_v2', unsafeWindow.islandPatherTempText);
            // Re-open to show updated buttons
            setTimeout(handlePathClick, 100);
            return;
        }

        if (answer.action === 'run') {
            // Process pathData
            const input = answer.data;
            const parts = input.split(';');
            if (parts.length !== 2) {
                await popup.confirm('<div style="text-align: center; color: red;">Invalid format. / Неверный формат.</div>', [{ msg: 'OK', result: true, isClose: true }]);
                return;
            }

            const seasonId = parseInt(parts[0].trim(), 10);
            const pathRaw = parts[1].split(',');
            const pathObjects = [];

            for (let item of pathRaw) {
                item = item.trim();
                if (!item) continue;
                let isTower = item.toUpperCase().startsWith('T');
                const id = parseInt(isTower ? item.substring(1) : item, 10);
                if (!isNaN(id)) pathObjects.push({ id: id, isTower: isTower });
            }

            if (isNaN(seasonId) || pathObjects.length === 0) return;

            // Navigation to Adventure if needed / Переход к приключениям, если нужно
            if (unsafeWindow.goNavigtor) unsafeWindow.goNavigtor('ADVENTURE');

            executeIslandPath(pathObjects, seasonId);
        }
    }

    // --- Part 3: HWH Registration / Часть 3: Регистрация HWH ---
    function initRegistration() {
        if (!unsafeWindow.HWHData || !unsafeWindow.HWHData.buttons) return;

        // We use GM_getValue if available, otherwise fallback to localStorage
        const getValue = typeof GM_getValue === 'function' ? GM_getValue : (k, d) => {
            const v = localStorage.getItem(k);
            return v !== null ? v : d;
        };

        // Register button in HWH framework / Регистрация кнопки в фреймворке HWH
        unsafeWindow.HWHData.buttons[UNIQUE_KEY] = {
            get name() {
                const savedPathsStr = getValue('island_paths_v2', '');
                const match = savedPathsStr.match(/^#MENU_NAME=(.+)$/m);
                return match ? match[1].trim() : 'Island Path';
            },
            get title() { return 'Execute Season Path / Выполнить путь сезона'; },
            color: 'blue',
            onClick: async function() {
                await handlePathClick();
            }
        };
    }

    // Monitoring for HWH initialization / Мониторинг инициализации HWH
    const checkInterval = setInterval(() => {
        if (unsafeWindow.HWHClasses && unsafeWindow.HWHData) {
            initRegistration();
            clearInterval(checkInterval);
            console.log("HWH Pather: Registered / Зарегистрировано");
        }
    }, 1000);

})();
