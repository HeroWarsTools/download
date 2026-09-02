// ==UserScript==
// @name			HWHCraftItemsExt HC
// @name:en			HWHCraftItemsExt HC
// @name:ru			HWHCraftItemsExt HC
// @namespace		HWHCraftItemsExtHC
// @version			1.0.16.3HC2
// @description		HWH item crafting extension - Hardcoded version (no UI)
// @description:en	HWH item crafting extension - Hardcoded version (no UI)
// @description:ru	HWH расширение для создания предметов - Версия без интерфейса
// @author			ZingerY
// @license 		Copyright ZingerY
// @homepage		https://zingery.ru/scripts/HWHCraftItemsExt.user.js
// @match			https://www.hero-wars.com/*
// @match			https://apps-1701433570146040.apps.fbsbx.com/*
// @run-at			document-start
// @grant			GM_setValue
// @grant			GM_getValue
// @grant			GM_xmlhttpRequest
// ==/UserScript==

(function () {
	if (!this.HWHClasses) {
		console.log('%c[HWH-Craft HC] Object for extension not found', 'color: red');
		return;
	}

	console.log('%c[HWH-Craft HC] Start Extension ' + GM_info.script.name + ', v' + GM_info.script.version, 'color: lime');
	const { addExtentionName, Events } = HWHFuncs;
	addExtentionName(GM_info.script.name, GM_info.script.version, GM_info.script.author);

	// ============================================
	// HARDCODED CONFIGURATION (from JSON)
	// ============================================
	const HARDCODED_CONFIG = {
		"items": {
			"1": 10, "2": 10, "3": 10, "4": 10, "5": 10, "6": 10, "7": 10, "8": 10, "9": 10,
			"10": 10, "11": 10, "12": 10, "13": 10, "14": 10, "15": 10, "16": 10, "17": 10,
			"18": 10, "19": 10, "20": 10, "21": 4, "22": 11, "23": 11, "24": 5, "25": 5,
			"26": 11, "27": 4, "28": 15, "29": 11, "30": 15, "31": 5, "32": 11, "33": 20,
			"34": 5, "35": 5, "36": 20, "37": 20, "38": 20, "39": 20, "40": 20, "41": 20,
			"42": 20, "43": 20, "44": 20, "45": 20, "46": 20, "47": 202, "48": 20, "49": 20,
			"50": 20, "51": 20, "52": 20, "53": 20, "54": 20, "55": 20, "56": 50, "57": 50,
			"58": 100, "59": 50, "60": 50, "61": 50, "62": 50, "63": 10, "64": 10, "65": 10,
			"66": 20, "67": 10, "68": 20, "69": 10, "70": 10, "71": 10, "72": 10, "73": 30,
			"74": 50, "75": 40, "76": 30, "77": 30, "78": 1, "79": 2, "80": 1, "81": 1,
			"82": 1, "83": 5, "84": 10, "85": 20, "86": 10, "87": 30, "88": 50, "89": 10,
			"90": 50, "91": 40, "92": 40, "93": 40, "95": 40, "96": 40, "97": 40, "98": 40,
			"99": 5, "100": 40, "101": 5, "102": 20, "107": 5, "109": 20, "112": 40,
			"118": 20, "125": 4, "127": 3, "134": 2, "140": 1, "167": 20, "168": 20,
			"169": 20, "170": 20, "171": 20, "172": 20, "174": 20, "176": 5, "177": 20
		},
		"gold": 200000000,
		"init": 20,
		"run": 599
	};

	const autoCraftItemsObj = HARDCODED_CONFIG.items;
	const minGoldThreshold = HARDCODED_CONFIG.gold;
	const initialTimer = HARDCODED_CONFIG.init;
	const runEveryTimer = HARDCODED_CONFIG.run;

	// ============================================
	// CRAFT MANAGER (simplified, no UI dependencies)
	// ============================================
	class InventoryCraftManager {
		constructor(inventoryItem, inventoryGet, gold) {
			this.inventoryItem = inventoryItem;
			this.inventoryGet = inventoryGet;
			this.gold = gold;
		}

		async updateInfo() {
			const [userGetInfo, inventoryGet] = await Caller.send(['userGetInfo', 'inventoryGet']);
			this.inventoryGet = inventoryGet;
			this.gold = userGetInfo.gold;
		}

		async inventoryCraftFragments(type, libId, amount) {
			try {
				await Caller.send({ name: 'inventoryCraftFragments', args: { type, libId, amount } });
			} catch (e) {
				console.error('[HWH-Craft HC] Craft fragments error:', e);
				return false;
			}
			return true;
		}

		async inventoryCraftRecipe(type, libId, amount) {
			try {
				await Caller.send({ name: 'inventoryCraftRecipe', args: { type, libId, amount } });
			} catch (e) {
				console.error('[HWH-Craft HC] Craft recipe error:', e);
				return false;
			}
			return true;
		}

		canCraft(type, libId, amount = 1, goldAvailable = this.gold, ignoreExisting = false) {
			const item = this.inventoryItem[type]?.[libId];
			if (!item) return false;

			const currentCount = ignoreExisting ? 0 : this.inventoryGet[type]?.[libId] || 0;
			const needToCraft = Math.max(0, amount - currentCount);
			if (needToCraft === 0) return true;

			if (item.craftRecipe) {
				const recipe = item.craftRecipe;
				const goldNeededHere = recipe.gold * needToCraft;
				if (goldAvailable < goldNeededHere) return false;

				const remainingGold = goldAvailable - goldNeededHere;

				if (recipe.gear) {
					for (const compIdStr in recipe.gear) {
						const compId = Number(compIdStr);
						const compNeeded = recipe.gear[compIdStr] * needToCraft;
						if (!this.canCraft('gear', compId, compNeeded, remainingGold)) {
							return false;
						}
					}
				}

				if (recipe.scroll) {
					for (const compIdStr in recipe.scroll) {
						const compId = Number(compIdStr);
						const compNeeded = recipe.scroll[compIdStr] * needToCraft;
						if (!this.canCraft('scroll', compId, compNeeded, remainingGold)) {
							return false;
						}
					}
				}

				return true;
			}

			if (item.fragmentMergeCost) {
				const cost = item.fragmentMergeCost;
				const goldNeededHere = cost.gold * needToCraft;
				if (goldAvailable < goldNeededHere) return false;

				const fragmentType = type === 'gear' ? 'fragmentGear' : 'fragmentScroll';
				const availableFragments = this.inventoryGet[fragmentType]?.[libId] || 0;
				const requiredFragments = cost.fragmentCount * needToCraft;

				return availableFragments >= requiredFragments;
			}

			return false;
		}

		async craftItem(type, libId, amount = 1, ignoreExisting = false) {
			const item = this.inventoryItem[type]?.[libId];
			if (!item) return true;

			const currentCount = ignoreExisting ? 0 : this.inventoryGet[type]?.[libId] || 0;
			const needToCraft = Math.max(0, amount - currentCount);
			if (needToCraft === 0) return true;

			if (item.craftRecipe) {
				const recipe = item.craftRecipe;

				if (recipe.gear) {
					for (const compIdStr in recipe.gear) {
						const compId = Number(compIdStr);
						const compNeeded = recipe.gear[compIdStr] * needToCraft;
						const result = await this.craftItem('gear', compId, compNeeded);
						if (!result) {
							return false;
						}
					}
				}

				if (recipe.scroll) {
					for (const compIdStr in recipe.scroll) {
						const compId = Number(compIdStr);
						const compNeeded = recipe.scroll[compIdStr] * needToCraft;
						const result = await this.craftItem('scroll', compId, compNeeded);
						if (!result) {
							return false;
						}
					}
				}

				const result = await this.inventoryCraftRecipe(type, libId, needToCraft);
				if (!result) {
					return false;
				}
			} else if (item.fragmentMergeCost) {
				const result = await this.inventoryCraftFragments(type, libId, needToCraft);
				if (!result) {
					return false;
				}
			}
			return true;
		}
	}

	// ============================================
	// AUTO-CRAFT EXECUTION
	// ============================================
	async function executeAutoCraft() {
		const itemIds = Object.keys(autoCraftItemsObj);
		if (itemIds.length === 0) {
			console.log('[HWH-Craft HC] No items to craft');
			return;
		}

		console.log(`[HWH-Craft HC] Starting auto-craft for ${itemIds.length} items`);

		const [userGetInfo, inventoryGet] = await Caller.send(['userGetInfo', 'inventoryGet']);
		const craftMan = new InventoryCraftManager(lib.data.inventoryItem, inventoryGet, userGetInfo.gold);

		let craftedCount = 0;
		for (let idStr of itemIds) {
			const id = Number(idStr);
			const targetAmount = autoCraftItemsObj[idStr] || 1;

			if (craftMan.gold >= minGoldThreshold) {
				let currentAmount = craftMan.inventoryGet['gear']?.[id] || 0;
				let needed = targetAmount - currentAmount;

				if (needed > 0) {
					console.log(`[HWH-Craft HC] Crafting gear ${id}: need ${needed} more (have ${currentAmount})`);
				}

				while (needed > 0 && craftMan.gold >= minGoldThreshold && craftMan.canCraft('gear', id, 1, craftMan.gold - minGoldThreshold, true)) {
					const result = await craftMan.craftItem('gear', id, 1, true);
					if (result) {
						craftedCount++;
						await craftMan.updateInfo();
						currentAmount = craftMan.inventoryGet['gear']?.[id] || 0;
						needed = targetAmount - currentAmount;
						await new Promise(r => setTimeout(r, 120));
					} else {
						console.log(`[HWH-Craft HC] Failed to craft gear ${id}`);
						break;
					}
				}
			} else {
				console.log(`[HWH-Craft HC] Gold below threshold: ${craftMan.gold} < ${minGoldThreshold}`);
			}
		}

		console.log(`[HWH-Craft HC] Auto-craft completed. Crafted ${craftedCount} items`);
	}

	// ============================================
	// AUTO-CRAFT LOOP
	// ============================================
	let autoCraftTimeoutId = null;

	function stopAutoCraftLoop() {
		if (autoCraftTimeoutId) {
			clearTimeout(autoCraftTimeoutId);
			autoCraftTimeoutId = null;
			console.log('[HWH-Craft HC] Loop stopped');
		}
	}

	function startAutoCraftLoop(isInitial = false) {
		stopAutoCraftLoop();

		const delay = isInitial ? initialTimer : runEveryTimer;
		console.log(`[HWH-Craft HC] Loop started, next execution in ${delay}s`);

		autoCraftTimeoutId = setTimeout(async () => {
			await executeAutoCraft();
			startAutoCraftLoop(false);
		}, delay * 1000);
	}

	// ============================================
	// INITIALIZATION
	// ============================================
	Events.on('startGame', async () => {
		console.log('[HWH-Craft HC] Game started, initializing...');
		console.log(`[HWH-Craft HC] Config: ${Object.keys(autoCraftItemsObj).length} items, gold threshold: ${minGoldThreshold}, init: ${initialTimer}s, run: ${runEveryTimer}s`);

		// Wait a bit for game to fully load
		await new Promise(r => setTimeout(r, 3000));

		startAutoCraftLoop(true);
	});

	// Stop loop on page unload
	window.addEventListener('beforeunload', () => {
		stopAutoCraftLoop();
	});

})();
