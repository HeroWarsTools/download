// ==UserScript==
// @name         Ext HwH Stage Rewards Collector (Auto)
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  Beta: Automatically collects multi-stage event rewards (includes saleShowcase fixes).
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

                console.log("Extension: specialOffer_getAll response received. Total offers:", specialOffers.length);
                console.log("Extension: Raw specialOffers:", JSON.stringify(specialOffers.slice(0, 3), null, 2));

                // Accept multiple known collectible types (stagesOffer, saleShowcase, etc.)
                const collectibleTypes = ['stagesOffer', 'saleShowcase', 'dailyReward'];
                const collectibleOffers = specialOffers.filter(offer => {
                    const isKnownType = collectibleTypes.includes(offer.offerType);
                    // For saleShowcase, we don't check freeRewardObtained since it might not exist
                    // For other types, check if reward hasn't been obtained yet
                    const isNotCollected = (offer.offerType === 'saleShowcase') || !offer.freeRewardObtained;
                    console.log(`Extension: Offer ID ${offer.id} | Type: ${offer.offerType} | Known: ${isKnownType} | NotCollected: ${isNotCollected} | Full Obj:`, offer);
                    return isKnownType && isNotCollected;
                });

                console.log("Extension: Filtered collectible offers count:", collectibleOffers.length);
                if (collectibleOffers.length > 0) {
                    console.log("Extension: Collectible offers:", JSON.stringify(collectibleOffers, null, 2));
                }

                if (collectibleOffers.length === 0) {
                    console.log("Extension: No collectible offers found, exiting loop.");
                    break; // Exit the loop if no more collectible offers are found
                }

                // Map offer types to the correct server call name when necessary
                const callsToMake = collectibleOffers.map(offer => {
                    let callName = 'specialOffer_farmReward';
                    if (offer.offerType === 'saleShowcase') {
                        callName = 'saleShowcase_farmReward';
                    }
                    return {
                        name: callName,
                        args: { offerId: offer.id },
                        ident: `${callName}_${offer.id}_loop${loopCount}`
                    };
                });

                console.log("Extension: Will send farm calls sequentially:", JSON.stringify(callsToMake, null, 2));
                let seqSuccess = 0;
                // Send calls one-by-one to avoid batch errors from the server
                for (const singleCall of callsToMake) {
                    try {
                        console.log(`Extension: Sending single farm call ${singleCall.ident}`);
                        const singleResult = await Send({ calls: [singleCall] });
                        console.log("Extension: singleFarmResult:", JSON.stringify(singleResult, null, 2));

                        if (singleResult && singleResult.results && singleResult.results.length > 0) {
                            const r = singleResult.results[0];
                            if (!r.error && r.result) {
                                seqSuccess++;
                                totalCollectedCount++;
                                HWHFuncs.setProgress(`Collected ${totalCollectedCount} rewards...`, false);
                            } else if (r.error) {
                                console.warn("Extension: farm call returned error:", JSON.stringify(r.error, null, 2));
                            } else {
                                console.log("Extension: farm call returned no usable result:", JSON.stringify(r, null, 2));
                            }
                        } else {
                            console.warn("Extension: single farm call returned no results object:", JSON.stringify(singleResult, null, 2));
                        }
                    } catch (e) {
                        console.error("Extension: Exception when sending single farm call:", e);
                    }
                    // small delay between single calls to be polite
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                collectedInThisLoop = seqSuccess;
                if (collectedInThisLoop === 0) {
                    console.log("Extension: No successful farm results in this loop.");
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
