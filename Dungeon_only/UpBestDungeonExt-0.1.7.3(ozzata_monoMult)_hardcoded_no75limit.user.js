// ==UserScript==
// @name			UpBestDungeonExt
// @name:en			UpBestDungeonExt
// @name:ru			UpBestDungeonExt
// @namespace		UpBestDungeonExt
// @version			0.1.8 (auto_profile_HC_no75)
// @description		Extension for HeroWarsHelper script
// @description:en	Extension for HeroWarsHelper script
// @description:ru	Расширение для скрипта HeroWarsHelper
// @author			ZingerY (Mod by HWH Architect)
// @license 		Copyright ZingerY
// @homepage		https://zzzingery.ru/scripts/HWHBestDungeonExt_ec4d1eb36b22d19728e9d1d23ca84d1c.user.js
// @downloadURL		https://zzzingery.ru/scripts/HWHBestDungeonExt_ec4d1eb36b22d19728e9d1d23ca84d1c.user.js
// @updateURL		https://zzzingery.ru/scripts/HWHBestDungeonExt_ec4d1eb36b22d19728e9d1d23ca84d1c.user.js
// @icon			https://zingery.ru/scripts/VaultBoyIco16.ico
// @icon64			https://zingery.ru/scripts/VaultBoyIco64.png
// @match			https://www.hero-wars.com/*
// @match			https://apps-1701433570146040.apps.fbsbx.com/*
// @run-at			document-start
// ==/UserScript==

