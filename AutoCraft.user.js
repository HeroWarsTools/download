// ==UserScript==
// @name			HWHCraftItemsExt
// @name:en			HWHCraftItemsExt
// @name:ru			HWHCraftItemsExt
// @namespace		HWHCraftItemsExt
// @version			1.0.13
// @description		HWH item crafting extension
// @description:en	HWH item crafting extension
// @description:ru	HWH расширение для создания предметов
// @author			ZingerY
// @license 		Copyright ZingerY
// @homepage		https://zingery.ru/scripts/HWHCraftItemsExt.user.js
// @downloadURL		https://zingery.ru/scripts/HWHCraftItemsExt.user.js
// @updateURL		https://zingery.ru/scripts/HWHCraftItemsExt.user.js
// @icon			https://zingery.ru/scripts/VaultBoyIco16.ico
// @icon64			https://zingery.ru/scripts/VaultBoyIco64.png
// @match			https://www.hero-wars.com/*
// @match			https://apps-1701433570146040.apps.fbsbx.com/*
// @run-at			document-start
// @grant			GM_setValue
// @grant			GM_getValue
// @grant			GM_xmlhttpRequest
// ==/UserScript==

(function () {
	if (!this.HWHClasses) {
		console.log('%cObject for extension not found', 'color: red');
		return;
	}

	console.log('%cStart Extension ' + GM_info.script.name + ', v' + GM_info.script.version + ' by ' + GM_info.script.author, 'color: red');
	const { addExtentionName } = HWHFuncs;
	addExtentionName(GM_info.script.name, GM_info.script.version, GM_info.script.author);

	const { buttons } = HWHData;

	const { i18nLangData } = HWHData;

	const i18nLangDataEn = {
		CRAFT_ITEMS: 'Auto-Craft',
		CRAFT_ITEMS_TITLE: 'Recursive Auto-Craft Items',
		SELECT_COLOR_ITEM: 'Select Item Color:',
		SELECT_ITEM: 'Select item:',
		ITEM_CREATED: 'Item created',
		EXPORT_SETTINGS: 'Export JSON',
		IMPORT_SETTINGS: 'Import JSON',
		SET_AS_DEFAULT: 'Set as Default',
		LOAD_DEFAULT: 'Load Default',
		DEFAULTS_SAVED: 'Defaults saved!',
		DEFAULTS_LOADED: 'Defaults loaded!',
		NO_DEFAULTS: 'No defaults found!',
		WEB_PROFILE: 'Web Profile',
	};

	i18nLangData['en'] = Object.assign(i18nLangData['en'], i18nLangDataEn);

	const i18nLangDataRu = {
		CRAFT_ITEMS: 'Авто-крафт',
		CRAFT_ITEMS_TITLE: 'Рекурсивный авто-крафт предметов',
		SELECT_COLOR_ITEM: 'Выберите цвет предметов:',
		SELECT_ITEM: 'Выберите предмет:',
		ITEM_CREATED: 'Предмет создан',
		EXPORT_SETTINGS: 'Экспорт JSON',
		IMPORT_SETTINGS: 'Импорт JSON',
		SET_AS_DEFAULT: 'По умолчанию',
		LOAD_DEFAULT: 'Загрузить',
		DEFAULTS_SAVED: 'Сохранено!',
		DEFAULTS_LOADED: 'Загружено!',
		NO_DEFAULTS: 'Не найдено!',
		WEB_PROFILE: 'Веб-профиль',
	};

	i18nLangData['ru'] = Object.assign(i18nLangData['ru'], i18nLangDataRu);

	buttons['CraftItems'] = {
		get name() {
			return I18N('CRAFT_ITEMS');
		},
		get title() {
			return I18N('CRAFT_ITEMS_TITLE');
		},
		color: 'green',
		onClick: onClickNewButton,
	};

	const { popup, getSaveVal, setSaveVal, Events, confShow } = HWHFuncs;

	let autoCraftEnabled = false;
	let autoCraftItems = [];
	let minGoldThreshold = 1000000000;
	let initialTimer = 20;
	let runEveryTimer = 599;

	let autoCraftTimeoutId = null;

	function stopAutoCraftLoop() {
		if (autoCraftTimeoutId) {
			clearTimeout(autoCraftTimeoutId);
			autoCraftTimeoutId = null;
		}
	}

	function startAutoCraftLoop(isInitial = false) {
		stopAutoCraftLoop();

		autoCraftEnabled = getSaveVal('autoCraftEnabled', false);
		if (!autoCraftEnabled) return;

		initialTimer = Number(getSaveVal('initialTimer', 20));
		runEveryTimer = Number(getSaveVal('runEveryTimer', 599));

		const delay = isInitial ? initialTimer : runEveryTimer;

		autoCraftTimeoutId = setTimeout(async () => {
			if (getSaveVal('autoCraftEnabled', false)) {
				await executeAutoCraft();
				startAutoCraftLoop(false);
			}
		}, delay * 1000);
	}

	Events.on('startGame', async () => {
		startAutoCraftLoop(true);
	});

	async function executeAutoCraft() {
		let autoCraftItemsObj = getSaveVal('autoCraftItemsObj', {});
		const itemIds = Object.keys(autoCraftItemsObj);
		if (itemIds.length === 0) return;

		minGoldThreshold = Number(getSaveVal('minGoldThreshold', 1000000000));

		const [userGetInfo, inventoryGet] = await Caller.send(['userGetInfo', 'inventoryGet']);
		const craftMan = new InventoryCraftManager(lib.data.inventoryItem, inventoryGet, userGetInfo.gold);

		for (let idStr of itemIds) {
			const id = Number(idStr);
			const targetAmount = autoCraftItemsObj[idStr] || 1;
			if (craftMan.gold >= minGoldThreshold) {
				let currentAmount = craftMan.inventoryGet['gear']?.[id] || 0;
				let needed = targetAmount - currentAmount;

				while (needed > 0 && craftMan.gold >= minGoldThreshold && craftMan.canCraft('gear', id, 1, craftMan.gold - minGoldThreshold, true)) {
					const result = await craftMan.craftItem('gear', id, 1, true);
					if (result) {
						await craftMan.updateInfo();
						currentAmount = craftMan.inventoryGet['gear']?.[id] || 0;
						needed = targetAmount - currentAmount;
						await new Promise(r => setTimeout(r, 120));
					} else {
						break;
					}
				}
			}
		}
	}

	async function onClickNewButton() {
		autoCraftEnabled = getSaveVal('autoCraftEnabled', false);
		minGoldThreshold = Number(getSaveVal('minGoldThreshold', 1000000000));
		initialTimer = Number(getSaveVal('initialTimer', 20));
		runEveryTimer = Number(getSaveVal('runEveryTimer', 599));

		let minGoldThresholdM = Math.floor(minGoldThreshold / 1000000);

		const colors = {
			1: { name: cheats.translate('LIB_ENUM_HEROCOLOR_1'), color: 'graphite' },
			2: { name: cheats.translate('LIB_ENUM_HEROCOLOR_2'), color: 'green' },
			3: { name: cheats.translate('LIB_ENUM_HEROCOLOR_4'), color: 'blue' },
			4: { name: cheats.translate('LIB_ENUM_HEROCOLOR_7'), color: 'violet' },
			5: { name: cheats.translate('LIB_ENUM_HEROCOLOR_11'), color: 'yellow' },
			6: { name: cheats.translate('LIB_ENUM_HEROCOLOR_12'), color: 'red' },
			// 7: { name: cheats.translate('UI_UNAVAILABLE'), color: 'brown' },
		};

		const items = lib.data.inventoryItem.gear;

		if (typeof unsafeWindow.HWHCraft_API === 'undefined') {
			unsafeWindow.HWHCraft_API = {
				startLoop: startAutoCraftLoop,
				stopLoop: stopAutoCraftLoop,
				save: function () {
					const cb = document.getElementById('craft_auto_toggle');
					const mgM = document.getElementById('craft_min_gold_m');
					const it = document.getElementById('craft_init_timer');
					const rt = document.getElementById('craft_run_timer');

					const wasEnabled = getSaveVal('autoCraftEnabled', false);

					if (cb) setSaveVal('autoCraftEnabled', cb.checked);
					if (mgM) setSaveVal('minGoldThreshold', Number(mgM.value) * 1000000 || 0);
					if (it) setSaveVal('initialTimer', Number(it.value) || 0);
					if (rt) setSaveVal('runEveryTimer', Number(rt.value) || 0);

					if (cb && cb.checked && !wasEnabled) {
						if (unsafeWindow.HWHCraft_API.startLoop) unsafeWindow.HWHCraft_API.startLoop(true);
					} else if (cb && !cb.checked && wasEnabled) {
						if (unsafeWindow.HWHCraft_API.stopLoop) unsafeWindow.HWHCraft_API.stopLoop();
					}
				},
				toggleItem: function (id, checked) {
					let obj = getSaveVal('autoCraftItemsObj', {});
					if (checked) {
						const input = document.getElementById('item_amount_' + id);
						obj[id] = input ? (Number(input.value) || 1) : 1;
					} else {
						delete obj[id];
					}
					setSaveVal('autoCraftItemsObj', obj);
				},
				updateAmount: function (id, value) {
					let obj = getSaveVal('autoCraftItemsObj', {});
					const checked = document.getElementById('item_' + id)?.checked;
					if (checked) {
						obj[id] = Number(value) || 1;
						setSaveVal('autoCraftItemsObj', obj);
					}
				},
				saveGlobalDefault: function () {
					const obj = getSaveVal('autoCraftItemsObj', {});
					const gold = getSaveVal('minGoldThreshold', 1000000000);
					const init = getSaveVal('initialTimer', 20);
					const run = getSaveVal('runEveryTimer', 599);

					GM_setValue('HWHCraft_Global_Items', obj);
					GM_setValue('HWHCraft_Global_Gold', gold);
					GM_setValue('HWHCraft_Global_Init', init);
					GM_setValue('HWHCraft_Global_Run', run);

					HWHFuncs.popup.confirm(I18N('DEFAULTS_SAVED'), [{ msg: "OK", result: true, isClose: true }]);
				},
				loadGlobalDefault: function () {
					const obj = GM_getValue('HWHCraft_Global_Items', null);
					if (!obj) {
						HWHFuncs.popup.confirm(I18N('NO_DEFAULTS'), [{ msg: "OK", result: true, isClose: true }]);
						return;
					}

					setSaveVal('autoCraftItemsObj', obj);
					setSaveVal('minGoldThreshold', GM_getValue('HWHCraft_Global_Gold', 1000000000));
					setSaveVal('initialTimer', GM_getValue('HWHCraft_Global_Init', 20));
					setSaveVal('runEveryTimer', GM_getValue('HWHCraft_Global_Run', 599));

					HWHFuncs.popup.confirm(I18N('DEFAULTS_LOADED'), [{ msg: "OK", result: true, isClose: true }]);
				},
				exportSettings: function() {
					const data = {
						items: getSaveVal('autoCraftItemsObj', {}),
						gold: getSaveVal('minGoldThreshold', 1000000000),
						init: getSaveVal('initialTimer', 20),
						run: getSaveVal('runEveryTimer', 599)
					};
					const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `hwh_craft_settings_${new Date().toISOString().split('T')[0]}.json`;
					a.click();
					URL.revokeObjectURL(url);
				},
				importSettings: function() {
					const input = document.createElement('input');
					input.type = 'file';
					input.accept = '.json';
					input.onchange = e => {
						const file = e.target.files[0];
						if (!file) return;
						const reader = new FileReader();
						reader.onload = e => {
							try {
								const data = JSON.parse(e.target.result);
								if (data.items) setSaveVal('autoCraftItemsObj', data.items);
								if (data.gold) setSaveVal('minGoldThreshold', data.gold);
								if (data.init) setSaveVal('initialTimer', data.init);
								if (data.run) setSaveVal('runEveryTimer', data.run);
								HWHFuncs.popup.confirm(I18N('DEFAULTS_LOADED'), [{ msg: "OK", result: true, isClose: true }]);
							} catch (err) {
								HWHFuncs.popup.confirm("Error parsing JSON!", [{ msg: "OK", result: true, isClose: true }]);
							}
						};
						reader.readAsText(file);
					};
					input.click();
				},
				loadWebProfile: function() {
					return new Promise((resolve) => {
						GM_xmlhttpRequest({
							method: "GET",
							url: "https://github.com/HeroWarsTools/profiles/raw/refs/heads/main/CraftItems.json",
							onload: function(response) {
								try {
									const data = JSON.parse(response.responseText);
									if (data.items) setSaveVal('autoCraftItemsObj', data.items);
									if (data.gold) setSaveVal('minGoldThreshold', data.gold);
									if (data.init) setSaveVal('initialTimer', data.init);
									if (data.run) setSaveVal('runEveryTimer', data.run);
									console.log('Web profile loaded');
								} catch (e) {
									console.error('Error parsing web profile', e);
								}
								resolve();
							},
							onerror: function(err) {
								console.error('Error fetching web profile', err);
								resolve();
							}
						});
					});
				}
			};
		}

		const html = `
			<div style="display: flex; flex-direction: column; gap: 8px; min-width: 420px; color: #fce1ac; font-size: 13px;">
				<h3 style="text-align: center; color: #fde5b6; margin: 0 0 5px 0;">Auto-Craft Settings</h3>

				<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
					<!-- Left Column -->
					<div style="display: flex; flex-direction: column; gap: 8px;">
						<div style="display: flex; justify-content: space-between; align-items: center;">
							<label for="craft_auto_toggle" style="cursor: pointer;">Auto-Craft:</label>
							<input type="checkbox" id="craft_auto_toggle" ${autoCraftEnabled ? 'checked' : ''} onchange="HWHCraft_API.save()">
						</div>
						<div style="display: flex; justify-content: space-between; align-items: center;">
							<label>Min Gold:</label>
							<div style="display: flex; align-items: center; gap: 4px;">
								<input type="number" id="craft_min_gold_m" value="${minGoldThresholdM}" oninput="HWHCraft_API.save()" style="width: 70px; background: #170d07; color: #fce1ac; border: 1px solid #cf9250; text-align: center;">
								<span style="font-size: 11px;">Millions</span>
							</div>
						</div>
					</div>

					<!-- Right Column -->
					<div style="display: flex; flex-direction: column; gap: 8px;">
						<div style="display: flex; justify-content: space-between; align-items: center;">
							<label>Init Timer (s):</label>
							<input type="number" id="craft_init_timer" value="${initialTimer}" oninput="HWHCraft_API.save()" style="width: 70px; background: #170d07; color: #fce1ac; border: 1px solid #cf9250; text-align: center;">
						</div>
						<div style="display: flex; justify-content: space-between; align-items: center;">
							<label>Run Every (s):</label>
							<input type="number" id="craft_run_timer" value="${runEveryTimer}" oninput="HWHCraft_API.save()" style="width: 70px; background: #170d07; color: #fce1ac; border: 1px solid #cf9250; text-align: center;">
						</div>
					</div>
				</div>

				<hr style="border: 0; border-top: 1px solid #ce976755; width: 100%; margin: 2px 0;">
				<div style="text-align: center; font-weight: bold; margin-bottom: 2px;">${I18N('SELECT_COLOR_ITEM')}</div>
			</div>
		`;

		const popupButtons = [];
		for (const id in colors) {
			popupButtons.push({
				msg: colors[id].name,
				result: async () => {
					await showItemCheckboxDialog(id, items, colors[id].name);
				},
				color: colors[id].color,
			});
		}
		popupButtons.push({
			msg: I18N('WEB_PROFILE'),
			result: async () => {
				await unsafeWindow.HWHCraft_API.loadWebProfile();
			},
			color: 'brown',
		});
		popupButtons.push({ result: false, isClose: true });

		const answer = await popup.confirm(html, popupButtons);

		if (typeof answer === 'function') {
			answer();
		}
	}

	async function showItemCheckboxDialog(colorId, items, colorName) {
		let autoCraftItemsObj = getSaveVal('autoCraftItemsObj', {});

		const [userGetInfo, inventoryGet] = await Caller.send(['userGetInfo', 'inventoryGet']);

		let itemsOfColor = [];
		for (const id in items) {
			if (items[id].color == colorId) {
				itemsOfColor.push({
					id: Number(id),
					name: cheats.translate('LIB_GEAR_NAME_' + id),
					owned: inventoryGet['gear']?.[id] || 0
				});
			}
		}

		itemsOfColor.sort((a, b) => a.name.localeCompare(b.name));

		let gridHtml = `<div style="display: grid; grid-template-columns: repeat(3, 1fr); column-gap: 30px; row-gap: 4px; max-height: 450px; overflow-y: auto; overflow-x: hidden; font-size: 11px; color: #fce1ac; padding-right: 5px;">`;

		for (let item of itemsOfColor) {
			const isChecked = autoCraftItemsObj[item.id] !== undefined ? 'checked' : '';
			const amount = autoCraftItemsObj[item.id] || 1;
			const displayName = item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name;
			gridHtml += `
				<div style="display: flex; align-items: center; gap: 4px; border: 1px solid #444; padding: 2px; border-radius: 3px; background: rgba(0,0,0,0.3);">
					<input type="checkbox" id="item_${item.id}" ${isChecked} onchange="HWHCraft_API.toggleItem(${item.id}, this.checked)" style="margin: 0;">
					<input type="number" id="item_amount_${item.id}" value="${amount}" min="1" max="100" style="width: 45px; background: #170d07; color: #fce1ac; border: 1px solid #cf9250; text-align: center; font-size: 10px;" oninput="HWHCraft_API.updateAmount(${item.id}, this.value)">
					<label for="item_${item.id}" style="cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;" title="${item.name}">${displayName} (<span style="color: #66ff66;">${item.owned}</span>)</label>
				</div>
			`;
		}
		gridHtml += `</div>`;

		const html = `
			<div style="min-width: 480px;">
				<h3 style="text-align: center; color: #fde5b6; margin: 0 0 10px 0;">${colorName}</h3>
				${gridHtml}
			</div>
		`;

		const popupButtons = [
			{ msg: I18N('SET_AS_DEFAULT'), result: "set_default", color: 'yellow' },
			{ msg: I18N('LOAD_DEFAULT'), result: "load_default", color: 'orange' },
			{ msg: I18N('EXPORT_SETTINGS'), result: "export_json", color: 'green' },
			{ msg: I18N('IMPORT_SETTINGS'), result: "import_json", color: 'blue' },
			{ msg: "Back", result: true, color: 'graphite' },
			{ msg: "Close", result: false, isClose: true }
		];

		const answer = await popup.confirm(html, popupButtons);

		if (answer === "set_default") {
			unsafeWindow.HWHCraft_API.saveGlobalDefault();
			showItemCheckboxDialog(colorId, items, colorName);
		} else if (answer === "load_default") {
			unsafeWindow.HWHCraft_API.loadGlobalDefault();
			showItemCheckboxDialog(colorId, items, colorName);
		} else if (answer === "export_json") {
			unsafeWindow.HWHCraft_API.exportSettings();
			showItemCheckboxDialog(colorId, items, colorName);
		} else if (answer === "import_json") {
			unsafeWindow.HWHCraft_API.importSettings();
			showItemCheckboxDialog(colorId, items, colorName);
		} else if (answer === true) {
			onClickNewButton();
		}
	}

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
				console.error(e);
				return false;
			}
			return true;
		}

		async inventoryCraftRecipe(type, libId, amount) {
			try {
				await Caller.send({ name: 'inventoryCraftRecipe', args: { type, libId, amount } });
			} catch (e) {
				console.error(e);
				return false;
			}
			return true;
		}

		/**
		 * Рекурсивно проверяет, можно ли создать предмет, учитывая текущий инвентарь и золото.
		 * @param {string} type - "gear" или "scroll"
		 * @param {number} libId - ID предмета
		 * @param {number} amount - требуемое количество
		 * @param {number} goldAvailable - доступное золото (для внутреннего использования)
		 * @param {boolean} ignoreExisting
		 * @returns {boolean}
		 */
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

				// Проверяем gear-компоненты
				if (recipe.gear) {
					for (const compIdStr in recipe.gear) {
						const compId = Number(compIdStr);
						const compNeeded = recipe.gear[compIdStr] * needToCraft;
						if (!this.canCraft('gear', compId, compNeeded, remainingGold)) {
							return false;
						}
					}
				}

				// Проверяем scroll-компоненты
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

		/**
		 * Рекурсивно крафтит предмет и все недостающие компоненты.
		 * Предполагается, что canCraft(...) уже вернул true.
		 * @param {string} type
		 * @param {number} libId
		 * @param {number} amount
		 * @param {boolean} ignoreExisting
		 */
		async craftItem(type, libId, amount = 1, ignoreExisting = false) {
			const item = this.inventoryItem[type]?.[libId];
			if (!item) return true;

			const currentCount = ignoreExisting ? 0 : this.inventoryGet[type]?.[libId] || 0;
			const needToCraft = Math.max(0, amount - currentCount);
			if (needToCraft === 0) return true;

			if (item.craftRecipe) {
				const recipe = item.craftRecipe;

				// Сначала крафтим компоненты
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

				// Крафтим сам предмет
				const result = await this.inventoryCraftRecipe(type, libId, needToCraft);
				if (!result) {
					return false;
				}
			} else if (item.fragmentMergeCost) {
				// Крафтим из фрагментов
				const result = await this.inventoryCraftFragments(type, libId, needToCraft);
				if (!result) {
					return false;
				}
			}
			return true;
		}

		// Вспомогательный метод: проверить и создать, если возможно
		async ensureItem(type, libId, amount = 1, ignoreExisting = false) {
			if (this.canCraft(type, libId, amount, ignoreExisting)) {
				await this.craftItem(type, libId, amount, ignoreExisting);
			} else {
				console.warn(`Cannot craft ${type}[${libId}] x${amount} — insufficient resources.`);
			}
		}

		/**
		 * Рекурсивно вычисляет стоимость крафта предмета.
		 *
		 * @param {string} type - "gear" или "scroll"
		 * @param {number} libId - ID предмета
		 * @param {number} amount - требуемое количество
		 * @param {boolean} ignoreInventory - если true, игнорировать текущий инвентарь и фрагменты
		 * @returns {{
		 *   gold: number,
		 *   gear: Record<number, number>,
		 *   scroll: Record<number, number>,
		 *   fragmentGear: Record<number, number>,
		 *   fragmentScroll: Record<number, number>
		 * }}
		 */
		getCraftCost(type, libId, amount = 1, ignoreInventory = false) {
			const item = this.inventoryItem[type]?.[libId];
			if (!item) {
				return this._emptyCost();
			}

			let needToCraft = amount;
			if (!ignoreInventory) {
				const currentCount = this.inventoryGet[type]?.[libId] || 0;
				needToCraft = Math.max(0, amount - currentCount);
				if (needToCraft === 0) {
					return this._emptyCost();
				}
			}

			if (item.craftRecipe) {
				const recipe = item.craftRecipe;
				let totalGold = recipe.gold * needToCraft;
				const totalGear = {};
				const totalScroll = {};
				const totalFragmentGear = {};
				const totalFragmentScroll = {};

				if (recipe.gear) {
					for (const compIdStr in recipe.gear) {
						const compId = Number(compIdStr);
						const compNeeded = recipe.gear[compIdStr] * needToCraft;
						const subCost = this.getCraftCost('gear', compId, compNeeded, ignoreInventory);
						totalGold += subCost.gold;
						this._mergeInto(totalGear, subCost.gear);
						this._mergeInto(totalScroll, subCost.scroll);
						this._mergeInto(totalFragmentGear, subCost.fragmentGear);
						this._mergeInto(totalFragmentScroll, subCost.fragmentScroll);
					}
				}

				if (recipe.scroll) {
					for (const compIdStr in recipe.scroll) {
						const compId = Number(compIdStr);
						const compNeeded = recipe.scroll[compIdStr] * needToCraft;
						const subCost = this.getCraftCost('scroll', compId, compNeeded, ignoreInventory);
						totalGold += subCost.gold;
						this._mergeInto(totalGear, subCost.gear);
						this._mergeInto(totalScroll, subCost.scroll);
						this._mergeInto(totalFragmentGear, subCost.fragmentGear);
						this._mergeInto(totalFragmentScroll, subCost.fragmentScroll);
					}
				}

				return {
					gold: totalGold,
					gear: totalGear,
					scroll: totalScroll,
					fragmentGear: totalFragmentGear,
					fragmentScroll: totalFragmentScroll,
				};
			}

			if (item.fragmentMergeCost) {
				const cost = item.fragmentMergeCost;
				const totalGold = cost.gold * needToCraft;
				const requiredFragments = cost.fragmentCount * needToCraft;

				const result = this._emptyCost();
				result.gold = totalGold;

				let missingFragments = requiredFragments;
				if (!ignoreInventory) {
					const fragmentType = type === 'gear' ? 'fragmentGear' : 'fragmentScroll';
					const currentFragments = this.inventoryGet[fragmentType]?.[libId] || 0;
					missingFragments = Math.max(0, requiredFragments - currentFragments);
				}

				if (missingFragments > 0) {
					if (type === 'gear') {
						result.fragmentGear[libId] = missingFragments;
					} else {
						result.fragmentScroll[libId] = missingFragments;
					}
				}

				return result;
			}

			return { gold: Infinity, gear: {}, scroll: {}, fragmentGear: {}, fragmentScroll: {} };
		}

		/**
		 * Возвращает объект нулевой стоимости
		 */
		_emptyCost() {
			return {
				gold: 0,
				gear: {},
				scroll: {},
				fragmentGear: {},
				fragmentScroll: {},
			};
		}

		/**
		 * Вспомогательный метод: объединяет два объекта с числовыми значениями
		 */
		_mergeInto(target, source) {
			for (const id in source) {
				if (source[id] > 0) {
					target[id] = (target[id] || 0) + source[id];
				}
			}
		}
	}
})();
