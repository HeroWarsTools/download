// ==UserScript==
// @name         HWH Ext Campaign Auto Select
// @namespace    HWH_Extensions
// @version      1.1.0
// @description  v1.1: Intercepts run() command. Silently imports W2 profile and selects P1 (odd) or P2 (even).
// @author       ZingerY (Logic) & Gemini (Architect)
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        dbName: 'HeroWarsHelper',
        storeName: 'settings'
    };

    let isPreparing = false;

    /**
     * @AI-REFERENCE: DATABASE MODULE
     */
    class HWHExtensionDB {
        constructor(dbName, storeName) {
            this.dbName = dbName;
            this.storeName = storeName;
            this.db = null;
        }

        async open() {
            return new Promise((resolve, reject) => {
                let request = indexedDB.open(this.dbName);
                request.onsuccess = (e) => {
                    this.db = e.target.result;
                    resolve();
                };
                request.onerror = (e) => reject(e);
            });
        }

        async get(key, def) {
            return new Promise(async (resolve) => {
                try {
                    if (!this.db) await this.open();
                    const transaction = this.db.transaction([this.storeName], 'readonly');
                    const request = transaction.objectStore(this.storeName).get(key);
                    request.onsuccess = () => resolve(request.result === undefined ? def : request.result);
                    request.onerror = () => resolve(def);
                } catch (e) {
                    console.error("[HWH AutoSelect] DB Get Error:", e);
                    resolve(def);
                }
            });
        }

        async set(key, value) {
            return new Promise(async (resolve, reject) => {
                try {
                    if (!this.db) await this.open();
                    const transaction = this.db.transaction([this.storeName], 'readwrite');
                    const request = transaction.objectStore(this.storeName).put(value, key);
                    transaction.oncomplete = () => resolve();
                    transaction.onerror = (e) => reject(e);
                } catch (e) {
                    console.error("[HWH AutoSelect] DB Set Error:", e);
                    reject(e);
                }
            });
        }
    }

    /**
     * @AI-REFERENCE: LIFECYCLE
     */
    const loader = setInterval(() => {
        if (typeof unsafeWindow.HWHClasses !== 'undefined' &&
            typeof unsafeWindow.HWHFuncs !== 'undefined' &&
            typeof unsafeWindow.HWHData !== 'undefined' &&
            typeof unsafeWindow.HWH_CampAuto_API !== 'undefined') {
            clearInterval(loader);
            setTimeout(init, 2000);
        }
    }, 500);

    async function getUserId() {
        const cached = unsafeWindow.HWHFuncs.getUserInfo();
        if (cached && cached.id) return cached.id;
        try {
            const data = await unsafeWindow.Caller.send("userGetInfo");
            return data?.id || 0;
        } catch(e) {
            return 0;
        }
    }

    /**
     * Core logic extracted so it can be called on startup AND on intercept
     */
    async function prepareCampaignData() {
        if (isPreparing) {
            console.log("[HWH AutoSelect] Preparation already in progress. Waiting...");
            // Wait until the current preparation finishes
            while(isPreparing) { await new Promise(r => setTimeout(r, 200)); }
            return;
        }
        
        isPreparing = true;
        try {
            console.log("[HWH AutoSelect] Importing W2 profile...");
            await unsafeWindow.HWH_CampAuto_API.importWeb('W2');
            await new Promise(resolve => setTimeout(resolve, 1500));

            const day = new Date().getDate();
            const profileIndex = (day % 2 === 0) ? 2 : 1;
            console.log(`[HWH AutoSelect] Today is day ${day}. Selecting Profile ${profileIndex}.`);

            const db = new HWHExtensionDB(CONFIG.dbName, CONFIG.storeName);
            await db.open();
            const userId = await getUserId();

            if (!userId) {
                console.error("[HWH AutoSelect] Could not determine User ID.");
                return;
            }

            const allSettings = await db.get(userId, {});
            
            if (allSettings.campaignAutomator?.profiles?.[profileIndex]) {
                const selectedProfile = allSettings.campaignAutomator.profiles[profileIndex];
                Object.assign(allSettings.campaignAutomator, selectedProfile);
                await db.set(userId, allSettings);
                console.log(`[HWH AutoSelect] Profile ${profileIndex} successfully set as active.`);
            } else {
                console.warn(`[HWH AutoSelect] Profile ${profileIndex} not found in DB.`);
            }
        } catch (error) {
            console.error("[HWH AutoSelect] Error during preparation:", error);
        } finally {
            isPreparing = false;
        }
    }

    async function init() {
        console.log(`[HWH Ext] Campaign Auto Select v${GM_info.script.version} Loaded`);

        // --- API INTERCEPTION (Monkey Patching) ---
        const originalRun = unsafeWindow.HWH_CampAuto_API.run;
        
        unsafeWindow.HWH_CampAuto_API.run = async function() {
            console.log("[HWH AutoSelect] Intercepted run() command! Preparing data first...");
            await prepareCampaignData();
            console.log("[HWH AutoSelect] Data prepared. Executing original run()...");
            originalRun(); // Call the original Automator function
        };
        // ------------------------------------------

        // Run once on startup as well
        await prepareCampaignData();
        console.log("[HWH AutoSelect] Startup preparation done. Triggering checkAuto...");
        unsafeWindow.HWH_CampAuto_API.checkAuto();
    }

})();