(function () {
	// --- LIFECYCLE LOADER ---
	const loader = setInterval(() => {
		if (typeof unsafeWindow.HWHClasses !== 'undefined' && typeof unsafeWindow.HWHData !== 'undefined') {
			clearInterval(loader);
			setTimeout(init, 1000);
		}
	}, 500);

	function init() {
		if (!unsafeWindow.HWHClasses) {
			console.log('%cObject for extension not found', 'color: red');
			return;
		}

		console.log('%cStart Extension ' + GM_info.script.name + ', v' + GM_info.script.version + ' by ' + GM_info.script.author, 'color: red');
		const { addExtentionName } = unsafeWindow.HWHFuncs;
		addExtentionName(GM_info.script.name, GM_info.script.version, GM_info.script.author);

		const { getInput, setProgress, hideProgress, I18N, countdownTimer, getSaveVal, setSaveVal, popup, random } = unsafeWindow.HWHFuncs;
		const { DungeonFixBattle } = unsafeWindow.HWHClasses;

		// --- CLASS OVERRIDES ---

		class UpdateDungeonFixBattle extends DungeonFixBattle {
			getTimer() {
				if (this.count === 1) {
					this.isGetTimer = false;
					this.maxTimer = this.customMaxTimer || 90;
					return this.customFixCoeff || 168.8;
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

		unsafeWindow.HWHClasses.DungeonFixBattle = UpdateDungeonFixBattle;

		// --- I18N DATA ---
		const { i18nLangData } = unsafeWindow.HWHData;

		i18nLangData['en'] = Object.assign(i18nLangData['en'], {
			BEST_DUNGEON_FEEDBACK: 'Feedback',
			BEST_DUNGEON_FEEDBACK_TITLE: 'Go to Telegram group for feedback on the HWHBestDungeonExt script',
			BEST_DUNGEON_FEEDBACK_URL: 'https://t.me/+RHdutKsQQcFlODMy',
			BEST_DUNGEON_WINNING_FIGHT_NOT_FOUND: 'No winning fight found\n',
			BEST_DUNGEON_BEST_COMBINATION: 'Best combination:',
			BEST_DUNGEON_SET_USE_TITANS: 'Titans used in the dungeon:',
			BEST_DUNGEON_DUNGEON_SETTINGS_TITLE: 'Dungeon run Settings',
			BEST_DUNGEON_PER_HOUR: 'per hour',
			DUNGEON: 'Dgn',
		});

		i18nLangData['ru'] = Object.assign(i18nLangData['ru'], {
			BEST_DUNGEON_FEEDBACK: 'Обратная связь',
			BEST_DUNGEON_FEEDBACK_TITLE: 'Перейти в Telegram группу для обратной связи по скрипту HWHBestDungeonExt',
			BEST_DUNGEON_FEEDBACK_URL: 'https://t.me/+1RpKpBDs9OAyZDdi',
			BEST_DUNGEON_WINNING_FIGHT_NOT_FOUND: 'Не найден победный бой\n',
			BEST_DUNGEON_BEST_COMBINATION: 'Лучшее сочетание:',
			BEST_DUNGEON_SET_USE_TITANS: 'Титаны используемые в подземке:',
			BEST_DUNGEON_DUNGEON_SETTINGS_TITLE: 'Настройки для прохождения подздемелья',
			BEST_DUNGEON_PER_HOUR: 'в час',
			DUNGEON: 'Подземка',
		});

		const { buttons } = unsafeWindow.HWHData;

		buttons['HWHBestDungeonExt'] = {
			get name() { return I18N('BEST_DUNGEON_FEEDBACK'); },
			get title() { return I18N('BEST_DUNGEON_FEEDBACK_TITLE'); },
			color: 'blue',
			onClick: () => {
				window.open(I18N('BEST_DUNGEON_FEEDBACK_URL'), '_blank');
			},
		};

		// --- PROFILE MANAGER: REMOVED (Hardcoded mode - no IndexedDB/GUI) ---

		// =====================================================================
		// [AI-CONFIG] DEFAULT VALUES - Modify these to change script defaults
		// =====================================================================
		// buffStop100: Stop dungeon when healing penalty > 95% (default: false)
		// buffStop75:  Stop dungeon when healing penalty > 70% (default: false)
		// When either is true AND buff is unknown, start from profile 3 (not 4)
		// =====================================================================
		const DEFAULT_BUFF_STOP = {
			buffStop100: false,
			buffStop75: false
		};

		// --- AUTO PROFILE SYSTEM ---
		const AUTO_PROFILES = {
			1: {
				algo: { countTest: 3, populationSize: 10, generations: 10, mutationRate: 0.1, eliteCount: 1 },
				threshold: { simSamples: 5, simRank: 3 },
				weights: { hp: 40, energy: 1 },
				logic: { scoringMethod: 'weighted', zeroDeaths: true, antiOneshot: false, deepGA: false },
				tech: { timeoutFix: 5000, countFix: 8, monoMultiplier: 1, maxTitanPower: 30000, minTitanPower: 5000, maxTimer: 15, fixCoeff: 58.8 },
				titans: [4000,4001,4003,4010,4011,4013,4014,4020,4022,4023,4024],
				forceWaterInNeutral: true
			},
			2: {
				algo: { countTest: 5, populationSize: 11, generations: 20, mutationRate: 0.1, eliteCount: 2 },
				threshold: { simSamples: 10, simRank: 7 },
				weights: { hp: 50, energy: 1 },
				logic: { scoringMethod: 'weighted', zeroDeaths: true, antiOneshot: false, deepGA: false },
				tech: { timeoutFix: 10000, countFix: 40, monoMultiplier: 3, maxTitanPower: 30000, minTitanPower: 5000, maxTimer: 60, fixCoeff: 98.8 },
				titans: [4000,4001,4003,4004,4010,4011,4013,4014,4020,4021,4022,4023,4024,4032,4042],
				forceWaterInNeutral: true
			},
			3: {
				algo: { countTest: 10, populationSize: 14, generations: 30, mutationRate: 0.09, eliteCount: 3 },
				threshold: { simSamples: 40, simRank: 36 },
				weights: { hp: 70, energy: 1 },
				logic: { scoringMethod: 'strict', zeroDeaths: true, antiOneshot: false, deepGA: false },
				tech: { timeoutFix: 20000, countFix: 90, monoMultiplier: 2, maxTitanPower: 30000, minTitanPower: 5000, maxTimer: 80, fixCoeff: 128.8 },
				titans: [4000,4001,4002,4003,4004,4010,4011,4012,4013,4014,4020,4021,4022,4023,4024,4030,4031,4032,4033,4040,4041,4042,4043],
				forceWaterInNeutral: false
			},
			4: {
				algo: { countTest: 20, populationSize: 21, generations: 100, mutationRate: 0.09, eliteCount: 4 },
				threshold: { simSamples: 100, simRank: 98 },
				weights: { hp: 130, energy: 1 },
				logic: { scoringMethod: 'strict', zeroDeaths: true, antiOneshot: false, deepGA: true },
				tech: { timeoutFix: 60000, countFix: 200, monoMultiplier: 4, maxTitanPower: 30000, minTitanPower: 5000, maxTimer: 100, fixCoeff: 168.8 },
				titans: [4001,4002,4003,4004,4010,4011,4012,4013,4014,4020,4021,4022,4023,4024,4030,4031,4032,4033,4040,4041,4042,4043],
				forceWaterInNeutral: false
			}
		};

		const HEALTH_THRESHOLDS = {
			1: { elemental: 0.70, mixed: 0.75 },
			2: { elemental: 0.75, mixed: 0.80 },
			3: { elemental: 0.85, mixed: 0.90, fallback: 0.60 },
			4: null
		};

		function selectProfileByBuff(buffHealing, buffStopActive = false) {
			if (buffHealing === null || buffHealing === undefined) {
				return buffStopActive ? 3 : 4;
			}
			const absBuff = Math.abs(buffHealing);
			if (absBuff >= 80) return 4;
			if (absBuff < 30) return 1;
			if (absBuff < 60) return 2;
			return 3;
		}

		function getProfileData(profileNum) {
			return AUTO_PROFILES[profileNum] || null;
		}

		function applyProfileData(profile) {
			const DU = DungeonUtils;
			if (!DU.bestParams) {
				DU.bestParams = { populationSize: 9, generations: 30, mutationRate: 0.06, eliteCount: 2 };
			}
			DU.countTest = profile.algo.countTest;
			DU.bestParams.populationSize = profile.algo.populationSize;
			DU.bestParams.generations = profile.algo.generations;
			DU.bestParams.mutationRate = profile.algo.mutationRate;
			DU.bestParams.eliteCount = profile.algo.eliteCount;
			DU.hpWeight = profile.weights.hp;
			DU.energyWeight = profile.weights.energy;
			DU.logicConfig = { ...profile.logic };
			DU.allowedTitanIds = profile.titans;
			console.log(`%c[Hardcoded] Profile ${profile.id || '?'} Applied: timeout=${profile.tech.timeoutFix}ms, countFix=${profile.tech.countFix}, monoMult=${profile.tech.monoMultiplier}, hpWeight=${profile.weights.hp}, deepGA=${profile.logic.deepGA}`, 'color: #0ff; font-weight: bold;');
		}

		async function applyAutoProfile(profileNum) {
			const profile = await getProfileData(profileNum);
			if (!profile) return null;
			applyProfileData(profile);
			return profile;
		}

		// --- MAIN BUTTON LOGIC: REMOVED (Hardcoded mode - no GUI) ---

		// --- LOGIC CLASSES ---

		class Stat {
			constructor(stats) { Object.assign(this, stats || {}); }
			multiply(multiplier) { for (const key in this) { if (this.hasOwnProperty(key)) { this[key] *= multiplier; } } }
			add(obj) { for (const key in obj) { if (obj.hasOwnProperty(key)) { if (this.hasOwnProperty(key)) { this[key] += obj[key]; } else { this[key] = obj[key]; } } } }
			round() { for (const key in this) { if (this.hasOwnProperty(key)) { this[key] = Math.round(this[key] * 100) / 100; } } }
		}

		class TitanStats {
			constructor(titans, spirits, states) {
				this.titans = titans; this.spirits = spirits; this.states = states;
				this.heroLib = unsafeWindow.lib.data.hero; this.titanLib = unsafeWindow.lib.data.titan;
				this.artsLib = unsafeWindow.lib.data.titanArtifact; this.skinsLib = unsafeWindow.lib.data.skin;
				this.ruleLib = unsafeWindow.lib.data.rule; this.spiritSkills = unsafeWindow.lib.data.titanSpirit.skills;
				this.baseStats = new Stat({});
			}
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
			addSkinStats() {
				const titan = this.titans[this.titanId];
				const skins = Object.entries(titan.skins);
				for (const [id, lvl] of skins) {
					const bonus = this.skinsLib[id].statData.levels[lvl].statBonus;
					this.baseStats.add(bonus);
				}
			}
			addArtifactStats() {
				const titan = this.titans[this.titanId];
				const titanLibArt = this.titanLib[this.titanId].artifacts;
				for (const index in titanLibArt) {
					const artId = titanLibArt[index];
					const { level, star } = titan.artifacts[index];
					if (!star) continue;
					const libArt = this.artsLib.id[artId];
					const battleEffects = libArt.battleEffect;
					const artStat = new Stat({});
					for (const effectId of battleEffects) {
						const effect = this.artsLib.battleEffect[effectId];
						const stat = effect.effect;
						artStat.add({ [stat]: effect.levels[level] });
					}
					const multiplier = this.artsLib.type[libArt.type].evolution[star].battleEffectMultiplier;
					artStat.multiply(multiplier);
					artStat.round();
					this.baseStats.add(artStat);
				}
			}
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
						spiritStat.add({ [stat]: effect.levels[spirit.level] });
					}
					spiritMultiplier = this.artsLib.type['spirit'].evolution[spirit.star].battleEffectMultiplier;
					spiritStat.multiply(spiritMultiplier);
				}
				const elementSpiritSkills = [];
				const skills = [];
				if (spirit.primalSkill) skills.push(...Object.entries(spirit.primalSkill));
				if (spirit.elementalSkill) skills.push(...Object.entries(spirit.elementalSkill));
				for (const [id, level] of skills) {
					const skillId = +id;
					const tierScale = this.spiritSkills[skillId].levelScale[level - 1];
					elementSpiritSkills.push({ skillId, level, tierScale });
				}
				const addSpirit = {
					element, elementSpiritLevel: spirit.level, elementSpiritStar: spirit.star,
					elementSpiritSkills, elementAffinityPower: spirit.level * spiritMultiplier,
				};
				spiritStat.add(addSpirit);
				this.baseStats.add(spiritStat);
			}
			getTitanStats(titanId) {
				this.titanId = titanId;
				this.calculateBaseStats();
				this.addSkinStats();
				this.addArtifactStats();
				this.addTotemStats();
				const state = this.states[titanId] ?? { hp: Math.floor(this.baseStats.hp), energy: 0, isDead: false };
				return Object.assign(this.titans[this.titanId], this.baseStats, { state });
			}
			getAllowTitanIds(element = false, allowedIds = []) {
				return Object.values(this.titans)
					.map((e) => e.id)
					.filter((id) => !this.states[id]?.isDead && (!element || element == this.titanLib[id]?.element) && (!allowedIds.length || allowedIds.includes(id)));
			}
		}

		class GeneticAlgorithm {
			constructor({ values, combinationSize, populationSize, generations, mutationRate, eliteCount }) {
				this.values = values; this.combinationSize = combinationSize; this.populationSize = populationSize;
				this.generations = generations; this.mutationRate = mutationRate; this.eliteCount = eliteCount;
				this.evaluationCache = new Map(); this.evaluationCalls = 0; this.bestScores = [];
			}
			generateInitialPopulation() {
				const population = [];
				for (let i = 0; i < this.populationSize; i++) {
					const shuffledValues = [...this.values];
					for (let j = shuffledValues.length - 1; j > 0; j--) {
						const randomIndex = Math.floor(Math.random() * (j + 1));
						[shuffledValues[j], shuffledValues[randomIndex]] = [shuffledValues[randomIndex], shuffledValues[j]];
					}
					const combination = shuffledValues.slice(0, this.combinationSize).sort();
					population.push(combination);
				}
				return population;
			}
			crossover(parent1, parent2) {
				const crossoverPoint = Math.floor(Math.random() * parent1.length);
				const child1 = [...new Set([...parent1.slice(0, crossoverPoint), ...parent2])].slice(0, this.combinationSize);
				const child2 = [...new Set([...parent2.slice(0, crossoverPoint), ...parent1])].slice(0, this.combinationSize);
				return [child1.sort(), child2.sort()];
			}
			mutate(combination) {
				const dynamicRate = this.mutationRate * (1 - this.evaluationCalls / 300);
				const availableValues = this.values.filter((value) => !combination.includes(value));
				for (let i = 0; i < combination.length; i++) {
					if (Math.random() < dynamicRate && availableValues.length > 0) {
						const randomIndex = Math.floor(Math.random() * availableValues.length);
						combination[i] = availableValues[randomIndex];
						availableValues.splice(randomIndex, 1);
					}
				}
				return combination.sort();
			}
			async evaluateCombination(combination) {
				const key = combination.join(',');
				if (!this.evaluationCache.has(key)) {
					const value = await this.getEvaluate(combination);
					this.evaluationCache.set(key, value);
					this.evaluationCalls++;
				}
				return this.evaluationCache.get(key);
			}
			async getEvaluate(combination) { return combination.reduce((sum, value) => sum + value, 0); }
			customSort(a, b) { return b.v - a.v; }
			compareScore(bestScore, targetScore) { return bestScore >= targetScore; }
			setEvaluate(evaFunction) { this.getEvaluate = evaFunction; }
			setCustomSort(customSort) { this.customSort = customSort; }
			setCompereScore(compareScore) { this.compareScore = compareScore; }
			async sortPopulation(population) {
				const evaluatedValues = await Promise.all(population.map(async (item) => ({ item, v: await this.evaluateCombination(item) })));
				evaluatedValues.sort(this.customSort);
				return evaluatedValues.map(({ item }) => item);
			}
			async selectParent(population, tournamentSize = 3) {
				let best = population[Math.floor(Math.random() * population.length)];
				for (let i = 1; i < tournamentSize; i++) {
					const candidate = population[Math.floor(Math.random() * population.length)];
					if ((await this.evaluateCombination(candidate)) > (await this.evaluateCombination(best))) {
						best = candidate;
					}
				}
				return best;
			}
			async run() {
				let population = this.generateInitialPopulation();
				this.bestScores = [];
				for (let generation = 0; generation < this.generations; generation++) {
					population = await this.sortPopulation(population);
					const bestScore = await this.evaluateCombination(population[0]);
					this.bestScores.push(bestScore);
					const nextPopulation = population.slice(0, this.eliteCount);
					while (nextPopulation.length < this.populationSize) {
						const parent1 = await this.selectParent(population);
						const parent2 = await this.selectParent(population);
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
		}

		class BestDungeon {
			constructor(resolve, reject) {
				this.resolve = resolve;
				this.reject = reject;

				// --- HARDCODED DEFAULTS (Profile 4 values) ---
				this.timeoutFix = 60000;
				this.countFix = 200;
				this.monoMultiplier = 4;
				this.maxTitanPower = 30000;
				this.minTitanPower = 5000;
				this.maxTimer = 100;
				this.fixCoeff = 168.8;

				this.simSamples = 100;
				this.simRank = 98;

				DungeonUtils.hpWeight = 130;
				DungeonUtils.energyWeight = 1;
				DungeonUtils.logicConfig = {
					scoringMethod: 'strict',
					zeroDeaths: true,
					antiOneshot: false,
					deepGA: true
				};

				this.isFixedBattle = true;
				this.dungeonActivity = 0;
				this.maxDungeonActivity = 150;
				this.currentActivity = 0;
				this.primeElement = '';
				this.titanGetAll = {};
				this.teams = { earth: [], fire: [], neutral: [], water: [], hero: {} };
				this.titansStates = {};
				this.talentMsg = '';
				this.talentMsgReward = '';
				this.isShowFixLog = false;
				this.isStop = false;
				this.startTime = Date.now();
				this.colors = { water: 'color: #3498db;', fire: 'color: #e74c3c;', earth: 'color: #2ecc71;', light: 'color: #f1c40f;', dark: 'color: #9b59b6;', neutral: 'color: yellow;', green: 'color: #0b0;', none: 'color: none;', red: 'color: #d00;', };
				this.defPowers = { earth: 0, fire: 0, neutral: 0, water: 0, hero: 0, };
				this.maxPowers = { earth: 396125, fire: 396125, neutral: 670725, water: 396125, hero: 242750, };
			this.timers = [];
			this.buffHealing = null;
			this.currentAutoProfile = 4;
			this.forceWaterInNeutral = true;
			this.buffStop100 = DEFAULT_BUFF_STOP.buffStop100;
			this.buffStop75 = DEFAULT_BUFF_STOP.buffStop75;
		}

			async start() {
				let result = null;
				try {
					result = await unsafeWindow.Caller.send([
						'dungeonGetInfo', 'teamGetAll', 'teamGetFavor', 'clanGetInfo', 'titanGetAll', 'inventoryGet', 'titanSpirit_getAll',
					]);
				} catch (e) {
					this.endDungeon('Error', e);
				}

				if (!result) {
					return;
				}
				this.startDungeon(result);
			}

			stop() { this.isStop = true; }

			getActivityPerHour() {
				const elapsedMs = Date.now() - this.startTime;
				const elapsedHours = elapsedMs / 36e5;
				return Math.floor(elapsedHours > 0 ? this.currentActivity / elapsedHours : 0);
			}

			async executeWithRetry(request, maxRetries = 10) {
				for (let attempt = 1; attempt <= maxRetries; attempt++) {
					try {
						const result = await unsafeWindow.Caller.send(request);
						return result;
					} catch (error) {
						console.error(`Retry ${attempt} / ${maxRetries} error:`, error);
						const delayMs = Math.min(random(500, 1000) * Math.pow(2, attempt - 1), 10000);
						await new Promise((resolve) => setTimeout(resolve, delayMs));
					}
				}
				return false;
			}

			getStatMessage() {
				const activityPerHour = this.getActivityPerHour();
				const cards = unsafeWindow.HWHData.countPredictionCard;
				const cardsLine = cards > 0 ? `Cards: ${cards}<br>` : '';
				const powersLine = Object.entries(this.defPowers)
					.filter(([type, power]) => Math.floor((power / this.maxPowers[type]) * 100) <= 90)
					.map(([type, power]) => `${type}: ${power} ${Math.floor((power / this.maxPowers[type]) * 100)}%`)
					.join('<br>');
				return (
					`Dungeon: ${I18N('TITANIT')} ${this.dungeonActivity}/${this.maxDungeonActivity}
				${this.talentMsg}<br>
				${I18N('TITANIT')}: ${this.currentActivity}<br>
				${activityPerHour} ${I18N('BEST_DUNGEON_PER_HOUR')}<br>` +
				cardsLine +
				powersLine +
				'<br>' +
				(this.buffHealing !== null && this.buffHealing !== undefined ? 'Buff: ' + this.buffHealing + '%<br>' : '') +
				(this.currentAutoProfile ? 'Profile: P' + this.currentAutoProfile + '<br>' : '')
				);
			}

			startDungeon(data) {
				const [dungeonGetInfo, teamGetAll, teamGetFavor, clanGetInfo, titanGetAll, inventoryGet, titanSpirits] = data;
				if (!dungeonGetInfo) { this.endDungeon('noDungeon'); return; }
				this.dungeonGetInfo = dungeonGetInfo; this.teamGetAll = teamGetAll; this.teamGetFavor = teamGetFavor;
				this.dungeonActivity = clanGetInfo.stat.todayDungeonActivity; this.titanGetAll = titanGetAll;
				this.titans = Object.values(titanGetAll); unsafeWindow.HWHData.countPredictionCard = inventoryGet.consumable[81] || 0;
				this.titanSpirits = titanSpirits.spirits;
				this.stateUseTitanLocal = Object.fromEntries(Object.values(this.titans).map((e) => [e.id, 0]));
				this.stateUseTitanGlobal = getSaveVal('stateUseTitan', this.stateUseTitanLocal);
				this.teams.hero = { favor: teamGetFavor.dungeon_hero, heroes: teamGetAll.dungeon_hero.filter((id) => id < 6000), teamNum: 0 };
				const heroPet = teamGetAll.dungeon_hero.find((id) => id >= 6000);
				if (heroPet) this.teams.hero.pet = heroPet;
				['neutral', 'water', 'fire', 'earth'].forEach((type) => {
					this.teams[type] = { favor: {}, heroes: DungeonUtils.getTitanTeam(this.titans, type), teamNum: 0 };
				});
				this.checkFloor(dungeonGetInfo);
			}

			showTitanStates() {
				const titanGetAll = this.titanGetAll;
				const titans = this.titansStates;
				const colWhidth = 17;
				const columns = [
					{ element: 'water', color: '#3498db', icon: '🌊' }, { element: 'fire', color: '#e74c3c', icon: '🔥' },
					{ element: 'earth', color: '#2ecc71', icon: '🌍' }, { element: 'light', color: '#f1c40f', icon: '☀️' },
					{ element: 'dark', color: '#9b59b6', icon: '🌑' },
				];
				const titansData = columns.reduce(
					(acc, col) => ({
						...acc,
						[col.element]: Object.keys(titanGetAll)
							.filter((id) => unsafeWindow.lib.data.titan[id].element === col.element)
							.map((id) => {
								const HP = titans[id]?.hp ? Math.floor((titans[id]?.hp / titans[id]?.maxHp) * 100) : 100;
								return {
									id: id, name: unsafeWindow.cheats.translate(`LIB_HERO_NAME_${id}`),
									status: titans[id]?.isDead ? '💀' : `❤️${HP}⚡${titans[id]?.energy || 0}`,
									rawHp: titans[id]?.hp || 0, rawEnergy: titans[id]?.energy || 0
								};
							}),
					}), {}
				);
				const exportPayload = { raw: titans, view: titansData, timestamp: Date.now() };
				unsafeWindow.HWH_TitanStats = exportPayload;
				let finalPayload = {};
				if (typeof exportPayload !== 'undefined') { finalPayload = Object.assign({}, exportPayload); }
				finalPayload.dungeonBuff = this.buffHealing || 0;
				unsafeWindow.HWH_TitanStats = finalPayload;
				window.dispatchEvent(new CustomEvent('HWH_TitanStats_Update', { detail: finalPayload }));
				const maxRows = Math.max(...columns.map((col) => titansData[col.element].length));
				const emptyCell = ''.padEnd(colWhidth);
				const buildLine = (items) => items.map((content) => `%c${content}\t`).join('');
				const header = buildLine(columns.map((col) => `${col.icon} ${col.element.toUpperCase()}`.padEnd(colWhidth)));
				const rows = Array.from({ length: maxRows }, (_, i) =>
					buildLine(columns.map((col) => { const titan = titansData[col.element][i]; return titan ? `${titan.name}${titan.status}`.padEnd(colWhidth) : emptyCell; }))
				);
				console.log([header, ...rows].join('\n'), ...columns.map((col) => `font-weight: bold; color: ${col.color}`), ...rows.flatMap(() => columns.map((col) => `color: ${col.color}`)));
			}

			async checkFloor(dungeonInfo) {
				if (this.isStop) { this.endDungeon('endDungeon', I18N('STOPPED')); return; }
				if (!dungeonInfo.floor || dungeonInfo.floor.state === 2) { await this.saveProgress(); return; }
				const result = await this.checkTalent(dungeonInfo);
				if (!result) { this.endDungeon('ErrorReqests'); return; }
				this.maxDungeonActivity = +getInput('countTitanit');
				if (this.dungeonActivity >= this.maxDungeonActivity) { this.endDungeon('endDungeon', `maxActive ${this.dungeonActivity}/${this.maxDungeonActivity}`); return; }
				const message = this.getStatMessage();
				setProgress(message, false, this.stop.bind(this));
				this.titansStates = dungeonInfo.states.titans;
				this.showTitanStates();
				const floorChoices = dungeonInfo.floor.userData;
				const floorType = dungeonInfo.floorType;
				this.primeElement = dungeonInfo.elements.prime;
				if (floorType === 'battle') {
					const battles = await this.prepareBattles(floorChoices);
					if (!battles) { this.endDungeon('ErrorReqests'); return; }
					if (battles.length === 0) { this.endDungeon('endDungeon', 'All Dead'); return; }
					this.testProcessingPromises(battles);
				}
			}

			async prepareBattles(floorChoices) {
				const { fixTitanTeam, getNeutralTeam } = DungeonUtils;
				const battles = [];
				for (const [teamNum, choice] of Object.entries(floorChoices)) {
					const { attackerType } = choice;
					let team = { favor: {}, teamNum, heroes: [] };
					if (attackerType === 'hero') { team = this.teams[attackerType]; } else { team.heroes = fixTitanTeam(this.teams[attackerType].heroes, this.titansStates); }
					if (attackerType === 'neutral') { team.heroes = getNeutralTeam(this.titans, this.titansStates); }
					if (team.heroes.length === 0) { continue; }
					const battleData = await this.executeWithRetry({ name: 'dungeonStartBattle', args: { ...team, teamNum } });
					if (!battleData) { return false; }
					battles.push({ ...battleData, progress: [{ attackers: { input: ['auto', 0, 0, 'auto', 0, 0] } }], teamNum, attackerType });
				}
				return battles;
			}

			async checkTalent(dungeonInfo) {
				const { talent } = dungeonInfo;
				if (!talent) return true;
				const dungeonFloor = +dungeonInfo.floorNumber;
				const talentFloor = +talent.floorRandValue;
				let doorsAmount = 3 - talent.conditions.doorsAmount;
				if (dungeonFloor === talentFloor && (!doorsAmount || !talent.conditions?.farmedDoors[dungeonFloor])) {
					const results = await this.executeWithRetry([
						{ name: 'heroTalent_getReward', args: { talentType: 'tmntDungeonTalent', reroll: false } },
						{ name: 'heroTalent_farmReward', args: { talentType: 'tmntDungeonTalent' } },
					]);
					if (!results) { return false; }
					const [reward] = results;
					const type = Object.keys(reward).pop();
					if (reward[type]) {
						const itemId = Object.keys(reward[type]).pop();
						const count = reward[type][itemId];
						const itemName = unsafeWindow.cheats.translate(`LIB_${type.toUpperCase()}_NAME_${itemId}`);
						this.talentMsgReward += `<br> ${count} <span style="color:${itemId === 300 ? 'red' : 'inherit'}">${itemName}</span>`;
						doorsAmount++;
					}
				}
				this.talentMsg = `<br>TMNT Talent: ${doorsAmount}/3 ${this.talentMsgReward}<br>`;
				return true;
			}

			updatePower(battle) {
				const type = battle.attackerType;
				const def = Object.values(battle.defenders[0]);
				const power = def.reduce((a, e) => a + e.power, 0);
				this.defPowers[type] = power;
				const buff = battle?.effects?.defenders?.percentBuffAllEnemy_healing;
				if (typeof buff === 'number') { this.buffHealing = buff; }
				if (typeof unsafeWindow !== 'undefined') {
					const currentData = unsafeWindow.HWH_TitanStats || {};
					currentData.dungeonBuff = this.buffHealing !== null ? this.buffHealing : 0;
					currentData.timestamp = Date.now();
					unsafeWindow.HWH_TitanStats = currentData;
				}
			}

			checkBuffStop() {
				if (this.buffHealing === null || this.buffHealing === undefined) return false;
				const absBuff = Math.abs(this.buffHealing);
				if (this.buffStop100 && absBuff > 95) return true;
				if (this.buffStop75 && absBuff > 70) return true;
				return false;
			}

			async syncAutoProfileToInstance(profileNum) {
				const profile = await applyAutoProfile(profileNum);
				if (!profile) return;
				this.timeoutFix = profile.tech.timeoutFix;
				this.countFix = profile.tech.countFix;
				this.monoMultiplier = profile.tech.monoMultiplier || 1;
				this.maxTimer = profile.tech.maxTimer;
				this.fixCoeff = profile.tech.fixCoeff;
				this.simSamples = profile.threshold.simSamples;
				this.simRank = profile.threshold.simRank;
				this.forceWaterInNeutral = profile.forceWaterInNeutral || false;
			}

			checkHealthThreshold(minTitanHp, profileNum, attackerType) {
				const threshold = HEALTH_THRESHOLDS[profileNum];
				if (!threshold) return true;
				const isElemental = ['water', 'fire', 'earth'].includes(attackerType);
				const required = isElemental ? threshold.elemental : threshold.mixed;
				const passed = minTitanHp >= required;
				console.log(`%c[AutoProfile] P${profileNum} Health Check: minHP=${(minTitanHp * 100).toFixed(1)}% ${isElemental ? '(elemental)' : '(mixed)'} vs threshold=${(required * 100).toFixed(0)}% → ${passed ? 'PASS' : 'FAIL'}`, passed ? 'color: #0f0;' : 'color: #f80;');
				return passed;
			}

			async testProcessingPromises(battles) {
				const { getState, compareScore } = DungeonUtils;
				
				const firstBuff = battles[0]?.effects?.defenders?.percentBuffAllEnemy_healing;
				if (typeof firstBuff === 'number') { this.buffHealing = firstBuff; }
				if (this.checkBuffStop()) {
					const absBuff = Math.abs(this.buffHealing);
					this.endDungeon('buffStop', `Dungeon stopped: healing penalty at ${absBuff}%`);
					return;
				}
				
				const buffStopActive = this.buffStop100 || this.buffStop75;
				this.currentAutoProfile = selectProfileByBuff(this.buffHealing, buffStopActive);
				await this.syncAutoProfileToInstance(this.currentAutoProfile);
				console.log(`%c[AutoProfile] Starting with P${this.currentAutoProfile} (buff: ${this.buffHealing !== null ? this.buffHealing : 0}%)`, 'color: #0ff; font-weight: bold; font-size: 12px;');
				
				let selectBattle = null;
				let bestRec = null;
				let bestPack = null;
				let profilesTried = [];
				
				while (true) {
					selectBattle = null;
					bestRec = { hp: -Infinity, energy: -Infinity, losses: [1, 2, 3, 4, 5], minTitanHp: 0 };
					bestPack = null;
					
					const allowedTitanIds = DungeonUtils.allowedTitanIds || [];
					console.log(`%c[AutoProfile] P${this.currentAutoProfile} - Simulating with ${allowedTitanIds.length} titans`, 'color: #aaa;');
					
					for (const battle of battles) {
						this.updatePower(battle);
						if (battle.attackerType === 'hero') {
							this.logBattleStats(battle);
							const resultHeroBattle = await Calc(battle);
							await this.endBattle(resultHeroBattle);
							return;
						}
						let attackers = null;
						const titanStats = new TitanStats(this.titanGetAll, this.titanSpirits, this.titansStates);
						if (battle.attackerType === 'neutral') {
							const evalute = new EvaluateAttackPack(titanStats, battle);
							evalute.forceWaterInNeutral = this.forceWaterInNeutral;
							attackers = await evalute.getAttackers(allowedTitanIds);
						} else {
							const evalute = new EnumAttackPack(titanStats, battle);
							attackers = await evalute.getAttackers();
						}
						const rec = await this.resultBattle({ ...battle, attackers }).then(getState);
						this.logBattleStats({ ...battle, attackers }, rec);
						if (compareScore(rec, bestRec)) {
							bestRec = { hp: rec.hp, energy: rec.energy, losses: rec.losses, minTitanHp: rec.minTitanHp };
							selectBattle = battle;
							bestPack = attackers;
						}
					}
					
					if (!selectBattle || bestRec.hp <= -Infinity) {
						this.endDungeon(I18N('BEST_DUNGEON_WINNING_FIGHT_NOT_FOUND'), battles);
						return;
					}
					
					profilesTried.push(this.currentAutoProfile);
					
					const healthOk = this.checkHealthThreshold(bestRec.minTitanHp, this.currentAutoProfile, selectBattle.attackerType);
					
					if (healthOk) {
						console.log(`%c[AutoProfile] P${this.currentAutoProfile} ACCEPTED - minHP: ${(bestRec.minTitanHp * 100).toFixed(1)}%`, 'color: #0f0; font-weight: bold;');
						break;
					}
					
					if (this.currentAutoProfile === 3 && bestRec.minTitanHp > 0.60) {
						console.log(`%c[AutoProfile] P3 FALLBACK ACCEPTED - minHP: ${(bestRec.minTitanHp * 100).toFixed(1)}% > 60% (avoiding P4)`, 'color: #fa0; font-weight: bold;');
						break;
					}
					
					if (this.currentAutoProfile >= 4) {
						console.log(`%c[AutoProfile] P4 - No further fallback possible, accepting battle (minHP: ${(bestRec.minTitanHp * 100).toFixed(1)}%)`, 'color: #f80; font-weight: bold;');
						break;
					}
					
					const prevProfile = this.currentAutoProfile;
					this.currentAutoProfile++;
					await this.syncAutoProfileToInstance(this.currentAutoProfile);
					console.log(`%c[AutoProfile] P${prevProfile} FAILED (minHP: ${(bestRec.minTitanHp * 100).toFixed(1)}%), escalating to P${this.currentAutoProfile}`, 'color: #ff0; font-weight: bold;');
				}
				
				console.log(`%c[AutoProfile] Final: P${this.currentAutoProfile} | Profiles tried: [${profilesTried.join(',')}] | minHP: ${(bestRec.minTitanHp * 100).toFixed(1)}%`, 'color: #0ff; font-weight: bold;');
				
				const initialBattle = await this.startBattle(selectBattle.teamNum, selectBattle.attackerType, bestPack);
				this.logSelectPack({ ...initialBattle.battleData, attackerType: selectBattle.attackerType }, bestRec);
				await this.retryBattle(initialBattle, bestRec);
			}

			logBattleStats(battle, bestRec = null) {
				let colors = [];
				let text = '';
				if (bestRec) { colors = [this.colors.green, this.colors.none]; text = ' %cbestStat: %c' + JSON.stringify(bestRec); }
				console.log(`%c${battle.attackerType}` + text, this.colors[battle.attackerType], ...colors);
				if (bestRec) { this.logPack(battle, battle.teamNum); }
			}

			logSelectPack(battle, recSelectBattle) {
				const attackerType = battle.attackerType;
				const pack = Object.values(battle.attackers).map((e) => e.id);
				this.recordStat(pack);
				console.log('Select: %c' + attackerType, this.colors[attackerType]);
				this.logPack(battle);
				console.log('%cbattleStat: %c' + JSON.stringify(recSelectBattle), this.colors.green, this.colors.none);
			}

			logPack(battle, teamNum = '') {
				const pack = Object.values(battle.attackers).map((e) => e.id);
				const list = pack.reduce((a, e) => { a.names.push('%c' + unsafeWindow.cheats.translate('LIB_HERO_NAME_' + e)); a.styles.push(this.colors[unsafeWindow.lib.data.titan[e].element]); return a; }, { names: [], styles: [] });
				console.log(`%cPack ${teamNum}: ` + list.names.join(' '), this.colors[battle.attackerType], ...list.styles);
			}

			recordStat(pack) {
				for (const id of pack) {
					this.stateUseTitanGlobal[id] ??= 0; this.stateUseTitanGlobal[id]++;
					this.stateUseTitanLocal[id] ??= 0; this.stateUseTitanLocal[id]++;
				}
			}

			async sampleBattleStats(battle, samples) {
				const { getState, genBattleSeed, isRandomBattle } = DungeonUtils;
				const stats = [];
				if (!isRandomBattle(battle)) { samples = 1; }
				for (let i = 0; i < samples; i++) {
					const rec = await Calc({ ...battle, seed: genBattleSeed() }).then(getState);
					stats.push(rec);
				}
				console.log('isRandomBattle', isRandomBattle(battle), stats);
				return stats;
			}

			async calculateThreshold(battle) {
				const { compareScore } = DungeonUtils;
				const samples = this.simSamples || 100;
				let rank = this.simRank || 85;
				if (rank > samples) rank = samples;
				let q = rank / samples;
				if (q > 0.999) q = 0.999;

				console.log(`%c[Threshold] Samples: ${samples}, Rank: ${rank}, q: ${q.toFixed(3)}`, "color: orange");

				const stats = await this.sampleBattleStats(battle, samples);
				stats.sort((a, b) => {
					if (compareScore(a, b)) return 1;
					if (compareScore(b, a)) return -1;
					return 0;
				});

				return stats[Math.floor(stats.length * q)];
			}

			async retryBattle(initialBattle, targetRec) {
				const { getState, compareScore } = DungeonUtils;
				const countAutoBattle = +getInput('countAutoBattle');
				let thresholdRec = await this.calculateThreshold(initialBattle.battleData);
				console.log(`%cThreshold stats: %chp=${thresholdRec.hp.toFixed(4)} energy=${thresholdRec.energy.toFixed(4)} losses=${thresholdRec.losses.length}`, this.colors.green, this.colors.none);
				console.log(`%cTarget stats: %chp=${targetRec.hp.toFixed(4)} energy=${targetRec.energy.toFixed(4)} losses=${targetRec.losses.length}`, this.colors.green, this.colors.none);
				const initialState = getState(initialBattle);
				if (compareScore(initialState, targetRec)) {
					console.log(`%cInitial battle is optimal: %chp=${initialState.hp.toFixed(4)} energy=${initialState.energy.toFixed(4)}`, this.colors.green, this.colors.none);
					await this.endBattle(initialBattle);
					return;
				}
				let result = initialBattle;
				for (let i = 0; i < countAutoBattle; i++) {
					if (this.isStop) return;
					result = await this.startBattle(initialBattle.teamNum, initialBattle.attackerType, initialBattle.battleData.attackers);
					if (!result) { this.endDungeon('ErrorReqests'); return; }
					const rec = getState(result);
					console.log(`%cRetry ${i + 1}/${countAutoBattle}: %chp=${rec.hp.toFixed(4)} (≥${thresholdRec.hp.toFixed(4)}) ` + `%cenergy=${rec.energy.toFixed(4)} (≥${thresholdRec.energy.toFixed(4)})`, this.colors.green, this.colors.none, this.colors.green);
					if (compareScore(rec, thresholdRec)) {
						console.log(`%c✅ Acceptable fight found on attempt ${i + 1}: %chp=${rec.hp.toFixed(4)} energy=${rec.energy.toFixed(4)}`, this.colors.green, this.colors.none);
						await this.endBattle(result);
						return;
					}
					thresholdRec.hp -= 0.001 * i;
					thresholdRec.energy -= 0.01 * i;
				}
				const finalRec = getState(result);
				console.log(`%c❌ No acceptable fight found. Using last: %chp=${finalRec.hp.toFixed(4)} energy=${finalRec.energy.toFixed(4)}`, this.colors.red, this.colors.none);
				await this.endBattle(result);
			}

			async startBattle(teamNum, attackerType, pack = null) {
				const { fixTitanTeam, getNeutralTeam } = DungeonUtils;
				let heroes = [];
				if (pack) { heroes = Object.values(pack).map((e) => e.id); } else {
					if (attackerType === 'hero') { heroes = this.teams.hero.heroes; } else if (attackerType === 'neutral') { heroes = getNeutralTeam(this.titans, this.titansStates); } else { heroes = fixTitanTeam(this.teams[attackerType].heroes, this.titansStates); }
				}
				const battleData = await this.executeWithRetry({ name: 'dungeonStartBattle', args: { favor: {}, teamNum, heroes } });
				if (!battleData) { return false; }
				return this.resultBattle(battleData, { teamNum, attackerType });
			}

			async resultBattle(battleData, args = {}) {
				if (this.isFixedBattle) {
					const dfb = new UpdateDungeonFixBattle(battleData);
					dfb.customMaxTimer = this.maxTimer;
					dfb.customFixCoeff = this.fixCoeff;
					dfb.isShowResult = this.isShowFixLog;

					let timeout = this.timeoutFix;
					let countFix = this.countFix;
					const attackerType = args.attackerType || battleData.attackerType;

					if (['water', 'fire', 'earth'].includes(attackerType)) {
						const multiplier = this.monoMultiplier || 1;
						timeout *= multiplier;
						countFix *= multiplier;
						if (multiplier > 1) {
							console.log(`%c[Mono-Boost] Applying ${multiplier}x battle correction for ${attackerType} battle.`, 'color: cyan; font-weight: bold;');
						}
					}

					const fixData = await dfb.start(Date.now() + timeout, countFix);
					battleData.progress = [{ attackers: { input: ['auto', 0, 0, 'auto', 0, fixData.timer] } }];
				}
				const result = await Calc(battleData);
				return { ...result, ...args };
			}

			getThresholdTimer() {
				function median(arr) { const sorted = [...arr].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]; }
				function average(arr) { const sum = arr.reduce((total, num) => total + num); return sum / arr.length; }
				if (this.timers.length < 10) { return 30; }
				const thresholdAvg = average(this.timers);
				if (thresholdAvg > 30) { return thresholdAvg; }
				const thresholdMed = median(this.timers);
				if (thresholdMed > 30) { return thresholdMed; }
				return 30;
			}

			async endBattle(battleInfo) {
				if (battleInfo.battleData.attackerType !== 'hero') { this.logPack(battleInfo.battleData); }
				const isAllDead = Object.values(battleInfo.progress[0].attackers.heroes).every((item) => item.isDead);
				if (!battleInfo.result.win && isAllDead) { this.endDungeon('dungeonEndBattle win: false\n', battleInfo); return; }
				const args = { result: battleInfo.result, progress: battleInfo.progress };
				this.timers.push(battleInfo.battleTimer);
				const thresholdTimer = this.getThresholdTimer();
				console.log('countCard', unsafeWindow.HWHData.countPredictionCard, 'battleTimer', battleInfo.battleTimer, 'thresholdTimer', thresholdTimer);
				if (unsafeWindow.HWHData.countPredictionCard && battleInfo.battleTimer > thresholdTimer) { args.isRaid = true; } else {
					const message = this.getStatMessage();
					const timerFinished = await countdownTimer(battleInfo.battleTimer, message, this.stop.bind(this), false);
					console.log('timerFinished', timerFinished);
					if (!timerFinished) { this.endDungeon('endDungeon', 'Остановлено'); return; }
				}
				const resultEnd = await this.executeWithRetry({ name: 'dungeonEndBattle', args });
				if (!resultEnd) { this.endDungeon('ErrorReqests'); return; }
				this.resultEndBattle(resultEnd);
			}

			resultEndBattle(battleResult) {
				if (battleResult.error) { this.endDungeon('Error', battleResult.error); }
				const dungeonGetInfo = battleResult.dungeon ?? battleResult;
				if (dungeonGetInfo.reward) { this.dungeonGetInfo = dungeonGetInfo; } else { this.dungeonGetInfo.states = dungeonGetInfo.states; }
				const addActivity = battleResult.reward?.dungeonActivity ?? 0;
				this.dungeonActivity += addActivity;
				this.currentActivity += addActivity;
				Promise.resolve().then(() => { this.checkFloor(this.dungeonGetInfo); });
			}

			titanObjToArray(obj) { return Object.entries(obj).map(([id, data]) => ({ id, ...data })); }

			async saveProgress() {
				const result = await this.executeWithRetry('dungeonSaveProgress');
				if (!result) { this.endDungeon('ErrorReqests'); return; }
				this.resultEndBattle(result);
			}

			showStat(type, stat) {
				const list = Object.entries(stat).sort(([_i, a], [_j, b]) => b - a).reduce((a, [id, n]) => { a.names.push('%c' + unsafeWindow.cheats.translate('LIB_HERO_NAME_' + id) + ': ' + n + ', '); a.styles.push(this.colors[unsafeWindow.lib.data.titan[id].element]); return a; }, { names: [], styles: [] });
				console.log(type + ' stat:\n' + list.names.join(' '), ...list.styles);
			}

			endDungeon(reason, info) {
				this.showStat('Current', this.stateUseTitanLocal);
				this.showStat('Global', this.stateUseTitanGlobal);
				console.log('timerStat', this.timers);
				setSaveVal('stateUseTitan', this.stateUseTitanGlobal);
				console.warn(reason, info);
				const message = this.getStatMessage() + '<br>Dungeon completed!' + (reason === 'endDungeon' ? `<br>${info}` : '');
				setProgress(message, false, hideProgress);
				this.resolve();
			}
		}

		unsafeWindow.HWHClasses.executeDungeon = BestDungeon;

		class SelectAttackPack {
			constructor(heroStats, battle) { this.heroStats = heroStats; this.battle = structuredClone(battle); }
			sortByHpAndEnergy(a, b) { if (a.v.hp !== b.v.hp) { return b.v.hp - a.v.hp; } return b.v.energy - a.v.energy; }
			getBattleWithPack(pack) { const cloneBattle = structuredClone(this.battle); cloneBattle.attackers = this.getAttackersStat(pack); return cloneBattle; }
			getAttackersStat(pack) { return Object.fromEntries(pack.map((id) => [id, this.heroStats.getTitanStats(id)])); }
			async evaluatePack(pack) {
				const cloneBattle = this.getBattleWithPack(pack);
				const { isRandomBattle, genBattleSeed, getState, compareScore, logicConfig } = DungeonUtils;
				// BUGFIX: Initialize with worst possible losses [1,2,3,4,5]
				const maxResult = { hp: -Infinity, energy: -Infinity, seed: null, losses: [1, 2, 3, 4, 5], minTitanHp: 0 };

				let countTest = DungeonUtils.countTest || 3;
				if (logicConfig && logicConfig.deepGA) {
					countTest = countTest * 2;
				}

				const countTestBattle = isRandomBattle(cloneBattle) ? countTest : 1;
				for (let i = 0; i < countTestBattle; i++) {
					const seed = genBattleSeed();
					cloneBattle.seed = seed;
					const result = await Calc(cloneBattle).then(getState);
					if (compareScore(result, maxResult)) {
						maxResult.hp = result.hp;
						maxResult.energy = result.energy;
						maxResult.seed = seed;
						maxResult.losses = result.losses;
						maxResult.minTitanHp = result.minTitanHp;
					}
				}
				return maxResult;
			}
		}

		class EnumAttackPack extends SelectAttackPack {
			async getAttackers() {
				const { compareScore } = DungeonUtils;
				const values = this.heroStats.getAllowTitanIds(this.battle.attackerType);
				const combinations = this.getAllCombinations(values);
				let bestCombination = combinations[0];
				// BUGFIX: Initialize with worst possible losses [1,2,3,4,5]
				let bestScore = { hp: -Infinity, energy: -Infinity, losses: [1, 2, 3, 4, 5], minTitanHp: 0 };
				for (const combination of combinations) {
					const result = await this.evaluatePack(combination);
					if (compareScore(result, bestScore)) {
						bestScore.hp = result.hp;
						bestScore.energy = result.energy;
						bestScore.losses = result.losses;
						bestScore.minTitanHp = result.minTitanHp;
						bestCombination = combination;
					}
				}
				const attackers = this.getAttackersStat(bestCombination);
				return attackers;
			}
			getAllCombinations(arr) {
				const result = []; const n = arr.length;
				function combine(start, current) { if (current.length > 0) { result.push([...current]); } for (let i = start; i < n; i++) { current.push(arr[i]); combine(i + 1, current); current.pop(); } }
				combine(0, []); return result.sort((a, b) => a.length - b.length);
			}
		}

		class EvaluateAttackPack extends SelectAttackPack {
			constructor(heroStats, battle) {
				super(heroStats, battle);
				this.maxTitanPower = 30000; this.minTitanPower = 5000;
				this.forceWaterInNeutral = false;
			}
			async getAttackers(allowedIds = []) {
				const values = this.heroStats.getAllowTitanIds(false, allowedIds);
				const bestParams = DungeonUtils.bestParams || { populationSize: 9, generations: 30, mutationRate: 0.06, eliteCount: 2 };

				let genCount = bestParams.generations;
				if (DungeonUtils.logicConfig && DungeonUtils.logicConfig.deepGA) {
					genCount = Math.floor(genCount * 1.5);
				}

				let bestCombination;
				if (this.forceWaterInNeutral) {
					const waterPriority = [4004, 4003, 4000, 4001, 4002];
					const availableWater = waterPriority.filter(id => values.includes(id));
					const forcedWater = availableWater.slice(0, 3);
					const waterIdsSet = new Set(forcedWater);
					const remainingValues = values.filter(id => !waterIdsSet.has(id));
					const slotsLeft = 5 - forcedWater.length;

					if (slotsLeft > 0 && remainingValues.length >= slotsLeft) {
						const ga = new GeneticAlgorithm({ values: remainingValues, combinationSize: slotsLeft, ...bestParams, generations: genCount });
						ga.setEvaluate(this.evaluatePack.bind(this));
						ga.setCustomSort(this.sortByHpAndEnergy);
						ga.setCompereScore(DungeonUtils.compareScore);
						const gaResult = await ga.run();
						bestCombination = [...forcedWater, ...gaResult].sort();
					} else {
						bestCombination = forcedWater.slice(0, 5);
					}
				} else {
					const ga = new GeneticAlgorithm({ values, combinationSize: 5, ...bestParams, generations: genCount });
					ga.setEvaluate(this.evaluatePack.bind(this));
					ga.setCustomSort(this.sortByHpAndEnergy);
					ga.setCompereScore(DungeonUtils.compareScore);
					bestCombination = await ga.run();
				}

				this.statBestCombination = await this.evaluatePack(bestCombination);
				console.log(I18N('BEST_DUNGEON_BEST_COMBINATION'), bestCombination, bestCombination.map((e) => unsafeWindow.cheats.translate('LIB_HERO_NAME_' + e)), this.statBestCombination);
				const attackers = this.getAttackersStat(bestCombination);
				return attackers;
			}
			getStatBestPack() { return this.statBestCombination; }
		}

		class DungeonUtils {
			static getState(result) {
				const isAllDead = Object.values(result.progress[0].attackers.heroes).every((item) => item.isDead);
				if (isAllDead) { return { hp: -1e300, energy: -1e300, losses: Object.keys(result.battleData.attackers), minTitanHp: 0 }; }

				let initialHP = 0; let initialEnergy = 0;
				const beforeTitans = result.battleData.attackers;
				for (let titanId in beforeTitans) { const titan = beforeTitans[titanId]; const state = titan.state; if (state) { initialHP += state.hp / titan.hp; initialEnergy += state.energy / 1e3; } }

				let afterHP = 0; let afterEnergy = 0;
				let minTitanHp = 1.0;

				const afterTitans = result.progress[0].attackers.heroes;
				for (let titanId in afterTitans) {
					const titan = afterTitans[titanId];
					const hpRatio = titan.hp / beforeTitans[titanId].hp;
					afterHP += hpRatio;
					afterEnergy += titan.energy / 1e3;
					if (hpRatio < minTitanHp) minTitanHp = hpRatio;
				}

				const beforeIds = Object.keys(beforeTitans); const afterIds = Object.keys(afterTitans);
				const losses = beforeIds.filter((key) => !afterIds.includes(key));
				const hp = afterHP - initialHP; const energy = afterEnergy - initialEnergy;

				if (!afterIds.length || (hp <= 0 && energy <= 0 && !result.result.win)) { return { hp: -1e300, energy: -1e300, losses, minTitanHp: 0 }; }
				return { hp, energy, losses, minTitanHp };
			}

			static isRandomPack(pack) { const ids = Object.values(pack).map((e) => +e.id); return ids.includes(4023) || ids.includes(4021); }
			static isRandomBattle(battle) { return DungeonUtils.isRandomPack(battle.attackers) || DungeonUtils.isRandomPack(battle.defenders[0]); }

			static compareScore(newScore, lastScore) {
				const cfg = DungeonUtils.logicConfig || { scoringMethod: 'weighted', zeroDeaths: true, antiOneshot: false };

				if (cfg.zeroDeaths) {
					const newLosses = newScore.losses ? newScore.losses.length : 0;
					// BUGFIX: If lastScore has no losses array, assume worst case (5)
					const lastLosses = lastScore.losses ? lastScore.losses.length : 5;
					if (newLosses < lastLosses) return true;
					if (newLosses > lastLosses) return false;
				}

				if (cfg.antiOneshot) {
					const threshold = 0.10;
					const newSafe = newScore.minTitanHp > threshold;
					const lastSafe = lastScore.minTitanHp > threshold;
					if (newSafe && !lastSafe) return true;
					if (!newSafe && lastSafe) return false;
				}

				if (cfg.scoringMethod === 'strict') {
					const hpEps = 0.0005;
					if (newScore.hp > lastScore.hp + hpEps) return true;
					if (Math.abs(newScore.hp - lastScore.hp) <= hpEps) {
						return newScore.energy >= lastScore.energy;
					}
					return false;
				} else {
					const hpW = DungeonUtils.hpWeight || 25;
					const enW = DungeonUtils.energyWeight || 1;
					const s1 = newScore.hp * hpW + newScore.energy * enW;
					const s2 = lastScore.hp * hpW + lastScore.energy * enW;
					return s1 >= s2;
				}
			}

			static titanObjToArray(obj) { return Object.entries(obj).map(([id, data]) => ({ id, ...data })); }
			static getTitanTeam(titans, type) {
				if (type === 'neutral') { return DungeonUtils.getNeutralTeam(titans); }
				const indexMap = { water: '0', fire: '1', earth: '2' };
				const index = indexMap[type];
				return titans.filter((e) => e.id.toString().slice(2, 3) === index).map((e) => e.id);
			}
			static getNeutralTeam(titans, states = {}) { return DungeonUtils.fixTitanTeam(titans, states).sort((a, b) => b.power - a.power).slice(0, 5).map((e) => e.id); }
			static fixTitanTeam(titans, states = {}) { return titans.filter((titan) => { const id = titan.id ?? titan; return !states[id]?.isDead; }); }
			static genBattleSeed() { return Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1e9); }
			static getParamsStorageKey() { return 'HWH_Dungeon_Algo_Params'; }
			static loadAlgoParams() {
				const stored = JSON.parse(localStorage.getItem(this.getParamsStorageKey())) || {};
				this.bestParams = { ...this.bestParams, ...stored };
				if (stored.countTest) this.countTest = stored.countTest;
			}
			static saveAlgoParams() {
				const dataToSave = { ...this.bestParams, countTest: this.countTest };
				localStorage.setItem(this.getParamsStorageKey(), JSON.stringify(dataToSave));
			}
		}
	}
})();
