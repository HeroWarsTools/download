// ==UserScript==
// @name         Ext HwH Stage Rewards Collector (Auto)
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  Automatically collects multi-stage event rewards after an 8.4s delay.
// @author       YourName
// @match        https://www.hero-wars.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    /**
     * This is the proven function from v4.0 that correctly handles multi-stage offers.
     */
    async function collectStagedEventRewards() {
        const Send = unsafeWindow.Send;
        const HWHFuncs = unsafeWindow.HWHFuncs;
        let totalCollectedCount = 0;
        let loopCount = 0;
        const maxLoops = 10; // Safety break to prevent infinite loops

        HWHFuncs.setProgress("Auto-collecting Stage Rewards...", false);

        while (loopCount < maxLoops) {
            loopCount++;
            let collectedInThisLoop = 0;

            try {
                const response = await Send({
                    calls: [{ name: "specialOffer_getAll", args: {}, ident: "specialOffer_getAll" }]
                });

                if (!response || !response.results) {
                    console.log("Extension: Invalid response from server, stopping loop.");
                    break;
                }

                const specialOffers = response.results[0].result.response;

                // The simple, effective filter from the version that worked
                const collectibleOffers = specialOffers.filter(offer =>
                    offer.offerType === "stagesOffer" && !offer.freeRewardObtained
                );

                if (collectibleOffers.length === 0) {
                    break; // Exit the loop if no more collectible offers are found
                }

                const callsToMake = collectibleOffers.map(offer => ({
                    name: "specialOffer_farmReward",
                    args: { offerId: offer.id },
                    ident: `specialOffer_farmReward_${offer.id}_loop${loopCount}`
                }));

                const farmResult = await Send({ calls: callsToMake });

                if (farmResult && farmResult.results) {
                    collectedInThisLoop = farmResult.results.length;
                    totalCollectedCount += collectedInThisLoop;
                    HWHFuncs.setProgress(`Collected ${totalCollectedCount} rewards...`, false);
                } else {
                    break; // Exit loop if farming fails or returns no results
                }
            } catch (error) {
                console.error("Extension: An error occurred during collection loop:", error);
                HWHFuncs.setProgress('Error during collection.', true);
                break;
            }

            if (collectedInThisLoop === 0) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
        }

        if (totalCollectedCount > 0) {
            HWHFuncs.setProgress(`${HWHFuncs.I18N('COLLECTED')} ${totalCollectedCount} ${HWHFuncs.I18N('REWARD')}`, true);
        } else {
            HWHFuncs.setProgress(HWHFuncs.I18N('NOTHING_TO_COLLECT'), true);
        }
    }

    /**
     * Initializes the extension, adding a manual button and starting the auto-run timer.
     */
    function initializeExtension() {
        // Add the manual button as a backup
        const scriptMenu = unsafeWindow.HWHClasses.ScriptMenu.getInst();
        scriptMenu.addButton({
            name: 'Collect Stage Rewards',
            title: 'Manually collect multi-stage event rewards',
            onClick: () => unsafeWindow.HWHFuncs.confShow(`Run script to collect stage rewards?`, collectStagedEventRewards),
            color: 'green'
        });

        console.log("Stage Rewards Extension: Starting 8.4-second timer for automatic collection.");

        // Set a timer to run the collection automatically
        setTimeout(() => {
            console.log("Stage Rewards Extension: Timer finished. Running automatic collection.");
            collectStagedEventRewards();
        }, 8400); // 8400 milliseconds = 8.4 seconds
    }

    /**
     * Waits for HwH to be ready.
     */
    function waitForHwH() {
        const interval = setInterval(() => {
            if (unsafeWindow.HWHFuncs &&
                unsafeWindow.HWHClasses &&
                unsafeWindow.HWHClasses.ScriptMenu.getInst &&
                document.querySelector('.scriptMenu_main')) {

                clearInterval(interval);
                initializeExtension();
            }
        }, 500);
    }

    // Start the whole process
    waitForHwH();
})();
