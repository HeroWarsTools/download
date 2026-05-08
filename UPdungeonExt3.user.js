// ==UserScript==
// @name			UPBestDungeonExt3
// @name:en			UPBestDungeonExt3
// @name:ru			UPBestDungeonExt3
// @namespace		UPBestDungeonExt3
// @version			0.0.22.Evo1.5.4
// @description		Extension for HeroWarsHelper script
// @description:en	Extension for HeroWarsHelper script
// @description:ru	Расширение для скрипта HeroWarsHelper
// @author			ZingerY
// @license 		Copyright ZingerY
// @icon			https://zingery.ru/scripts/VaultBoyIco16.ico
// @icon64			https://zingery.ru/scripts/VaultBoyIco64.png
// @match			https://www.hero-wars.com/*
// @match			https://apps-1701433570146040.apps.fbsbx.com/*
// @grant			GM_getValue
// @grant			GM_setValue
// @grant			GM_xmlhttpRequest
// @run-at			document-end
// ==/UserScript==

(function () {
	if (!this.HWHClasses) {
		console.log('%cObject for extension not found', 'color: red');
		return;
	}

	// This constant object holds the original script settings. We will use it for the "Reset to Default" function.
	const DEFAULT_CONFIG = {
		// General settings
		timeoutFix: 15000,
		countFix: 100,
		fixedTimerValue: 168.8,
		maxTimerValue: 100,

		// Genetic Algorithm settings
		ga_populationSize: 14,
		ga_generations: 100,
		ga_mutationRate: 0.04,
		ga_eliteCount: 3,

		// Battle Simulation settings
		sim_countTestBattle: 10,
		sim_countAutoBattle: 20,

		// Decision Weights settings
		decision_hpWeight: 25,
		decision_energyWeight: 1,

		// NEW: Tiers are now based on Titanite, not Floor number.
		titaniteTiers: [
			{ maxTitanite: 250, score: 10 },
			{ maxTitanite: 2800, score: 15 },
			{ maxTitanite: 3200, score: 40 },
			{ maxTitanite: 3800, score: 60 },
			{ maxTitanite: 4300, score: 80 },
			{ maxTitanite: 4800, score: 100 }
		],

		// Profile Thresholds (can also be configured here)
		profileThresholds: [
			{ maxScore: 20, profile: 1 }, { maxScore: 40, profile: 2 },
			{ maxScore: 60, profile: 3 }, { maxScore: 80, profile: 4 },
			{ maxScore: 100, profile: 5 }, { maxScore: 150, profile: 6 },
			{ maxScore: 200, profile: 7 }, { maxScore: 999, profile: 8 }
		]
	};



	// This is our live configuration object. We initialize it as a copy of the defaults.
	// The loadConfig() function will then overwrite it with any user-saved settings.
	const DungeoExt3_Config = { ...DEFAULT_CONFIG };
	// --- START: Local Storage Persistence ---

	// Function to save the current configuration to Local Storage.
	function saveConfig() {
		localStorage.setItem('DungeoExt3_Config_v1', JSON.stringify(DungeoExt3_Config));
		console.log('Fix it Dungeon configuration saved.');
	}

	// Function to load the configuration from Local Storage when the script starts.
	function loadConfig() {
		const savedConfig = localStorage.getItem('DungeoExt3_Config_v1');
		if (savedConfig) {
			// Merge the saved settings with the default ones.
			// This prevents errors if we add new properties to the config in the future.
			Object.assign(DungeoExt3_Config, JSON.parse(savedConfig));
			console.log('Fix it Dungeon configuration loaded from Local Storage.');
		}
	}

	// We call loadConfig() once, right at the start, to load any saved settings.
	loadConfig();

	// --- END: Local Storage Persistence ---


	// ==========================================================
	// --- START: Inject All CSS Styles ---
	// ==========================================================

	const allCssRules = `
    /* Styles for the custom numeric inputs */
    .custom-numeric-container { position: relative; display: inline-block; }
    .custom-numeric-input { width: 70px; padding-left: 20px; padding-right: 20px; }
    .numeric-step-btn { position: absolute; top: 50%; transform: translateY(-50%); width: 20px; height: 100%; text-align: center; line-height: 2.2; cursor: pointer; font-weight: bold; user-select: none; color: #ddd; }
    .numeric-step-btn:hover { background: rgba(255, 255, 255, 0.1); }
    .btn-minus { left: 0; }
    .btn-plus { right: 0; }

    /* Styles for the Save Profile Modal */
    .save-profile-modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 19999; }
    .save-profile-modal-content { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #1e1e2d; border: 2px solid #4a4a6a; border-radius: 8px; padding: 20px; z-index: 20000; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .save-profile-modal-content h3 { grid-column: 1 / -1; margin: 0 0 10px; color: #fff; text-align: center; }
    .save-profile-modal-btn { background: #3a3a5a; color: #fff; border: 1px solid #5a5a7a; padding: 10px; border-radius: 5px; cursor: pointer; text-align: center; }
    .save-profile-modal-btn:hover { background: #4a4a6a; }
`;

	const styleSheet = document.createElement("style");
	styleSheet.innerText = allCssRules;
	document.head.appendChild(styleSheet);

	// ==========================================================
	// --- END: Inject All CSS Styles ---
	// ==========================================================


	// ==========================================================
	// --- START: HWH Menu Integration (Multi-Profile FINAL Version) ---
	// ==========================================================

	// --- START: Profile and Configuration Management ---
	let savedProfiles = {};
	function saveCurrentConfig() { localStorage.setItem('DungeoExt3_LastUsedConfig', JSON.stringify(DungeoExt3_Config)); }
	function loadCurrentConfig() { const lastUsed = localStorage.getItem('DungeoExt3_LastUsedConfig'); if (lastUsed) { Object.assign(DungeoExt3_Config, JSON.parse(lastUsed)); console.log('Fix it Dungeon: Last used configuration loaded.'); } }
	function saveProfilesToStorage() { localStorage.setItem('DungeoExt3_Profiles_v1', JSON.stringify(savedProfiles)); console.log('Fix it Dungeon: All profiles saved to storage.'); }
	function loadProfilesFromStorage() { const storedProfiles = localStorage.getItem('DungeoExt3_Profiles_v1'); if (storedProfiles) { savedProfiles = JSON.parse(storedProfiles); console.log('Fix it Dungeon: Profiles loaded from storage.'); } }
	loadProfilesFromStorage();
	loadCurrentConfig();

	if (typeof GM_getValue !== 'undefined' && GM_getValue('DungeoExt3_AutoLoadDefaults', false) === true) {
		setTimeout(() => {
			const stored = GM_getValue('DungeoExt3_UserDefaults_v1');
			if (stored) {
				try {
					const data = JSON.parse(stored);
					if (data.config) {
						Object.assign(DungeoExt3_Config, data.config);
						saveCurrentConfig();
						saveConfig();
					}
					if (data.profiles) {
						savedProfiles = data.profiles;
						saveProfilesToStorage();
					}
					console.log('Fix it Dungeon: Auto-loaded default configuration after 19s.');
				} catch (e) { }
			}
		}, 19000);
	}
	// --- END: Profile and Configuration Management ---

	// ==========================================================
	// --- NUOVO: "Ponte di Ritorno" per l'Auto-Profiling ---
	// Questo codice ascolta i comandi inviati dallo "Script Pannello".
	document.addEventListener('changeDungeonProfile', function (event) {
		let profileNumber = event.detail.profileNumber;

		// Valida il numero profilo: deve essere tra 1 e 8, se no usa 5.
		if (!profileNumber || isNaN(profileNumber) || profileNumber < 1 || profileNumber > 8) {
			console.log(`%c[AutoProfiler] Invalid or missing profileNumber (${profileNumber}). Defaulting to Profile 5.`, 'color: #f0a');
			profileNumber = 5;
		}

		console.log(`%c[AutoProfiler] Received command to switch to Profile ${profileNumber}`, 'color: #f0a');
		let profileKey = `profile${profileNumber}`;

		// Fallback to profile 5 if the requested one is empty
		if (!savedProfiles[profileKey] && profileNumber !== 5) {
			console.log(`%c[AutoProfiler] Profile ${profileNumber} is empty, falling back to Profile 5`, 'color: #f0a');
			profileNumber = 5;
			profileKey = 'profile5';
		}

		if (savedProfiles[profileKey]) {
			Object.assign(DungeoExt3_Config, savedProfiles[profileKey]);
			saveCurrentConfig();
			saveConfig();
			// Se l'interfaccia UI nativa e attualmente aperta e le funzioni sono definite
			if (typeof window.Evo1LoadDOM === 'function' && typeof window.Evo1SaveLogic === 'function') {
				window.Evo1LoadDOM(savedProfiles[profileKey]);
				window.Evo1SaveLogic();
			}
			const setProg = ((typeof window.HWHFuncs !== 'undefined' && window.HWHFuncs.setProgress) || console.log);
			const hideProg = ((typeof window.HWHFuncs !== 'undefined' && window.HWHFuncs.hideProgress) || (() => { }));
			setProg(`Profile ${profileNumber} loaded.`, false);
			setTimeout(hideProg, 2800);
		} else {
			// Se anche il profilo 5 è vuoto, carichiamo la config di default corretta per evitare gli 0
			Object.assign(DungeoExt3_Config, DEFAULT_CONFIG);
			saveCurrentConfig();
			saveConfig();
			if (typeof window.Evo1LoadDOM === 'function' && typeof window.Evo1SaveLogic === 'function') {
				window.Evo1LoadDOM(DEFAULT_CONFIG);
				window.Evo1SaveLogic();
			}

			const setProg = ((typeof window.HWHFuncs !== 'undefined' && window.HWHFuncs.setProgress) || console.log);
			const hideProg = ((typeof window.HWHFuncs !== 'undefined' && window.HWHFuncs.hideProgress) || (() => { }));
			setProg(`Profile ${profileNumber} is empty. Hardcoded Defaults loaded.`, false);
			setTimeout(hideProg, 4000);
		}
	});
	// ==========================================================






	// ==========================================================
	// --- END: HWH Menu Integration ---
	// ==========================================================
	console.log('%cStart Extension ' + GM_info.script.name + ', v' + GM_info.script.version + ' by ' + GM_info.script.author, 'color: red');
	const { addExtentionName } = HWHFuncs;
	addExtentionName(GM_info.script.name, GM_info.script.version, GM_info.script.author);

	const {
		getInput,
		setProgress,
		hideProgress,
		I18N,
		send,
		getTimer,
		countdownTimer,
		getUserInfo,
		getSaveVal,
		setSaveVal,
		popup,
		setIsCancalBattle,
		random,
		EventEmitterMixin,
	} = HWHFuncs;

	const { DungeonFixBattle } = HWHClasses;

	class UpdateDungeonFixBattle extends DungeonFixBattle {
		getTimer() {
			if (this.count === 1) {
				this.isGetTimer = false;
				this.maxTimer = DungeoExt3_Config.maxTimerValue;
				return DungeoExt3_Config.fixedTimerValue;
			}

			return this.randTimer();
		}

		setState() {
			this.lastState = DungeonUtils.getState(this.lastResult);
		}

		checkResult() {
			this.setState();
			if (DungeonUtils.compareScore(this.lastState, this.bestResult.value)) {
				this.bestResult = {
					count: this.count,
					timer: this.lastTimer,
					value: this.lastState,
					result: this.lastResult.result,
					progress: this.lastResult.progress,
				};
			}
		}
	}

	HWHClasses.DungeonFixBattle = UpdateDungeonFixBattle;

	const { i18nLangData } = HWHData;

	const i18nLangDataEn = {
		FEEDBACK: 'Feedback',
		FEEDBACK_TITLE: 'Go to Telegram group for feedback on the HWHBestDungeonExt script',
		FEEDBACK_URL: 'https://t.me/+RHdutKsQQcFlODMy',
		WINNING_FIGHT_NOT_FOUND: 'No winning fight found\\n',
		BEST_COMBINATION: 'Best combination:',
		STOP_DUNGEON: 'Stop Dungeon', // in EN
	};

	i18nLangData['en'] = Object.assign(i18nLangData['en'], i18nLangDataEn);

	const i18nLangDataRu = {
		FEEDBACK: 'Обратная связь',
		FEEDBACK_TITLE: 'Перейти в Telegram группу для обратной связи по скрипту HWHBestDungeonExt',
		FEEDBACK_URL: 'https://t.me/+1RpKpBDs9OAyZDdi',
		WINNING_FIGHT_NOT_FOUND: 'Не найден победный бой\\n',
		BEST_COMBINATION: 'Лучшее сочетание:',
		STOP_DUNGEON: 'Stop Dungeon RU', // in RU (o traduci)
	};

	i18nLangData['ru'] = Object.assign(i18nLangData['ru'], i18nLangDataRu);

	const { buttons } = HWHData;

	buttons['HWHBestDungeonExt'] = {
		get name() { return I18N('FEEDBACK'); },
		get title() { return I18N('FEEDBACK_TITLE'); },
		color: 'red',
		onClick: () => {
			window.open(I18N('FEEDBACK_URL'), '_blank');
		},
	};


	if (buttons?.testDungeon && buttons.testDungeon?.combineList) {
		buttons.testDungeon.combineList.splice(1, 0, {
			name: '⚙️',
			get title() { return 'Dungeon run Settings (Evo1)'; },
			color: 'violet',
			onClick: async () => {
				const cfg = DungeoExt3_Config;
				const { popup, setProgress, hideProgress } = window.HWHFuncs || HWHFuncs;

				const styleId = 'hwh-custom-css';
				if (!document.getElementById(styleId)) {
					const style = document.createElement('style');
					style.id = styleId;
					style.innerHTML = `
					.hwh-inp-num::-webkit-outer-spin-button, .hwh-inp-num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
					.hwh-inp-num { -moz-appearance: textfield; }
					.hwh-btn-adj { width: 28px; height: 28px; background: #444; color: #fff; border: 1px solid #666; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 16px; display: flex; align-items: center; justify-content: center; user-select:none; }
					.hwh-btn-adj:hover { background: #666; }
					.hwh-prof-btn { flex:1; cursor:pointer; font-size:11px; color:#ddd; border:1px solid #555; padding:4px 0; border-radius:3px; font-weight:bold; transition: background 0.2s; }
					.hwh-prof-btn:hover { color:#fff; }
					.hwh-btn-save { background: #333; } .hwh-btn-save:hover { background: #555; }
					.hwh-btn-load { background: #244; } .hwh-btn-load:hover { background: #366; }
					.hwh-native-green-btn { background: radial-gradient(circle, #47a41b 0%, #1a2f04 150%); border: 1px solid #1a2f04; box-shadow: inset 0px 2px 4px #83ce26, inset 0px -4px 6px #1a2f04, 0px 0px 2px black, 0px 0px 0px 1px #ce9767; color: #fce5b7; text-shadow: 0px 1px 2px black; padding: 8px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 14px; text-transform: uppercase; }
					.hwh-native-green-btn:hover { filter: brightness(1.2); }
				`;
					document.head.appendChild(style);
				}

				let profilesHTML = '<div style="background:rgba(0,0,0,0.3); padding:8px; border-radius:5px; margin-bottom:10px; border:1px solid #444;">';
				profilesHTML += '<div style="text-align:center; margin-bottom:5px; color:#00ffaa; font-size:14px; font-weight:bold;">Profiles (Evo1)</div>';
				profilesHTML += '<div style="display:flex; flex-direction:column; gap:4px;">';
				for (let i = 1; i <= 8; i++) {
					profilesHTML += `
					<div style="display:flex; align-items:center; gap:4px; padding:2px;">
						<span style="font-size:12px; color:#eba; width:20px; font-weight:bold;">P${i}</span>
						<button id="btn_save_p${i}" class="hwh-prof-btn hwh-btn-save" title="Save to P${i}">Save</button>
						<button id="btn_load_p${i}" class="hwh-prof-btn hwh-btn-load" title="Load from P${i}">Load</button>
					</div>`;
				}
				profilesHTML += '<div style="margin-top:8px;"><button id="btn_web_import" class="hwh-native-green-btn" style="width:100%; font-size:12px; padding:4px;">🌐 Web</button></div>';
				profilesHTML += '</div></div>';

				const renderRow = (id, label, val, step, color = '#ccc') => `
				<div style="display:flex; justify-content:space-between; align-items:center;">
					<label style="color:${color}; font-size:15px;">${label}</label>
					<div style="display:flex; align-items:center; gap:3px;">
						<div class="hwh-btn-adj" onclick="document.getElementById('${id}').stepDown(); document.getElementById('${id}').dispatchEvent(new Event('input'));">-</div>
						<input id="${id}" class="hwh-inp-num" type="number" step="${step}" value="${val}" style="width:65px; height:28px; font-size:15px; background:#222; color:#fff; border:1px solid #555; text-align:center; border-radius:2px;">
						<div class="hwh-btn-adj" onclick="document.getElementById('${id}').stepUp(); document.getElementById('${id}').dispatchEvent(new Event('input'));">+</div>
					</div>
				</div>`;

				let paramsCol1HTML = '<div style="display:flex; flex-direction:column; gap:6px; max-height: 500px; overflow-y: auto; padding-right: 5px;">';
				paramsCol1HTML += '<div style="color:#e6c300; font-size:16px; font-weight:bold; border-bottom:1px solid #555; margin-bottom:5px;">Fix it Dungeon</div>';
				paramsCol1HTML += renderRow('inp_timeout', 'Timeout (s)', cfg.timeoutFix / 1000, 1);
				paramsCol1HTML += renderRow('inp_countFix', 'Count Fix', cfg.countFix, 10);
				paramsCol1HTML += renderRow('inp_fixedTimer', 'Timer Fisso', cfg.fixedTimerValue, 0.2);
				paramsCol1HTML += renderRow('inp_maxTimer', 'Timer Max (Battle)', cfg.maxTimerValue, 10);

				paramsCol1HTML += '<div style="color:#e6c300; font-size:16px; font-weight:bold; border-bottom:1px solid #555; margin:10px 0 5px 0;">Battle Sim</div>';
				paramsCol1HTML += renderRow('inp_simCountTest', 'Test Battles', cfg.sim_countTestBattle, 1);
				paramsCol1HTML += renderRow('inp_simCountAuto', 'Auto Retries', cfg.sim_countAutoBattle, 1);
				paramsCol1HTML += '</div>';

				let paramsCol2HTML = '<div style="display:flex; flex-direction:column; gap:6px; max-height: 500px; overflow-y: auto; padding-right: 5px;">';
				paramsCol2HTML += '<div style="color:#e6c300; font-size:16px; font-weight:bold; border-bottom:1px solid #555; margin-bottom:5px;">Genetic Algo</div>';
				paramsCol2HTML += renderRow('inp_popSize', 'Population Size', cfg.ga_populationSize, 1);
				paramsCol2HTML += renderRow('inp_gen', 'Generations', cfg.ga_generations, 1);
				paramsCol2HTML += renderRow('inp_mut', 'Mutation Rate', cfg.ga_mutationRate, 0.01);
				paramsCol2HTML += renderRow('inp_elite', 'Elite Count', cfg.ga_eliteCount, 1);

				paramsCol2HTML += '<div style="color:#e6c300; font-size:16px; font-weight:bold; border-bottom:1px solid #555; margin:10px 0 5px 0;">Health : Energy</div>';
				paramsCol2HTML += renderRow('inp_hpWeight', 'HP Weight', cfg.decision_hpWeight, 5);
				paramsCol2HTML += renderRow('inp_energyWeight', 'Energy Weight', cfg.decision_energyWeight, 0.5);
				paramsCol2HTML += '</div>';

				const fullContentHTML = `
				<div style="position: relative; padding-bottom: 10px;">
					<div id="hwh_save_toast" style="display:none; position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:rgba(71, 164, 27, 0.9); color:#fff; padding:8px 20px; border-radius:5px; font-weight:bold; z-index:9999; border: 1px solid #1a2f04;">
						Configuration Saved!
					</div>
					<div style="display:flex; gap:15px; min-width:850px; font-family:Arial, sans-serif;">
						<div style="flex:3;">${profilesHTML}</div>
						<div style="flex:4; background:rgba(0,0,0,0.3); padding:10px; border-radius:5px;">
							<h4 style="margin:0 0 10px 0; font-size:18px; color:#eee;">Evo1 Settings</h4>
							${paramsCol1HTML}
						</div>
						<div style="flex:4; background:rgba(0,0,0,0.3); padding:10px; border-radius:5px;">
							<h4 style="margin:0 0 10px 0; font-size:18px; color:#eee;">Advanced</h4>
							${paramsCol2HTML}
						</div>
					</div>
					<div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid #444; flex-wrap: wrap;">
						<div style="display:flex; gap:10px; align-items:center;">
							<button id="btn_global_save" class="hwh-native-green-btn">💾 Save Configuration</button>
							<button id="btn_set_default" class="hwh-native-green-btn" style="background: radial-gradient(circle, #a4811b 0%, #2f2504 150%);">Set Default</button>
							<button id="btn_load_default" class="hwh-native-green-btn" style="background: radial-gradient(circle, #2b77a4 0%, #04242f 150%);">Load Default</button>
							<label style="color:#ccc; display:flex; align-items:center; gap:5px; font-size:13px; cursor:pointer;" title="Loads Set Default parameters internally 19 seconds after extension boots">
								<input type="checkbox" id="chk_autoload_defaults" style="width:16px;height:16px;"> auto load defaults 19s
							</label>
						</div>
						<div style="display:flex; gap:10px;">
							<button id="btn_file_import" class="hwh-native-green-btn" style="background: radial-gradient(circle, #a4311b 0%, #2f0704 150%);">📥 Import</button>
							<button id="btn_file_export" class="hwh-native-green-btn" style="background: radial-gradient(circle, #831ba4 0%, #22042f 150%);">📤 Export</button>
							<input type="file" id="hwh_file_input" style="display:none;" accept=".json">
						</div>
					</div>
				</div>`;

				window.Evo1SaveLogic = () => {
					if (!document.getElementById('inp_timeout')) return; // Fix: do not overwrite config if DOM is closed
					const getVal = id => parseFloat(document.getElementById(id)?.value || 0);
					DungeoExt3_Config.timeoutFix = getVal('inp_timeout') * 1000;
					DungeoExt3_Config.countFix = getVal('inp_countFix');
					DungeoExt3_Config.fixedTimerValue = getVal('inp_fixedTimer');
					DungeoExt3_Config.maxTimerValue = getVal('inp_maxTimer');
					DungeoExt3_Config.sim_countTestBattle = getVal('inp_simCountTest');
					DungeoExt3_Config.sim_countAutoBattle = getVal('inp_simCountAuto');
					DungeoExt3_Config.ga_populationSize = getVal('inp_popSize');
					DungeoExt3_Config.ga_generations = getVal('inp_gen');
					DungeoExt3_Config.ga_mutationRate = getVal('inp_mut');
					DungeoExt3_Config.ga_eliteCount = getVal('inp_elite');
					DungeoExt3_Config.decision_hpWeight = getVal('inp_hpWeight');
					DungeoExt3_Config.decision_energyWeight = getVal('inp_energyWeight');
					saveCurrentConfig();
					saveConfig();
				};

				window.Evo1LoadDOM = (pcfg) => {
					if (!pcfg) pcfg = {};
					const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
					setVal('inp_timeout', (pcfg.timeoutFix ?? DEFAULT_CONFIG.timeoutFix) / 1000);
					setVal('inp_countFix', pcfg.countFix ?? DEFAULT_CONFIG.countFix);
					setVal('inp_fixedTimer', pcfg.fixedTimerValue ?? DEFAULT_CONFIG.fixedTimerValue);
					setVal('inp_maxTimer', pcfg.maxTimerValue ?? DEFAULT_CONFIG.maxTimerValue);
					setVal('inp_simCountTest', pcfg.sim_countTestBattle ?? DEFAULT_CONFIG.sim_countTestBattle);
					setVal('inp_simCountAuto', pcfg.sim_countAutoBattle ?? DEFAULT_CONFIG.sim_countAutoBattle);
					setVal('inp_popSize', pcfg.ga_populationSize ?? DEFAULT_CONFIG.ga_populationSize);
					setVal('inp_gen', pcfg.ga_generations ?? DEFAULT_CONFIG.ga_generations);
					setVal('inp_mut', pcfg.ga_mutationRate ?? DEFAULT_CONFIG.ga_mutationRate);
					setVal('inp_elite', pcfg.ga_eliteCount ?? DEFAULT_CONFIG.ga_eliteCount);
					setVal('inp_hpWeight', pcfg.decision_hpWeight ?? DEFAULT_CONFIG.decision_hpWeight);
					setVal('inp_energyWeight', pcfg.decision_energyWeight ?? DEFAULT_CONFIG.decision_energyWeight);
				};

				const showToast = (msg, color = 'rgba(71, 164, 27, 0.9)') => {
					const toast = document.getElementById('hwh_save_toast');
					toast.innerText = msg;
					toast.style.background = color;
					toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 1500);
				};

				const attachListeners = setInterval(() => {
					const btnSave = document.getElementById('btn_global_save');
					if (btnSave) {
						clearInterval(attachListeners);
						btnSave.addEventListener('click', () => {
							window.Evo1SaveLogic();
							showToast('Configuration Saved!');
						});

						const chkAuto = document.getElementById('chk_autoload_defaults');
						if (chkAuto) {
							chkAuto.checked = typeof GM_getValue !== 'undefined' ? GM_getValue('DungeoExt3_AutoLoadDefaults', false) === true : false;
							chkAuto.addEventListener('change', (e) => {
								if (typeof GM_setValue !== 'undefined') {
									GM_setValue('DungeoExt3_AutoLoadDefaults', e.target.checked);
								}
								showToast(e.target.checked ? 'Auto Load Enabled' : 'Auto Load Disabled', 'rgba(164, 129, 27, 0.9)');
							});
						}
						for (let i = 1; i <= 8; i++) {
							document.getElementById(`btn_save_p${i}`).addEventListener('click', () => {
								window.Evo1SaveLogic();
								savedProfiles[`profile${i}`] = { ...DungeoExt3_Config };
								saveProfilesToStorage();
								setProgress(`Saved to P${i}`, false); setTimeout(hideProgress, 1000);
							});
							document.getElementById(`btn_load_p${i}`).addEventListener('click', () => {
								if (savedProfiles[`profile${i}`]) {
									window.Evo1LoadDOM(savedProfiles[`profile${i}`]);
									window.Evo1SaveLogic();
									// -- FIX: Avvisiamo il pannello che abbiamo forzato un profilo manuale
									document.dispatchEvent(new CustomEvent('manualProfileChanged'));
									setProgress(`Loaded P${i}`, false); setTimeout(hideProgress, 1000);
								} else {
									setProgress(`P${i} empty`, false); setTimeout(hideProgress, 1000);
								}
							});
						}

						// Set Default
						document.getElementById('btn_set_default').addEventListener('click', () => {
							window.Evo1SaveLogic();
							GM_setValue('DungeoExt3_UserDefaults_v1', JSON.stringify({ config: DungeoExt3_Config, profiles: savedProfiles }));
							showToast('Default Settings Saved!', 'rgba(164, 129, 27, 0.9)');
						});

						// Load Default
						document.getElementById('btn_load_default').addEventListener('click', () => {
							const stored = GM_getValue('DungeoExt3_UserDefaults_v1');
							if (stored) {
								try {
									const data = JSON.parse(stored);
									if (data.config) window.Evo1LoadDOM(data.config);
									if (data.profiles) {
										savedProfiles = data.profiles;
										saveProfilesToStorage();
									}
									window.Evo1SaveLogic();
									showToast('Defaults Loaded!', 'rgba(43, 119, 164, 0.9)');
								} catch (e) { }
							} else {
								// Load hardcoded fallback defaults
								window.Evo1LoadDOM(DEFAULT_CONFIG);
								window.Evo1SaveLogic();
								showToast('Hardcoded Defaults Loaded!', 'rgba(43, 119, 164, 0.9)');
							}
						});

						// Web Import
						document.getElementById('btn_web_import').addEventListener('click', () => {
							setProgress('Fetching from Web...', false);
							const fetchUrl = 'https://raw.githubusercontent.com/HeroWarsTools/dungeon/refs/heads/main/W1Ext3.json';
							if (typeof GM_xmlhttpRequest !== 'undefined') {
								GM_xmlhttpRequest({
									method: 'GET',
									url: fetchUrl,
									onload: function (response) {
										try {
											if (response.status !== 200) throw new Error('HTTP Status ' + response.status);
											const data = JSON.parse(response.responseText);
											if (data.profiles) {
												savedProfiles = data.profiles;
												saveProfilesToStorage();
											}
											if (data.config) {
												window.Evo1LoadDOM(data.config);
												window.Evo1SaveLogic();
											}
											showToast('Web Profiles Loaded!', 'rgba(27, 164, 129, 0.9)');
										} catch (e) {
											console.error(e);
											showToast('Parse Failed!', 'rgba(164, 27, 27, 0.9)');
										}
										hideProgress();
									},
									onerror: function (error) {
										console.error(error);
										showToast('Fetch Failed!', 'rgba(164, 27, 27, 0.9)');
										hideProgress();
									}
								});
							} else {
								// Fallback to fetch if GM_xmlhttpRequest is somehow not supported
								fetch(fetchUrl)
									.then(res => res.json())
									.then(data => {
										if (data.profiles) {
											savedProfiles = data.profiles;
											saveProfilesToStorage();
										}
										if (data.config) {
											window.Evo1LoadDOM(data.config);
											window.Evo1SaveLogic();
										}
										showToast('Web Profiles Loaded!', 'rgba(27, 164, 129, 0.9)');
										hideProgress();
									})
									.catch(e => {
										console.error(e);
										showToast('Fetch Failed (CORS/CSP)!', 'rgba(164, 27, 27, 0.9)');
										hideProgress();
									});
							}
						});

						// Local File Export
						document.getElementById('btn_file_export').addEventListener('click', () => {
							window.Evo1SaveLogic();
							const exportData = { config: DungeoExt3_Config, profiles: savedProfiles };
							const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
							const downloadAnchorNode = document.createElement('a');
							downloadAnchorNode.setAttribute("href", dataStr);
							downloadAnchorNode.setAttribute("download", "profiles1-8.json");
							document.body.appendChild(downloadAnchorNode);
							downloadAnchorNode.click();
							downloadAnchorNode.remove();
						});

						// Local File Import
						const fileInput = document.getElementById('hwh_file_input');
						document.getElementById('btn_file_import').addEventListener('click', () => {
							fileInput.click();
						});
						fileInput.addEventListener('change', (e) => {
							const file = e.target.files[0];
							if (!file) return;
							const reader = new FileReader();
							reader.onload = (ev) => {
								try {
									const data = JSON.parse(ev.target.result);
									if (data.config) window.Evo1LoadDOM(data.config);
									if (data.profiles) {
										savedProfiles = data.profiles;
										saveProfilesToStorage();
									}
									window.Evo1SaveLogic();
									showToast('Imported from File!', 'rgba(164, 49, 27, 0.9)');
								} catch (err) {
									showToast('Invalid JSON file!', 'rgba(164, 27, 27, 0.9)');
								}
							};
							reader.readAsText(file);
						});
					}
				}, 100);

				await popup.confirm(fullContentHTML, [{ msg: 'Close', result: false, isCancel: true, color: 'brown' }], []);
			}
		});
	}

	buttons['HWHStopDungeon'] = {
		get name() { return I18N('STOP_DUNGEON'); },
		get title() { return 'Stop Dungeon'; },
		color: 'red',
		onClick: () => {
			// Patch: controlla che window.HWHClasses esista!
			if (!window.HWHClasses) {
				alert('Impossibile fermare la dungeon: struttura non trovata (HWHClasses mancante)');
				return;
			}
			const dungeonInstance = window.HWHClasses.dungeonInstance;
			if (dungeonInstance && typeof dungeonInstance.stop === 'function') {
				dungeonInstance.stop();
				alert('Dungeon fermata manualmente.');
			} else {
				alert('Errore: Impossibile fermare la dungeon. L\'istanza non è stata trovata o non è attiva.');
			}
		},
	};

	class Stat {
		constructor(obj) {
			for (const key in obj) {
				if (obj.hasOwnProperty(key)) {
					this[key] = obj[key];
				}
			}
		}

		// Умножает все значения на указанное число
		multiply(multiplier) {
			for (const key in this) {
				if (this.hasOwnProperty(key)) {
					this[key] *= multiplier;
				}
			}
		}

		// Суммирует значения одинаковых ключей и добавляет новые ключи
		add(obj) {
			for (const key in obj) {
				if (obj.hasOwnProperty(key)) {
					if (this.hasOwnProperty(key)) {
						this[key] += obj[key];
					} else {
						this[key] = obj[key];
					}
				}
			}
		}

		// Округляет все значения до второго знака после запятой
		round() {
			for (const key in this) {
				if (this.hasOwnProperty(key)) {
					this[key] = Math.round(this[key] * 100) / 100;
				}
			}
		}
	}

	class TitanStats {
		constructor(titans, spirits, states) {
			this.titans = titans;
			this.spirits = spirits;
			this.states = states;
			this.heroLib = lib.data.hero;
			this.titanLib = lib.data.titan;
			this.artsLib = lib.data.titanArtifact;
			this.skinsLib = lib.data.skin;
			this.ruleLib = lib.data.rule;
			this.spiritSkills = lib.data.titanSpirit.skills;
			this.baseStats = new Stat({});
		}

		// Расчет базовых статов
		calculateBaseStats() {
			const titan = this.titans[this.titanId];
			const heroLib = this.heroLib[this.titanId];
			const titanLib = this.titanLib[this.titanId];
			this.baseStats = new Stat(heroLib.baseStats);
			const addStat = new Stat(titanLib.stars[titan.star].battleStatData);
			const coef = Math.pow(titan.level, this.ruleLib.titanLevelPowerCoefficient);
			addStat.multiply(coef);
			this.baseStats.add(addStat);
			this.baseStats.round();
		}

		// Добавление статов скинов
		addSkinStats() {
			const titan = this.titans[this.titanId];
			const skins = Object.entries(titan.skins);
			for (const [id, lvl] of skins) {
				const bonus = this.skinsLib[id].statData.levels[lvl].statBonus;
				this.baseStats.add(bonus);
			}
		}

		// Добавление статов артефактов
		addArtifactStats() {
			const titan = this.titans[this.titanId];
			const titanLibArt = this.titanLib[this.titanId].artifacts;
			for (const index in titanLibArt) {
				const artId = titanLibArt[index];
				const { level, star } = titan.artifacts[index];
				if (!star) {
					continue;
				}
				const libArt = this.artsLib.id[artId];
				const battleEffects = libArt.battleEffect;
				const artStat = new Stat({});
				for (const effectId of battleEffects) {
					const effect = this.artsLib.battleEffect[effectId];
					const stat = effect.effect;
					artStat.add({
						[stat]: effect.levels[level],
					});
				}
				const multiplier = this.artsLib.type[libArt.type].evolution[star].battleEffectMultiplier;
				artStat.multiply(multiplier);
				artStat.round();
				this.baseStats.add(artStat);
			}
		}

		// Добавление статов тотема
		addTotemStats() {
			const titanLib = this.titanLib[this.titanId];
			const element = titanLib.element;
			const spirit = this.spirits[element];
			let spiritMultiplier = 0;
			const spiritStat = new Stat({});
			if (spirit.star) {
				const battleEffects = this.artsLib.id[spirit.id].battleEffect;
				for (const effectId of battleEffects) {
					const effect = this.artsLib.battleEffect[effectId];
					const stat = effect.effect;
					spiritStat.add({
						[stat]: effect.levels[spirit.level],
					});
				}

				spiritMultiplier = this.artsLib.type['spirit'].evolution[spirit.star].battleEffectMultiplier;
				spiritStat.multiply(spiritMultiplier);
			}
			const elementSpiritSkills = [];
			const skills = [];
			if (spirit.primalSkill) {
				skills.push(...Object.entries(spirit.primalSkill));
			}
			if (spirit.elementalSkill) {
				skills.push(...Object.entries(spirit.elementalSkill));
			}
			for (const [id, level] of skills) {
				const skillId = +id;
				const tierScale = this.spiritSkills[skillId].levelScale[level - 1];
				elementSpiritSkills.push({ skillId, level, tierScale });
			}
			const addSpirit = {
				element,
				elementSpiritLevel: spirit.level,
				elementSpiritStar: spirit.star,
				elementSpiritSkills,
				elementAffinityPower: spirit.level * spiritMultiplier,
			};
			spiritStat.add(addSpirit);
			this.baseStats.add(spiritStat);
		}

		// Получение статов титана по его ID
		getTitanStats(titanId) {
			this.titanId = titanId;
			this.calculateBaseStats();
			this.addSkinStats();
			this.addArtifactStats();
			this.addTotemStats();
			const state = this.states[titanId] ?? {
				hp: Math.floor(this.baseStats.hp),
				energy: 0,
				isDead: false,
			};
			return Object.assign(this.titans[this.titanId], this.baseStats, { state });
		}

		getAllowTitanIds() {
			return Object.values(this.titans)
				.map((e) => e.id)
				.filter((id) => !this.states[id]?.isDead);
		}
	}

	class GeneticAlgorithm {
		constructor({ values, combinationSize, populationSize, generations, mutationRate, eliteCount }) {
			this.values = values;
			this.combinationSize = combinationSize;
			this.populationSize = populationSize;
			this.generations = generations;
			this.mutationRate = mutationRate;
			this.eliteCount = eliteCount;
			this.evaluationCache = new Map();
			this.evaluationCalls = 0;
			this.bestScores = [];

			// Default implementations
			this.getEvaluate = this.getEvaluate.bind(this);
			this.customSort = this.customSort.bind(this);
			this.compareScore = this.compareScore.bind(this);
		}

		/**
		 * Generate initial population using Fisher-Yates shuffle
		 * @returns {*[]}
		 */
		generateInitialPopulation() {
			const population = new Array(this.populationSize);
			const valuesLength = this.values.length;

			for (let i = 0; i < this.populationSize; i++) {
				const combination = new Array(this.combinationSize);
				const availableIndices = new Set();

				// Generate unique random indices
				while (availableIndices.size < this.combinationSize) {
					availableIndices.add(Math.floor(Math.random() * valuesLength));
				}

				// Build combination from selected indices
				let index = 0;
				for (const idx of availableIndices) {
					combination[index++] = this.values[idx];
				}

				population[i] = combination.sort();
			}
			return population;
		}

		/**
		 * Crossover function with improved efficiency
		 * @param {Array} parent1
		 * @param {Array} parent2
		 * @returns {Array[]}
		 */
		crossover(parent1, parent2) {
			const crossoverPoint = Math.floor(Math.random() * (parent1.length - 1)) + 1;
			const set1 = new Set(parent1.slice(0, crossoverPoint));
			const set2 = new Set(parent2.slice(0, crossoverPoint));

			// Add remaining genes while maintaining uniqueness
			for (const gene of parent2) {
				if (set1.size >= this.combinationSize) break;
				set1.add(gene);
			}

			for (const gene of parent1) {
				if (set2.size >= this.combinationSize) break;
				set2.add(gene);
			}

			return [
				Array.from(set1).slice(0, this.combinationSize).sort(),
				Array.from(set2).slice(0, this.combinationSize).sort()
			];
		}

		/**
		 * Mutation function with dynamic rate
		 * @param {Array} combination
		 * @returns {Array}
		 */
		mutate(combination) {
			const dynamicRate = this.mutationRate * (1 - this.evaluationCalls / 300);
			if (Math.random() >= dynamicRate) return combination.sort();

			const availableValues = this.values.filter(value => !combination.includes(value));
			if (availableValues.length === 0) return combination.sort();

			const mutated = [...combination];
			const mutationCount = Math.max(1, Math.floor(dynamicRate * this.combinationSize));

			for (let i = 0; i < mutationCount && availableValues.length > 0; i++) {
				const replaceIndex = Math.floor(Math.random() * this.combinationSize);
				const newValueIndex = Math.floor(Math.random() * availableValues.length);

				mutated[replaceIndex] = availableValues[newValueIndex];
				availableValues.splice(newValueIndex, 1);
			}

			return mutated.sort();
		}

		/**
		 * Evaluate combination with caching
		 * @param {Array} combination
		 * @returns {Promise<any>}
		 */
		async evaluateCombination(combination) {
			const key = combination.join(',');
			if (this.evaluationCache.has(key)) {
				return this.evaluationCache.get(key);
			}

			const value = await this.getEvaluate(combination);
			this.evaluationCache.set(key, value);
			this.evaluationCalls++;
			return value;
		}

		// Default evaluation function
		async getEvaluate(combination) {
			return combination.reduce((sum, value) => sum + value, 0);
		}

		// Default sort comparator
		customSort(a, b) {
			return b.v - a.v;
		}

		// Default score comparator
		compareScore(bestScore, targetScore) {
			return bestScore >= targetScore;
		}

		setEvaluate(evaFunction) {
			this.getEvaluate = evaFunction;
		}

		setCustomSort(customSort) {
			this.customSort = customSort;
		}

		setCompereScore(compareScore) {
			this.compareScore = compareScore;
		}

		/**
		 * Sort population with parallel evaluation
		 * @param {Array} population
		 * @returns {Promise<Array>}
		 */
		async sortPopulation(population) {
			const evaluated = await Promise.all(
				population.map(async item => ({
					item,
					v: await this.evaluateCombination(item)
				}))
			);

			evaluated.sort(this.customSort);
			return evaluated.map(({ item }) => item);
		}

		/**
		 * Tournament selection
		 * @param {Array} population
		 * @param {number} tournamentSize
		 * @returns {Promise<Array>}
		 */
		async selectParent(population, tournamentSize = 3) {
			let best = population[Math.floor(Math.random() * population.length)];
			let bestScore = await this.evaluateCombination(best);

			for (let i = 1; i < tournamentSize; i++) {
				const candidate = population[Math.floor(Math.random() * population.length)];
				const candidateScore = await this.evaluateCombination(candidate);

				if (candidateScore > bestScore) {
					best = candidate;
					bestScore = candidateScore;
				}
			}

			return best;
		}

		/**
		 * Run genetic algorithm
		 * @returns {Promise<Array>}
		 */
		async run() {
			let population = this.generateInitialPopulation();
			this.bestScores = [];
			this.evaluationCache.clear();
			this.evaluationCalls = 0;

			for (let generation = 0; generation < this.generations; generation++) {
				population = await this.sortPopulation(population);
				const bestScore = await this.evaluateCombination(population[0]);
				this.bestScores.push(bestScore);

				const nextPopulation = population.slice(0, this.eliteCount);

				while (nextPopulation.length < this.populationSize) {
					const [parent1, parent2] = await Promise.all([
						this.selectParent(population),
						this.selectParent(population)
					]);

					const [child1, child2] = this.crossover(parent1, parent2);
					nextPopulation.push(this.mutate(child1));

					if (nextPopulation.length < this.populationSize) {
						nextPopulation.push(this.mutate(child2));
					}
				}

				population = nextPopulation;
			}

			population = await this.sortPopulation(population);
			return population[0];
		}

		/**
		 * Generate parameter sets efficiently
		 * @param {Object} conf
		 * @returns {Array}
		 */
		static generateParamSets(conf) {
			const paramSets = [];
			const { populationSize, generations, mutationRate, eliteCount } = conf;

			for (let ps = populationSize.min; ps <= populationSize.max; ps += populationSize.step) {
				for (let gen = generations.min; gen <= generations.max; gen += generations.step) {
					for (let mr = mutationRate.min; mr <= mutationRate.max; mr += mutationRate.step) {
						for (let ec = eliteCount.min; ec <= eliteCount.max; ec += eliteCount.step) {
							paramSets.push({
								populationSize: ps,
								generations: gen,
								mutationRate: mr,
								eliteCount: ec
							});
						}
					}
				}
			}

			return paramSets;
		}

		/**
		 * Test parameters with early termination possibility
		 * @param {Array} values
		 * @param {number} combinationSize
		 * @param {Object} params
		 * @param {number} countTest
		 * @returns {Promise<Object>}
		 */
		/**
		 * Test parameters with adaptive testing - more tests for promising parameters
		 * @param {Array} values
		 * @param {number} combinationSize
		 * @param {Object} params
		 * @param {number} minTests
		 * @param {number} maxTests
		 * @returns {Promise<Object>}
		 */
		static async testParams(values, combinationSize, params, minTests = 50, maxTests = 250) {
			const evaluationCalls = [];
			const scores = [];
			let variance = Infinity;
			let testsCompleted = 0;

			// Adaptive testing: run more tests for parameters with high variance
			while (testsCompleted < maxTests && (testsCompleted < minTests || variance > 0.1)) {
				const ga = new GeneticAlgorithm({ values, combinationSize, ...params });
				const bestCombination = await ga.run();
				evaluationCalls.push(ga.evaluationCalls);
				const score = ((await ga.evaluateCombination(bestCombination)) - 20016) / 183;
				scores.push(score);
				testsCompleted++;

				// Calculate variance periodically
				if (testsCompleted % 10 === 0 && testsCompleted >= minTests) {
					const mean = scores.reduce((a, b) => a + b) / scores.length;
					variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
				}
			}

			const avgScore = scores.reduce((a, b) => a + b) / scores.length;
			const avgEvaluationCalls = evaluationCalls.reduce((a, b) => a + b) / evaluationCalls.length;

			return {
				avgScore,
				avgEvaluationCalls,
				testsCompleted,
				variance: variance || 0
			};
		}

		/**
		 * Optimize parameters with intelligent testing strategy
		 * @param {Array} values
		 * @param {number} combinationSize
		 * @param {number} targetScore
		 * @param {Object} optimizeConfig
		 * @returns {Promise<Object>}
		 */
		static async optimizeParameters(values, combinationSize, targetScore, optimizeConfig) {
			const paramSets = this.generateParamSets(optimizeConfig);
			let bestParams = null;
			let bestEfficiency = -Infinity;
			let bestData = { avgScore: 0, avgEvaluationCalls: 0 };

			const total = paramSets.length;
			const startTime = Date.now();

			// First pass: quick evaluation with fewer tests
			const promisingParams = [];
			for (let i = 0; i < total; i++) {
				const params = paramSets[i];
				const result = await this.testParams(values, combinationSize, params, 20, 50);

				const efficiency = (result.avgScore * result.avgScore) / result.avgEvaluationCalls;

				if (result.avgScore >= targetScore * 0.8) { // 80% of target is promising
					promisingParams.push({ params, result, efficiency });
				}

				if (efficiency > bestEfficiency && result.avgScore >= targetScore) {
					bestEfficiency = efficiency;
					bestData = result;
					bestParams = params;
				}

				if (i % 10 === 0) {
					this.logProgress(i, total, startTime, bestParams, bestData);
				}
			}

			// Second pass: detailed evaluation of promising parameters
			console.log(`\nDetailed evaluation of ${promisingParams.length} promising parameter sets...`);
			promisingParams.sort((a, b) => b.efficiency - a.efficiency);

			for (let i = 0; i < promisingParams.length; i++) {
				const { params } = promisingParams[i];
				const result = await this.testParams(values, combinationSize, params, 100, 250);

				const efficiency = (result.avgScore * result.avgScore) / result.avgEvaluationCalls;

				if (efficiency > bestEfficiency && result.avgScore >= targetScore) {
					bestEfficiency = efficiency;
					bestData = result;
					bestParams = params;
				}

				this.logProgress(i, promisingParams.length, startTime, bestParams, bestData, 'Detailed ');
			}

			console.log('Optimal Parameters:', bestParams, bestData);
			return bestParams;
		}

		static logProgress(current, total, startTime, bestParams, bestData, prefix = '') {
			const elapsed = (Date.now() - startTime) / 1000;
			const progress = ((current + 1) / total) * 100;
			const estimatedTotal = elapsed / (current + 1) * total;
			const remaining = estimatedTotal - elapsed;

			console.log(`${prefix}Progress: ${current + 1}/${total} (${progress.toFixed(1)}%)`);
			console.log(`Elapsed: ${elapsed.toFixed(1)}s, Remaining: ${remaining.toFixed(1)}s`);
			console.log('Current best:', bestParams, bestData);
		}

		/**
		 * Optimize parameters with progress tracking
		 * @param {Array} values
		 * @param {number} combinationSize
		 * @param {number} targetScore
		 * @param {Object} optimizeConfig
		 * @returns {Promise<Object>}
		 */
		static async optimizeParameters(values, combinationSize, targetScore, optimizeConfig) {
			const paramSets = this.generateParamSets(optimizeConfig);
			let bestParams = null;
			let bestEfficiency = -Infinity;
			let bestData = { avgScore: 0, avgEvaluationCalls: 0 };

			const total = paramSets.length;
			const startTime = Date.now();

			for (let i = 0; i < total; i++) {
				const params = paramSets[i];
				const result = await this.testParams(values, combinationSize, params, 50); // Reduced test count for speed

				const efficiency = (result.avgScore * result.avgScore) / result.avgEvaluationCalls;

				if (efficiency > bestEfficiency && result.avgScore >= targetScore) {
					bestEfficiency = efficiency;
					bestData = result;
					bestParams = params;
				}

				// Progress logging
				if (i % 10 === 0 || i === total - 1) {
					const elapsed = (Date.now() - startTime) / 1000;
					const remaining = elapsed / (i + 1) * (total - i - 1);
					console.log(`Progress: ${i + 1}/${total} (${Math.round((i + 1) / total * 100)}%)`);
					console.log(`Elapsed: ${elapsed.toFixed(1)}s, Remaining: ${remaining.toFixed(1)}s`);
					console.log('Current best:', bestParams, bestData);
				}
			}

			console.log('Optimal Parameters:', bestParams, bestData);
			return bestParams;
		}
	}

	class BestDungeon {
		constructor(resolve, reject) {
			this.resolve = resolve;
			this.reject = reject;
			this.isFixedBattle = true;
			this.dungeonActivity = 0;
			this.maxDungeonActivity = 150;
			this.primeElement = '';
			this.titanGetAll = {};
			this.teams = { earth: [], fire: [], neutral: [], water: [], hero: {} };
			this.titansStates = {};
			this.talentMsg = '';
			this.talentMsgReward = '';
			this.evaluatePack = false;
			this.isShowFixLog = false;
			this.isStop = false;
			if (!window.HWHClasses) window.HWHClasses = {};
			window.HWHClasses.dungeonInstance = this;
			this.colors = {
				water: 'color: #3498db;',
				fire: 'color: #e74c3c;',
				earth: 'color: #2ecc71;',
				light: 'color: #f1c40f;',
				dark: 'color: #9b59b6;',
				neutral: 'color: yellow;',
				green: 'color: #0b0;',
				none: 'color: none;',
				red: 'color: #d00;',
			};
		}

		async start(titanit) {
			this.maxDungeonActivity = titanit || +getInput('countTitanit');
			const result = await Caller.send([
				'dungeonGetInfo',
				'teamGetAll',
				'teamGetFavor',
				'clanGetInfo',
				'titanGetAll',
				'inventoryGet',
				'titanSpirit_getAll',
			]);
			this.startDungeon(result);
		}

		stop() {
			this.isStop = true;
		}

		getStatMessage() {
			return `Dungeon: ${I18N('TITANIT')} ${this.dungeonActivity}/${this.maxDungeonActivity}${this.talentMsg}<br><span style="color:#e94747">Healing Buff: -${this.buffHealing || 0}%</span>`;
		}

		startDungeon(data) {
			const [dungeonGetInfo, teamGetAll, teamGetFavor, clanGetInfo, titanGetAll, inventoryGet, titanSpirits] = data;

			if (!dungeonGetInfo) {
				this.endDungeon('noDungeon');
				return;
			}

			this.dungeonGetInfo = dungeonGetInfo;
			this.teamGetAll = teamGetAll;
			this.teamGetFavor = teamGetFavor;
			this.dungeonActivity = clanGetInfo.stat.todayDungeonActivity;
			this.titanGetAll = titanGetAll;
			this.titans = Object.values(titanGetAll);
			HWHData.countPredictionCard = inventoryGet.consumable[81] || 0;
			this.titanSpirits = titanSpirits.spirits;

			this.teams.hero = {
				favor: teamGetFavor.dungeon_hero,
				heroes: teamGetAll.dungeon_hero.filter((id) => id < 6000),
				teamNum: 0,
			};

			const heroPet = teamGetAll.dungeon_hero.find((id) => id >= 6000);
			if (heroPet) this.teams.hero.pet = heroPet;

			['neutral', 'water', 'fire', 'earth'].forEach((type) => {
				this.teams[type] = {
					favor: {},
					heroes: DungeonUtils.getTitanTeam(this.titans, type),
					teamNum: 0,
				};
			});

			this.checkFloor(dungeonGetInfo);
		}


		showTitanStates() {
			const titanGetAll = this.titanGetAll;
			const titans = this.titansStates;

			const columns = [
				{ element: 'water', color: '#3498db', icon: '🌊' },
				{ element: 'fire', color: '#e74c3c', icon: '🔥' },
				{ element: 'earth', color: '#2ecc71', icon: '🌍' },
				{ element: 'light', color: '#f1c40f', icon: '☀️' },
				{ element: 'dark', color: '#9b59b6', icon: '🌑' },
			];

			// Prepara i dati per l'evento CustomEvent
			const titansData = columns.reduce((acc, col) => {
				acc[col.element] = Object.keys(titanGetAll)
					.filter(id => lib.data.titan[id].element === col.element)
					.map(id => {
						const hp = titans[id]?.hp || 0;
						const maxHp = titans[id]?.maxHp || 1;
						const hpPercent = Math.floor((hp / maxHp) * 100);
						const energy = titans[id]?.energy || 0;
						const isDead = titans[id]?.isDead;
						return {
							name: cheats.translate(`LIB_HERO_NAME_${id}`),
							hpPercent,
							energy,
							isDead,
						};
					});
				return acc;
			}, {});

			// Invia dati tramite evento personalizzato
			const event = new CustomEvent('titanStatesUpdated', {
				detail: titansData
			});
			document.dispatchEvent(event);

			console.log('Dati dei titani inviati tramite evento personalizzato.');

			// ...se vuoi, mantieni anche la visualizzazione tabellare...
		}

		// VERSIONE MODIFICATA
		async checkFloor(dungeonInfo) {
			console.log('Dungeon Info Object:', dungeonInfo);
			if (this.isStop) {
				this.endDungeon('endDungeon', I18N('STOPPED'));
				return;
			}
			if (!dungeonInfo.floor || dungeonInfo.floor.state === 2) {
				await this.saveProgress();
				return;
			}

			await this.checkTalent(dungeonInfo);
			const message = this.getStatMessage();
			setProgress(message, false, this.stop.bind(this));

			if (this.dungeonActivity >= this.maxDungeonActivity) {
				this.endDungeon('endDungeon', `maxActive ${this.dungeonActivity}/${this.maxDungeonActivity}`);
				return;
			}

			this.titansStates = dungeonInfo.states.titans;
			this.showTitanStates();
			const floorChoices = dungeonInfo.floor.userData;
			const floorType = dungeonInfo.floorType;
			this.primeElement = dungeonInfo.elements.prime;

			// ==========================================================
			// --- CODICE AGGIUNTO ---
			// Create and dispatch a custom event with details about the current floor.
			const floorEvent = new CustomEvent('floorChanged', {
				detail: {
					floorNumber: dungeonInfo.floorNumber,
					floorType: floorType,
					primeElement: this.primeElement, // This is the dungeon buff
					healingBuffs: this.buffHealing || 0
				}
			});
			document.dispatchEvent(floorEvent);
			// ==========================================================

			if (floorType === 'battle') {
				const battles = await this.prepareBattles(floorChoices);
				if (battles.length === 0) {
					this.endDungeon('endDungeon', 'All Dead');
					return;
				}
				this.testProcessingPromises(battles);
			}
		}

		async prepareBattles(floorChoices) {
			const { fixTitanTeam, getNeutralTeam } = DungeonUtils;
			const battles = [];
			for (const [teamNum, choice] of Object.entries(floorChoices)) {
				const { attackerType } = choice;
				let team = {
					favor: {},
					teamNum,
					heroes: [],
				};
				if (attackerType === 'hero') {
					team = this.teams[attackerType];
				} else {
					team.heroes = fixTitanTeam(this.teams[attackerType].heroes, this.titansStates);
				}

				if (attackerType === 'neutral') {
					team.heroes = getNeutralTeam(this.titans, this.titansStates);
				}
				if (team.heroes.length === 0) {
					continue;
				}

				const battleData = await Caller.send({ name: 'dungeonStartBattle', args: { ...team, teamNum } });
				battles.push({
					...battleData,
					progress: [{ attackers: { input: ['auto', 0, 0, 'auto', 0, 0] } }],
					teamNum,
					attackerType,
				});
			}
			return battles;
		}

		async checkTalent(dungeonInfo) {
			const { talent } = dungeonInfo;
			if (!talent) return;

			const dungeonFloor = +dungeonInfo.floorNumber;
			const talentFloor = +talent.floorRandValue;
			let doorsAmount = 3 - talent.conditions.doorsAmount;

			if (dungeonFloor === talentFloor && (!doorsAmount || !talent.conditions?.farmedDoors[dungeonFloor])) {
				const [reward] = await Caller.send([
					{ name: 'heroTalent_getReward', args: { talentType: 'tmntDungeonTalent', reroll: false } },
					{ name: 'heroTalent_farmReward', args: { talentType: 'tmntDungeonTalent' } },
				]);

				const type = Object.keys(reward).pop();
				const itemId = Object.keys(reward[type]).pop();
				const count = reward[type][itemId];
				const itemName = cheats.translate(`LIB_${type.toUpperCase()}_NAME_${itemId}`);
				this.talentMsgReward += `<br> ${count} ${itemName}`;
				doorsAmount++;
			}

			this.talentMsg = `<br>TMNT Talent: ${doorsAmount}/3 ${this.talentMsgReward}<br>`;
		}

		updatePower(battle) {
			const type = battle.attackerType;
			const def = Object.values(battle.defenders[0]);
			const power = def.reduce((a, e) => a + e.power, 0);
			if (!this.defPowers) this.defPowers = {};
			this.defPowers[type] = power;

			const buff = battle?.effects?.defenders?.percentBuffAllEnemy_healing;
			if (buff) { this.buffHealing = buff; }

			if (typeof window !== 'undefined') {
				const currentData = window.HWH_TitanStats || {};
				currentData.dungeonBuff = this.buffHealing || 0;
				currentData.timestamp = Date.now();
				window.HWH_TitanStats = currentData;
			}
		}

		async testProcessingPromises(battles) {
			let selectBattle = null;
			let bestRec = {
				hp: -Infinity,
				energy: -Infinity,
			};
			this.evaluatePack = false;

			for (const battle of battles) {
				this.updatePower(battle);
				if (battle.attackerType === 'hero') {
					this.logBattleStats(battle.attackerType);
					const resultHeroBattle = await Calc(battle);
					await this.endBattle(resultHeroBattle);
					return;
				}

				let maxRec = {};
				if (battle.attackerType === 'neutral') {
					const titanStats = new TitanStats(this.titanGetAll, this.titanSpirits, this.titansStates);
					const evalute = new EvaluateAttackPack(titanStats, battle);
					const attackers = await evalute.getAttackers();
					battle.attackers = attackers;
					this.evaluatePack = attackers;
					maxRec = evalute.getStatBestPack();
				} else {
					maxRec = await this.calculateBattleStats(battle);
				}

				if (DungeonUtils.compareScore(maxRec, bestRec)) {
					bestRec.hp = maxRec.hp;
					bestRec.energy = maxRec.energy;
					selectBattle = battle;
				}

				this.logBattleStats(battle.attackerType, maxRec);
			}

			if (!selectBattle || bestRec.hp <= -Infinity) {
				this.endDungeon(I18N('WINNING_FIGHT_NOT_FOUND'), battles);
				return;
			}

			await this.processSelectedBattle(selectBattle, bestRec);
		}

		async calculateBattleStats(battle) {
			const { getState, compareScore, isRandomBattle, genBattleSeed } = DungeonUtils;
			// Use the value from our config object
			let countTestBattle = DungeoExt3_Config.sim_countTestBattle;
			const bestRec = {
				hp: -Infinity,
				energy: -Infinity,
			};

			if (!isRandomBattle(battle)) {
				countTestBattle = 1;
			}

			for (let i = 0; i < countTestBattle; i++) {
				const rec = await Calc({ ...battle, seed: genBattleSeed() }).then(getState);
				if (compareScore(rec, bestRec)) {
					bestRec.hp = rec.hp;
					bestRec.energy = rec.energy;
				}
			}

			return bestRec;
		}

		logBattleStats(attackerType, bestRec = null) {
			let colors = [];
			let text = '';
			if (bestRec) {
				colors = [this.colors.green, this.colors.none];
				text = ' %cbestStat: %c' + JSON.stringify(bestRec);
			}
			console.log(`%c${attackerType}` + text, this.colors[attackerType], ...colors);
		}

		logSelectPack(battle, recSelectBattle) {
			const attackerType = battle.attackerType;
			const pack = Object.values(battle.attackers).map((e) => e.id);

			const list = pack.reduce(
				(a, e) => {
					a.names.push('%c' + cheats.translate('LIB_HERO_NAME_' + e));
					a.styles.push(this.colors[lib.data.titan[e].element]);
					return a;
				},
				{ names: [], styles: [] }
			);

			console.log('Select: %c' + attackerType, this.colors[attackerType]);
			console.log('%cbattleStat: %c' + JSON.stringify(recSelectBattle), this.colors.green, this.colors.none);
			console.log('%cPack: ' + list.names.join(' '), this.colors[attackerType], ...list.styles);
		}

		async processSelectedBattle(selectBattle, bestRec) {
			const { getState, compareScore } = DungeonUtils;
			const resultSelectBattle = await this.resultBattle(selectBattle);
			const recSelectBattle = getState(resultSelectBattle);

			if (compareScore(recSelectBattle, bestRec)) {
				bestRec = recSelectBattle;
			}
			this.logSelectPack(selectBattle, recSelectBattle);

			if (compareScore(recSelectBattle, bestRec) && !this.evaluatePack && selectBattle.teamNum === '1') {
				await this.endBattle(resultSelectBattle);
			} else {
				await this.retryBattle(selectBattle, bestRec, recSelectBattle);
			}
		}

		async retryBattle(selectBattle, bestRec, recSelectBattle) {
			const { getState, compareScore } = DungeonUtils;
			// Use the value from our config object
			const countAutoBattle = DungeoExt3_Config.sim_countAutoBattle;
			for (let i = 0; i < countAutoBattle; i++) {
				const result = await this.startBattle(selectBattle.teamNum, selectBattle.attackerType);
				const rec = getState(result);
				console.log(
					'%cCurrent battle ' + (i + 1) + ' attempts%c ' + JSON.stringify(rec) + ' ' + JSON.stringify(bestRec),
					this.colors.green,
					this.colors.none
				);
				if (compareScore(rec, bestRec)) {
					console.log('%cBest fight found in ' + (i + 1) + ' attempts', this.colors.green);
					if (compareScore(rec, recSelectBattle)) {
						console.log('%cFinal result: ' + JSON.stringify(rec), this.colors.red);
					}
					await this.endBattle(result);
					return;
				} else {
					bestRec.hp -= 0.0005 * i;
					bestRec.energy -= 0.001 * i;
				}
			}

			console.log('Best fight not found');
			const result = await this.startBattle(selectBattle.teamNum, selectBattle.attackerType);
			await this.endBattle(result);
		}

		async startBattle(teamNum, attackerType) {
			const { fixTitanTeam, getNeutralTeam } = DungeonUtils;
			const team = {
				favor: {},
				teamNum,
				heroes: fixTitanTeam(this.teams[attackerType].heroes, this.titansStates),
			};
			if (attackerType === 'neutral') {
				if (this.evaluatePack) {
					team.heroes = Object.values(this.evaluatePack).map((e) => e.id);
				} else {
					team.heroes = getNeutralTeam(this.titans, this.titansStates);
				}
			}

			const battleData = await Caller.send({ name: 'dungeonStartBattle', args: { ...team, teamNum } });
			return this.resultBattle(battleData, { teamNum, attackerType });
		}

		async resultBattle(battleData, args = {}) {
			if (this.isFixedBattle) {
				const dfb = new UpdateDungeonFixBattle(battleData);
				dfb.isShowResult = this.isShowFixLog;

				// MODIFICA CRUCIALE: Legge i valori sempre aggiornati dal nostro oggetto sicuro
				const fixData = await dfb.start(Date.now() + DungeoExt3_Config.timeoutFix, DungeoExt3_Config.countFix);

				console.log('timer', fixData.timer);
				battleData.progress = [{ attackers: { input: ['auto', 0, 0, 'auto', 0, fixData.timer] } }];
			}
			const result = await Calc(battleData);
			return { ...result, ...args };
		}

		async endBattle(battleInfo) {
			// Проверка на ничью
			const isAllDead = Object.values(battleInfo.progress[0].attackers.heroes).every((item) => item.isDead);
			if (!battleInfo.result.win && isAllDead) {
				this.endDungeon('dungeonEndBattle win: false\n', battleInfo);
				return;
			}

			const args = { result: battleInfo.result, progress: battleInfo.progress };
			console.log('countCard', HWHData.countPredictionCard);
			if (HWHData.countPredictionCard) {
				args.isRaid = true;
			} else {
				const message = this.getStatMessage();
				const timerFinished = await countdownTimer(battleInfo.battleTimer, message, this.stop.bind(this));
				console.log('timerFinished', timerFinished);
				if (!timerFinished) {
					this.endDungeon('endDungeon', I18N('STOPPED'));
					return;
				}
			}

			const resultEnd = await Caller.send({ name: 'dungeonEndBattle', args });
			this.resultEndBattle(resultEnd);
		}

		// VERSIONE MODIFICATA
		resultEndBattle(battleResult) {
			if (battleResult.error) {
				this.endDungeon('Error', battleResult.error);
			}
			const dungeonGetInfo = battleResult.dungeon ?? battleResult;
			if (dungeonGetInfo.reward) {
				this.dungeonGetInfo = dungeonGetInfo;
			} else {
				// In case of a draw, only update stats
				this.dungeonGetInfo.states = dungeonGetInfo.states;
			}
			this.dungeonActivity += battleResult.reward?.dungeonActivity ?? 0;

			// ==========================================================
			// --- CODICE AGGIUNTO ---
			// Create and dispatch a custom event with the progress update.
			const progressEvent = new CustomEvent('dungeonProgressUpdated', {
				detail: {
					currentTitanite: this.dungeonActivity,
					maxTitanite: this.maxDungeonActivity,
					lastReward: battleResult.reward // Sends the entire reward object
				}
			});
			document.dispatchEvent(progressEvent);
			// ==========================================================

			this.checkFloor(this.dungeonGetInfo);
		}

		titanObjToArray(obj) {
			return Object.entries(obj).map(([id, data]) => ({ id, ...data }));
		}

		async saveProgress() {
			const result = await Caller.send('dungeonSaveProgress');
			this.resultEndBattle(result);
		}

		endDungeon(reason, info) {
			console.warn(reason, info);
			const message = this.getStatMessage() + '<br>Dungeon completed!' + (reason === 'endDungeon' ? `<br>${info}` : '');

			setProgress(message, false, hideProgress);
			this.resolve();
			if (window.HWHClasses) window.HWHClasses.dungeonInstance = null;
		}
	}

	this.HWHClasses.executeDungeon = BestDungeon;

	class EvaluateAttackPack {
		constructor(heroStats, battle) {
			this.heroStats = heroStats;
			this.battle = structuredClone(battle);

			//this.bestParams = {
			//populationSize: 14,
			//generations: 100,
			//mutationRate: 0.04,
			//eliteCount: 3,
			//};
		}

		async getAttackers() {
			const values = this.heroStats.getAllowTitanIds();

			// ==========================================================
			// This will print the GA parameters to the console right before the calculation starts.
			console.log('%cGenetic Algorithm: Starting search with custom parameters...', 'color: #3498db; font-weight: bold;');
			console.log({
				populationSize: DungeoExt3_Config.ga_populationSize,
				generations: DungeoExt3_Config.ga_generations,
				mutationRate: DungeoExt3_Config.ga_mutationRate,
				eliteCount: DungeoExt3_Config.ga_eliteCount
			});
			// ==========================================================

			// MODIFY the GeneticAlgorithm instantiation to use the new config object
			const ga = new GeneticAlgorithm({
				values,
				combinationSize: 5,
				// Use the new, configurable parameters from our global config object
				populationSize: DungeoExt3_Config.ga_populationSize,
				generations: DungeoExt3_Config.ga_generations,
				mutationRate: DungeoExt3_Config.ga_mutationRate,
				eliteCount: DungeoExt3_Config.ga_eliteCount,
			});
			ga.setEvaluate(this.evaluatePack.bind(this));
			ga.setCustomSort(this.sortByHpAndEnergy);
			ga.setCompereScore(DungeonUtils.compareScore);

			const bestCombination = await ga.run();
			this.statBestCombination = await ga.evaluateCombination(bestCombination);
			console.log(
				I18N('BEST_COMBINATION'),
				bestCombination,
				bestCombination.map((e) => cheats.translate('LIB_HERO_NAME_' + e)),
				this.statBestCombination,
				ga.evaluationCalls
			);

			const attackers = Object.fromEntries(bestCombination.map((id) => [id, this.heroStats.getTitanStats(id)]));

			return attackers;
		}

		getStatBestPack() {
			return this.statBestCombination;
		}

		sortByHpAndEnergy(a, b) {
			if (a.v.hp !== b.v.hp) {
				return b.v.hp - a.v.hp;
			}
			return b.v.energy - a.v.energy;
		}

		getBattleWithPack(pack) {
			const cloneBattle = structuredClone(this.battle);
			cloneBattle.attackers = Object.fromEntries(pack.map((id) => [id, this.heroStats.getTitanStats(id)]));
			return cloneBattle;
		}

		async evaluatePack(pack) {
			const cloneBattle = this.getBattleWithPack(pack);
			const { isRandomBattle, genBattleSeed, getState, compareScore } = DungeonUtils;

			const maxResult = {
				hp: -Infinity,
				energy: -Infinity,
				seed: null,
			};
			const countTestBattle = isRandomBattle(cloneBattle) ? 10 : 1;
			for (let i = 0; i < countTestBattle; i++) {
				const seed = genBattleSeed();
				cloneBattle.seed = seed;
				const result = await Calc(cloneBattle).then(getState);
				//await new Promise((resolve) => requestAnimationFrame(resolve));
				if (compareScore(result, maxResult)) {
					maxResult.hp = result.hp;
					maxResult.energy = result.energy;
					maxResult.seed = seed;
				}
			}

			//console.log(maxResult, pack);
			return maxResult;
		}
	}

	class DungeonUtils {
		static getState(result) {
			const isAllDead = Object.values(result.progress[0].attackers.heroes).every((item) => item.isDead);
			if (isAllDead) {
				return {
					hp: -1e300,
					energy: -1e300,
					losses: Object.keys(result.battleData.attackers),
				};
			}

			let initialHP = 0;
			let initialEnergy = 0;
			const beforeTitans = result.battleData.attackers;
			for (let titanId in beforeTitans) {
				const titan = beforeTitans[titanId];
				const state = titan.state;
				if (state) {
					initialHP += state.hp / titan.hp;
					initialEnergy += state.energy / 1e3;
				}
			}

			let afterHP = 0;
			let afterEnergy = 0;
			const afterTitans = result.progress[0].attackers.heroes;
			for (let titanId in afterTitans) {
				const titan = afterTitans[titanId];
				afterHP += titan.hp / beforeTitans[titanId].hp;
				afterEnergy += titan.energy / 1e3;
			}

			const beforeIds = Object.keys(beforeTitans);
			const afterIds = Object.keys(beforeTitans);
			const losses = beforeIds.filter((key) => !afterIds.includes(key));

			const hp = afterHP - initialHP;
			const energy = afterEnergy - initialEnergy;

			if (!afterIds.length || (hp <= 0 && energy <= 0 && !result.result.win)) {
				return {
					hp: -1e300,
					energy: -1e300,
					losses,
				};
			}

			return {
				hp,
				energy,
				losses,
			};
		}
		static isRandomPack(pack) {
			const ids = Object.values(pack).map((e) => +e.id);
			return ids.includes(4023) || ids.includes(4021);
		}

		static isRandomBattle(battle) {
			return DungeonUtils.isRandomPack(battle.attackers) || DungeonUtils.isRandomPack(battle.defenders[0]);
		}

		static compareScore(newScore, lastScore) {
			//return newScore.hp >= lastScore.hp || (newScore.hp === lastScore.hp && newScore.energy > lastScore.energy);
			// Use the values from our config object
			const hpWeight = DungeoExt3_Config.decision_hpWeight;
			const energyWeight = DungeoExt3_Config.decision_energyWeight;

			const lastValue = lastScore.hp * hpWeight + lastScore.energy * energyWeight;
			const newValue = newScore.hp * hpWeight + newScore.energy * energyWeight;

			return newValue >= lastValue;
		}

		static titanObjToArray(obj) {
			return Object.entries(obj).map(([id, data]) => ({ id, ...data }));
		}

		static getTitanTeam(titans, type) {
			if (type === 'neutral') {
				return DungeonUtils.getNeutralTeam(titans);
			}

			const indexMap = { water: '0', fire: '1', earth: '2' };
			const index = indexMap[type];
			return titans.filter((e) => e.id.toString().slice(2, 3) === index).map((e) => e.id);
		}

		static getNeutralTeam(titans, states = {}) {
			return DungeonUtils.fixTitanTeam(titans, states)
				.sort((a, b) => b.power - a.power)
				.slice(0, 5)
				.map((e) => e.id);
		}

		static fixTitanTeam(titans, states = {}) {
			return titans.filter((titan) => {
				const id = titan.id ?? titan;
				return !states[id]?.isDead;
			});
		}

		static genBattleSeed() {
			return Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1e6);
		}
	}

	/**
	 * Script control panel
	 *
	 * Панель управления скриптом
	 *
	 * Дизайн и стили кнопок
	 * Anton Nazarov
	 * https://t.me/antiokh
	 */
	class NewScriptMenu extends EventEmitterMixin() {
		constructor() {
			if (NewScriptMenu.instance) {
				return NewScriptMenu.instance;
			}
			super();
			this.mainMenu = null;
			this.buttons = [];
			this.checkboxes = [];
			this.option = {
				showMenu: true,
				showDetails: {},
			};
			NewScriptMenu.instance = this;
			return this;
		}

		static getInst() {
			if (!NewScriptMenu.instance) {
				new NewScriptMenu();
			}
			return NewScriptMenu.instance;
		}

		init(option = {}) {
			this.emit('beforeInit', option);
			this.option = Object.assign(this.option, option);
			const saveOption = this.loadSaveOption();
			this.option = Object.assign(this.option, saveOption);
			this.addStyle();
			this.addBlocks();
			this.emit('afterInit', option);
		}

		addStyle() {
			const style = document.createElement('style');
			style.innerText = `
			.scriptMenu_status {
				position: absolute;
				z-index: 10001;
				top: -1px;
				left: 30%;
				cursor: pointer;
				border-radius: 0px 0px 10px 10px;
				background: #190e08e6;
				border: 1px #ce9767 solid;
				font-size: 18px;
				font-family: sans-serif;
				font-weight: 600;
				color: #fce1ac;
				text-shadow: 0px 0px 1px;
				transition: 0.5s;
				padding: 2px 10px 3px;
			}
			.scriptMenu_statusHide {
				top: -35px;
				height: 30px;
				overflow: hidden;
			}
			.scriptMenu_label {
				position: absolute;
				top: 30%;
				left: -4px;
				z-index: 9999;
				cursor: pointer;
				width: 30px;
				height: 30px;
				background: radial-gradient(circle, #47a41b 0%, #1a2f04 100%);
				border: 1px solid #1a2f04;
				border-radius: 5px;
				box-shadow:
				inset 0px 2px 4px #83ce26,
				inset 0px -4px 6px #1a2f04,
				0px 0px 2px black,
				0px 0px 0px 2px	#ce9767;
			}
			.scriptMenu_label:hover {
				filter: brightness(1.2);
			}
			.scriptMenu_arrowLabel {
				width: 100%;
				height: 100%;
				background-size: 75%;
				background-position: center;
				background-repeat: no-repeat;
				background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='%2388cb13' d='M7.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C.713 12.69 0 12.345 0 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692Z'/%3e%3cpath fill='%2388cb13' d='M15.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C8.713 12.69 8 12.345 8 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692Z'/%3e%3c/svg%3e");
				box-shadow: 0px 1px 2px #000;
				border-radius: 5px;
				filter: drop-shadow(0px 1px 2px #000D);
			}
			.scriptMenu_main {
				position: absolute;
				max-width: 285px;
				z-index: 9999;
				top: 50%;
				transform: translateY(-40%);
				background: #190e08e6;
				border: 1px #ce9767 solid;
				border-radius: 0px 10px 10px 0px;
				border-left: none;
				box-sizing: border-box;
				font-size: 15px;
				font-family: sans-serif;
				font-weight: 600;
				color: #fce1ac;
				text-shadow: 0px 0px 1px;
				transition: 1s;
			}
			.scriptMenu_conteiner {
				max-height: 80vh;
				overflow: scroll;
				scrollbar-width: none; /* Для Firefox */
				-ms-overflow-style: none; /* Для Internet Explorer и Edge */
				display: flex;
				flex-direction: column;
				flex-wrap: nowrap;
				padding: 5px 10px 5px 5px;
			}
			.scriptMenu_conteiner::-webkit-scrollbar {
				display: none; /* Для Chrome, Safari и Opera */
			}
			.scriptMenu_showMenu {
				display: none;
			}
			.scriptMenu_showMenu:checked~.scriptMenu_main {
				left: 0px;
			}
			.scriptMenu_showMenu:not(:checked)~.scriptMenu_main {
				left: -300px;
			}
			.scriptMenu_divInput {
				margin: 2px;
			}
			.scriptMenu_divInputText {
				margin: 2px;
				align-self: center;
				display: flex;
			}
			.scriptMenu_checkbox {
				position: absolute;
				z-index: -1;
				opacity: 0;
			}
			.scriptMenu_checkbox+label {
				display: inline-flex;
				align-items: center;
				user-select: none;
			}
			.scriptMenu_checkbox+label::before {
				content: '';
				display: inline-block;
				width: 20px;
				height: 20px;
				border: 1px solid #cf9250;
				border-radius: 7px;
				margin-right: 7px;
			}
			.scriptMenu_checkbox:checked+label::before {
				background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3e%3cpath fill='%2388cb13' d='M6.564.75l-3.59 3.612-1.538-1.55L0 4.26 2.974 7.25 8 2.193z'/%3e%3c/svg%3e");
			}
			.scriptMenu_close {
				width: 40px;
				height: 40px;
				position: absolute;
				right: -18px;
				top: -18px;
				border: 3px solid #c18550;
				border-radius: 20px;
				background: radial-gradient(circle, rgba(190,30,35,1) 0%, rgba(0,0,0,1) 100%);
				background-position-y: 3px;
				box-shadow: -1px 1px 3px black;
				cursor: pointer;
				box-sizing: border-box;
			}
			.scriptMenu_close:hover {
				filter: brightness(1.2);
			}
			.scriptMenu_crossClose {
				width: 100%;
				height: 100%;
				background-size: 65%;
				background-position: center;
				background-repeat: no-repeat;
				background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='%23f4cd73' d='M 0.826 12.559 C 0.431 12.963 3.346 15.374 3.74 14.97 C 4.215 15.173 8.167 10.457 7.804 10.302 C 7.893 10.376 11.454 14.64 11.525 14.372 C 12.134 15.042 15.118 12.086 14.638 11.689 C 14.416 11.21 10.263 7.477 10.402 7.832 C 10.358 7.815 11.731 7.101 14.872 3.114 C 14.698 2.145 13.024 1.074 12.093 1.019 C 11.438 0.861 8.014 5.259 8.035 5.531 C 7.86 5.082 3.61 1.186 3.522 1.59 C 2.973 1.027 0.916 4.611 1.17 4.873 C 0.728 4.914 5.088 7.961 5.61 7.995 C 5.225 7.532 0.622 12.315 0.826 12.559 Z'/%3e%3c/svg%3e")
			}
			.scriptMenu_button {
				user-select: none;
				cursor: pointer;
				padding: 5px 14px 8px;
			}
			.scriptMenu_button:hover {
				filter: brightness(1.2);
			}
			.scriptMenu_buttonText {
				color: #fce5b7;
				text-shadow: 0px 1px 2px black;
				text-align: center;
			}
			.scriptMenu_header {
				text-align: center;
				align-self: center;
				font-size: 15px;
				margin: 0px 15px;
			}
			.scriptMenu_header a {
				color: #fce5b7;
				text-decoration: none;
			}
			.scriptMenu_InputText {
				text-align: center;
				width: 130px;
				height: 24px;
				border: 1px solid #cf9250;
				border-radius: 9px;
				background: transparent;
				color: #fce1ac;
				padding: 0px 10px;
				box-sizing: border-box;
			}
			.scriptMenu_InputText:focus {
				filter: brightness(1.2);
				outline: 0;
			}
			.scriptMenu_InputText::placeholder {
				color: #fce1ac75;
			}
			.scriptMenu_Summary {
				cursor: pointer;
				margin-left: 7px;
			}
			.scriptMenu_Details {
				align-self: center;
			}
			.scriptMenu_buttonGroup {
				display: flex;
				justify-content: center;
				user-select: none;
				cursor: pointer;
				padding: 0;
				margin: 3px 0;
			}
			.scriptMenu_buttonGroup .scriptMenu_button {
				width: 100%;
				padding: 5px 8px 8px;
			}
			.scriptMenu_mainButton {
				border-radius: 5px;
				margin: 3px 0;
			}
			.scriptMenu_beigeButton {
				border: 1px solid #442901;
				background: radial-gradient(circle, rgba(165,120,56,1) 80%, rgba(0,0,0,1) 110%);
				box-shadow: inset 0px 2px 4px #e9b282, inset 0px -4px 6px #442901, inset 0px 1px 6px #442901, inset 0px 0px 6px, 0px 0px 2px black, 0px 0px 0px 1px #ce9767;
			}
			.scriptMenu_beigeButton:active {
				box-shadow: inset 0px 4px 6px #442901, inset 0px 4px 6px #442901, inset 0px 0px 6px, 0px 0px 4px, 0px 0px 0px 1px #ce9767;
			}
			.scriptMenu_greenButton {
				border: 1px solid #1a2f04;
				background: radial-gradient(circle, #47a41b 0%, #1a2f04 150%);
				box-shadow: inset 0px 2px 4px #83ce26, inset 0px -4px 6px #1a2f04, 0px 0px 2px black, 0px 0px 0px 1px #ce9767;
			}
			.scriptMenu_greenButton:active {
				box-shadow: inset 0px 4px 6px #1a2f04, inset 0px 4px 6px #1a2f04, inset 0px 0px 6px, 0px 0px 4px, 0px 0px 0px 1px #ce9767;
			}
			.scriptMenu_redButton {
				border: 1px solid #440101;
				background: radial-gradient(circle, rgb(198, 34, 34) 80%, rgb(0, 0, 0) 110%);
				box-shadow: inset 0px 2px 4px #e98282, inset 0px -4px 6px #440101, inset 0px 1px 6px #440101, inset 0px 0px 6px, 0px 0px 2px black, 0px 0px 0px 1px #ce9767;
			}
			.scriptMenu_redButton:active {
				box-shadow: inset 0px 4px 6px #440101, inset 0px 4px 6px #440101, inset 0px 0px 6px, 0px 0px 4px, 0px 0px 0px 1px #ce9767;
			}
			.scriptMenu_attention {
				position: relative;
			}
			.scriptMenu_attention .scriptMenu_dot {
				display: flex;
				justify-content: center;
				align-items: center;
			}

			.scriptMenu_dot {
				position: absolute;
				top: -7px;
				right: -7px;
				width: 20px;
				height: 20px;
				border-radius: 50%;
				border: 1px solid #c18550;
				background: radial-gradient(circle, #f000 25%, black 100%);
				box-shadow: 0px 0px 2px black;
				background-position: 0px -1px;
				font-size: 10px;
				text-align: center;
				color: white;
				text-shadow: 1px 1px 1px black;
				box-sizing: border-box;
				display: none;
			}

			/* Общие стили */
	.scriptMenu_btnSocket {
	position: relative;
	display: inline-flex;
	padding: 4px 4px 4px 3px;
	align-items: flex-start;
	border-radius: 9px;
	background: #a37738;
	box-shadow: 0px -1px 1px 0px #7d5b3a inset, 0px 1px 1px 0px #e1a960 inset,
	-1px 0px 1px 0px #311d13 inset;
	}

	.scriptMenu_btnGap {
	position: relative;
	display: flex;
	padding: 0px 2px 4px 3px;
	flex-direction: column;
	align-items: flex-start;
	gap: 2px;
	border-radius: 5px;
	cursor: pointer;
	flex: auto;
	}

	.scriptMenu_btnSocket a {
	position: relative;
	flex: auto;
	text-decoration: none !important;
	}

	.scriptMenu_btnPlate {
	display: flex;
	height: 13px;
	padding: 12px 10px;
	justify-content: center;
	align-items: center;
	gap: 10px;
	border-radius: 4px;
	filter: blur(0.2px);
	transition: all 0.1s ease;
	text-shadow: 0px 1px 0px rgba(0, 0, 0, 0.92);
	font-family: Arial;
	font-size: 14px;
	font-style: normal;
	font-weight: 700;
	line-height: normal;
	box-sizing: content-box;
	}

	.scriptMenu_btnGap:active {
	padding: 1px 2px 3px 3px;
	}

	.scriptMenu_btnGap.left {
	padding-right: 1px;
	}
	.scriptMenu_btnGap.center {
	padding-right: 1px;
	padding-left: 1px;
	}
	.scriptMenu_btnGap.right {
	padding-left: 1px;
	}

	/* Brown */
	.scriptMenu_btnGap.brown {
	background: #301a02;
	box-shadow: 0px 0px 2px 0px #231301, 0px -1px 2px 0px #231301,
	0px 1px 1px 0px #371e03;
	}

	.scriptMenu_btnPlate.brown {
	color: hsla(40, 92%, 85%, 1);
	background: hsla(35, 49%, 44%, 1);
	box-shadow: 0px 10px 12px 0px rgba(229, 184, 116, 0.2) inset,
	0px 2px 1px 0px #e4b773 inset, -8px 3px 15px 0px #4e2f01 inset,
	8px -7px 15px 0px rgba(78, 47, 1, 0.7) inset, 0px 0px 2px 0px #644113,
	0px -3px 8px 0px #422501 inset;
	}

	.scriptMenu_btnPlate.brown:hover {
	color: hsla(40, 96%, 96%, 1);
	background: hsla(35, 49%, 55%, 1);
	}

	.scriptMenu_btnGap.brown:active {
	background: #301a02;
	box-shadow: 0px 0px 2px 0px #231301, 0px -1px 2px 0px #231301,
	0px 1px 1px 0px #371e03;
	}

	.scriptMenu_btnPlate.brown:active {
	color: hsla(40, 47%, 71%, 1);
	background: #815e2c;
	}

	/* Green */
	.scriptMenu_btnGap.green {
	background: #192901;
	box-shadow: 0px 0px 2px 0px #231301, 0px -1px 2px 0px #231301,
	0px 1px 1px 0px #371e03;
	}

	.scriptMenu_btnPlate.green {
	color: hsla(69, 100%, 70%, 1);
	border-radius: 4px;
	background: #4ec71a;
	box-shadow: 0px 10px 12px 0px rgba(212, 229, 116, 0.2) inset,
	0px 2px 1px 0px #95e473 inset, -8px 3px 15px 0px #184e01 inset,
	8px -7px 15px 0px rgba(24, 78, 1, 0.7) inset, 0px 0px 2px 0px #2b6413,
	0px -3px 8px 0px #154201 inset;
	}

	.scriptMenu_btnPlate.green:hover {
	color: hsla(40, 96%, 96%, 1);
	background: hsla(102, 70%, 55%, 1);
	}

	.scriptMenu_btnGap.green:active {
	background: #192901;
	box-shadow: 0px 0px 2px 0px #231301, 0px -1px 2px 0px #231301,
	0px 1px 1px 0px #371e03;
	}

	.scriptMenu_btnPlate.green:active {
	color: hsla(80, 47%, 71%, 1);
	background: #46812c;
	}

	/* Blue */
	.scriptMenu_btnGap.blue {
	background: #032037;
	box-shadow: 0px 0px 2px 0px #231301, 0px -1px 2px 0px #231301,
	0px 1px 1px 0px #371e03;
	}

	.scriptMenu_btnPlate.blue {
	color: hsla(177, 79%, 91%, 1);
	background: hsla(207, 73%, 54%, 1);
	box-shadow: 0px 10px 12px 0px rgba(116, 178, 229, 0.2) inset,
	0px 2px 1px 0px #73b1e4 inset, -8px 3px 15px 0px rgba(1, 43, 78, 0.7) inset,
	8px -7px 15px 0px rgba(1, 43, 78, 0.7) inset,
	0px 0px 2px 0px rgba(19, 64, 100, 0.3),
	0px -3px 8px 0px rgba(1, 37, 66, 0.3) inset;
	}

	.scriptMenu_btnPlate.blue:hover {
	color: hsla(207, 96%, 96%, 1);
	background: hsla(207, 100%, 62%, 1);
	}

	.scriptMenu_btnGap.blue:active {
	background: #032037;
	box-shadow: 0px 0px 2px 0px #231301, 0px -1px 2px 0px #231301,
	0px 1px 1px 0px #371e03;
	}

	.scriptMenu_btnPlate.blue:active {
	color: hsla(207, 47%, 71%, 1);
	background: #2c5b81;
	}

	.scriptMenu_miniSocket {
	position: absolute;
	right: -5px;
	top: -5px;
	pointer-events: none !important;
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 2px;
	flex-direction: column;
	border-radius: 50%;
	background: #a37738;
	box-shadow: 0px -0.4px 0.4px 0px #7d5b3a inset,
	0px 0.4px 0.4px 0px #e1a960 inset, -0.4px 0px 0.4px 0px #311d13 inset;
	z-index: 50;
	}

	.scriptMenu_miniGap {
	display: flex;
	justify-content: center;
	align-items: center;
	border-radius: 50%;
	background: #371e03;
	box-shadow: 0px 0px 1px 0px #231301, 0px -1px 0.851px 0px #231301,
	0px 1px 1px 0px #371e03;
	width: 100%;
	height: 100%;
	}

	.scriptMenu_indicator {
	display: flex;
	justify-content: center;
	align-items: center;
	aspect-ratio: 1;
	width: 100%;
	max-width: 40px;
	padding: 2px 6px;
	border-radius: 50%;
	background: #ff2020;
	box-shadow: 2px 4px 5px 0px rgba(229, 116, 116, 0.2) inset,
	0px 2px 4px 0px rgba(255, 255, 255, 0.3) inset,
	-3px 1px 6px 0px #4e0101 inset, 3px -2px 6px 0px #4e0101 inset,
	0px 0px 1px 0px #641313, 0px -1px 3px 0px #420101 inset;
	color: #fbeeda;
	text-shadow: 0px 0px 5px rgba(0, 0, 0, 0.9), 0px 1px 0px rgba(0, 0, 0, 0.92);
	font-family: Arial, sans-serif;
	font-size: 12px;
	font-weight: 700;
	line-height: normal;
	}

	.scriptMenu_btnSocket {
	display: flex;
	padding: 4px 4px 4px 3px;
	flex-direction: column;
	align-items: flex-start;
	}

	.scriptMenu_btnSocket .scriptMenu_btnRow {
	display: flex;
	justify-content: space-between;
	align-items: center;
	align-self: stretch;
	width: 100%;
	}

	.scriptMenu_btnSocket .scriptMenu_btnGap .scriptMenu_btnPlate {
	display: flex;
	justify-content: center;
	align-items: center;
	align-self: stretch;
	flex: auto;
	}
		`;
			document.head.appendChild(style);
		}

		addBlocks() {
			const main = document.createElement('div');
			document.body.appendChild(main);

			this.status = document.createElement('div');
			this.status.classList.add('scriptMenu_status');
			this.setStatus('');
			main.appendChild(this.status);

			const label = document.createElement('label');
			label.classList.add('scriptMenu_label');
			label.setAttribute('for', 'checkbox_showMenu');
			main.appendChild(label);

			const arrowLabel = document.createElement('div');
			arrowLabel.classList.add('scriptMenu_arrowLabel');
			label.appendChild(arrowLabel);

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.id = 'checkbox_showMenu';
			checkbox.checked = this.option.showMenu;
			checkbox.classList.add('scriptMenu_showMenu');
			checkbox.addEventListener('change', () => {
				this.option.showMenu = checkbox.checked;
				this.saveSaveOption();
			});
			main.appendChild(checkbox);

			const mainMenu = document.createElement('div');
			mainMenu.classList.add('scriptMenu_main');
			main.appendChild(mainMenu);

			this.mainMenu = document.createElement('div');
			this.mainMenu.classList.add('scriptMenu_conteiner');
			mainMenu.appendChild(this.mainMenu);

			const closeButton = document.createElement('label');
			closeButton.classList.add('scriptMenu_close');
			closeButton.setAttribute('for', 'checkbox_showMenu');
			this.mainMenu.appendChild(closeButton);

			const crossClose = document.createElement('div');
			crossClose.classList.add('scriptMenu_crossClose');
			closeButton.appendChild(crossClose);
		}

		getButtonColor(color) {
			const buttonColors = {
				green: 'green',
				red: 'blue',
				beige: 'brown',
				blue: 'blue',
			};
			return buttonColors[color] || buttonColors['beige'];
		}

		setStatus(text, onclick) {
			if (this._currentStatusClickHandler) {
				this.status.removeEventListener('click', this._currentStatusClickHandler);
				this._currentStatusClickHandler = null;
			}

			if (!text) {
				this.status.classList.add('scriptMenu_statusHide');
				this.status.innerHTML = '';
			} else {
				this.status.classList.remove('scriptMenu_statusHide');
				this.status.innerHTML = text;
			}

			if (typeof onclick === 'function') {
				this.status.addEventListener('click', onclick, { once: true });
				this._currentStatusClickHandler = onclick;
			}
		}

		addStatus(text) {
			if (!this.status.innerHTML) {
				this.status.classList.remove('scriptMenu_statusHide');
			}
			this.status.innerHTML += text;
		}

		addHeader(text, onClick, main = this.mainMenu) {
			// 1. Notifica a tutto il sistema che un'intestazione sta per essere aggiunta.
			// QUESTA È LA RIGA FONDAMENTALE CHE MANCAVA.
			this.emit('beforeAddHeader', text, onClick, main);

			// 2. Resetta lo stato dei pulsanti, se necessario.
			if (this.btnSocket) {
				this.btnSocket = null;
			}

			// 3. Crea l'elemento 'div' come previsto dagli stili.
			const header = document.createElement('div');

			// 4. Applica la classe CSS corretta (con la 'h' minuscola).
			header.classList.add('scriptMenu_header');

			// 5. Usa innerHTML per permettere l'inserimento di codice HTML nel titolo.
			header.innerHTML = text;

			// 6. Se è stata fornita una funzione 'onClick', la rende cliccabile.
			if (typeof onClick === 'function') {
				header.addEventListener('click', onClick);
			}

			// 7. Aggiunge l'intestazione al contenitore principale.
			main.appendChild(header);

			// 8. Notifica a tutto il sistema che l'intestazione è stata aggiunta con successo.
			this.emit('afterAddHeader', text, onClick, main);

			return header;
		}
		addBtnSocket(back) {
			this.btnSocket = document.createElement('div');
			this.btnSocket.classList.add('scriptMenu_btnSocket');
			(back ?? this.mainMenu).appendChild(this.btnSocket);
			return this.btnSocket;
		}

		addButton(btn, main = this.btnSocket) {
			this.emit('beforeAddButton', btn, main);
			//debugger;
			let back = null;
			if (!this.btnSocket) {
				back = main;
				main = this.addBtnSocket(back);
				this.btnSocket = main;
			}
			let isOneButton = false;

			if (!main.classList.contains('scriptMenu_btnRow')) {
				main = document.createElement('div');
				main.classList.add('scriptMenu_btnRow');
				isOneButton = true;
			}

			const { name, onClick, title, color, dot, classes = [], isCombine } = btn;
			const button = document.createElement('div');
			button.classList.add('scriptMenu_btnGap', this.getButtonColor(color), ...classes);
			button.title = title;
			button.addEventListener('click', onClick);
			main.appendChild(button);

			const buttonText = document.createElement('div');
			buttonText.classList.add('scriptMenu_btnPlate', this.getButtonColor(color));
			buttonText.innerText = name;
			button.appendChild(buttonText);

			if (dot) {
				this.addIndicator(button, dot);
			}

			if (isOneButton) {
				this.btnSocket.appendChild(main);
				//this.btnSocket.appendChild(main);
			}

			this.buttons.push(button);

			this.emit('afterAddButton', button, btn);
			return button;
		}

		addCombinedButton(buttonList, main = this.btnSocket) {
			this.emit('beforeAddCombinedButton', buttonList, main);
			let back = null;
			if (!this.btnSocket) {
				back = main;
				main = this.addBtnSocket(back);
				this.btnSocket = main;
			}
			const buttonGroup = document.createElement('div');
			buttonGroup.classList.add('scriptMenu_btnRow');
			let count = 0;

			for (const btn of buttonList) {
				btn.isCombine = true;
				btn.classes ??= [];
				if (count === 0) {
					btn.classes.push('left');
				} else if (count === buttonList.length - 1) {
					btn.classes.push('right');
				} else {
					btn.classes.push('center');
				}
				this.addButton(btn, buttonGroup);
				count++;
			}

			this.addIndicator(buttonGroup);

			this.btnSocket.appendChild(buttonGroup);
			this.emit('afterAddCombinedButton', buttonGroup, buttonList);
			return buttonGroup;
		}

		addIndicator(btnSocket, title) {
			const dotAtention = document.createElement('div');
			dotAtention.classList.add('scriptMenu_dot');
			dotAtention.title = title;
			btnSocket.appendChild(dotAtention);
			/*
		const miniSocket = document.createElement('div');
		miniSocket.classList.add('scriptMenu_miniSocket');

		const miniGap = document.createElement('div');
		miniGap.classList.add('scriptMenu_miniGap');
		miniSocket.appendChild(miniGap);

		const indicator = document.createElement('div');
		indicator.classList.add('scriptMenu_indicator', 'scriptMenu_dot');
		indicator.title = title;
		indicator.innerHTML = '22';
		miniGap.appendChild(indicator);

		btnSocket.appendChild(miniSocket);
		*/
		}

		addCheckbox(label, title, main = this.mainMenu) {
			this.emit('beforeAddCheckbox', label, title, main);
			if (this.btnSocket) {
				this.btnSocket = null;
			}
			const divCheckbox = document.createElement('div');
			divCheckbox.classList.add('scriptMenu_divInput');
			divCheckbox.title = title;
			main.appendChild(divCheckbox);

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.id = 'scriptMenuCheckbox' + this.checkboxes.length;
			checkbox.classList.add('scriptMenu_checkbox');
			divCheckbox.appendChild(checkbox);

			const checkboxLabel = document.createElement('label');
			checkboxLabel.innerText = label;
			checkboxLabel.setAttribute('for', checkbox.id);
			divCheckbox.appendChild(checkboxLabel);

			this.checkboxes.push(checkbox);
			this.emit('afterAddCheckbox', label, title, main);
			return checkbox;
		}

		addInputText(title, placeholder, main = this.mainMenu) {
			this.emit('beforeAddCheckbox', title, placeholder, main);
			if (this.btnSocket) {
				this.btnSocket = null;
			}
			const divInputText = document.createElement('div');
			divInputText.classList.add('scriptMenu_divInputText');
			divInputText.title = title;
			main.appendChild(divInputText);

			const newInputText = document.createElement('input');
			newInputText.type = 'text';
			if (placeholder) {
				newInputText.placeholder = placeholder;
			}
			newInputText.classList.add('scriptMenu_InputText');
			divInputText.appendChild(newInputText);
			this.emit('afterAddCheckbox', title, placeholder, main);
			return newInputText;
		}

		addDetails(summaryText, name = null) {
			this.emit('beforeAddDetails', summaryText, name);
			if (this.btnSocket) {
				this.btnSocket = null;
			}
			const details = document.createElement('details');
			details.classList.add('scriptMenu_Details');
			this.mainMenu.appendChild(details);

			const summary = document.createElement('summary');
			summary.classList.add('scriptMenu_Summary');
			summary.innerText = summaryText;
			if (name) {
				details.open = this.option.showDetails[name] ?? false;
				details.dataset.name = name;
				details.addEventListener('toggle', () => {
					this.option.showDetails[details.dataset.name] = details.open;
					this.saveSaveOption();
				});
			}

			details.appendChild(summary);
			this.emit('afterAddDetails', summaryText, name);
			return details;
		}

		saveSaveOption() {
			try {
				localStorage.setItem('scriptMenu_saveOption', JSON.stringify(this.option));
			} catch (e) {
				console.log('¯\\_(ツ)_/¯');
			}
		}

		loadSaveOption() {
			let saveOption = null;
			try {
				saveOption = localStorage.getItem('scriptMenu_saveOption');
			} catch (e) {
				console.log('¯\\_(ツ)_/¯');
			}

			if (!saveOption) {
				return {};
			}

			try {
				saveOption = JSON.parse(saveOption);
			} catch (e) {
				return {};
			}

			return saveOption;
		}
	}

	this.HWHClasses.ScriptMenu = NewScriptMenu;
})();


