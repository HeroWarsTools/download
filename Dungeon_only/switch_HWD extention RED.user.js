// ==UserScript==
// @name			switch_🚀HWD extention REDm
// @name:en			switch_🚀HWD extention REDm
// @name:ru			switch_🚀HWD extention REDm
// @namespace		switch_🚀HWD extention REDm
// @version			1.0.6b Verdoc
// @description		Extension for HeroWarsHelper dungeon script
// @description:en	Extension for HeroWarsHelper dungeon script
// @description:ru	HeroWarsHelper extention
// @author			...
// @match			https://www.hero-wars.com/*
// @match			https://apps-1701433570146040.apps.fbsbx.com/*
// @run-at			document-start
// @downloadURL https://update.greasyfork.org/scripts/523551/HWHExtension.user.js
// @updateURL https://update.greasyfork.org/scripts/523551/HWHExtension.meta.js
// @grant           GM_getValue
// @grant           GM_setValue
// @grant           GM_addStyle
// @grant           unsafeWindow
// ==/UserScript==

(function () {

const defaultTitanHealthSettings = {
    minOverallHP: 0.30,
    titan4020HP: 0.40,
    titan4020EnergyHP: 0.20,
    titan4010Combined: 0.67,
    titan4000HP: 0.63,
    titan4000Energy400HP: 0.45,
    titan4000Energy670HP: 0.34,
    autoRefreshPage: false
};

let titanHealthSettings = {};

// >>> INIZIO MODIFICHE APPLICATE QUI <<<
// Dichiarazione esplicita di stopDung a livello superiore
let stopDung = false;

// Funzione per lo stop esterno
window.stopHWDDungeon = () => {
    if (typeof stopDung !== 'undefined') {
        stopDung = true;
        console.log('HWD Dungeon stop requested externally.');
    } else {
        console.log('stopDung variable not found or not in scope. (This should not happen if placed correctly)');
    }
};
// >>> FINE MODIFICHE APPLICATE QUI <<<

// SWITCH: Engine active flag for RED. Default ON.
globalThis.__redActive = true;

// SWITCH: Listen for engine mode commands
document.addEventListener('setDungeonEngine', function (event) {
    const engine = event.detail.engine;
    if (engine === 'red') {
        globalThis.__redActive = true;
        console.log('%c[Switch] RED engine ACTIVATED by setDungeonEngine.', 'color: #0a0');
    } else if (engine === 'evo1') {
        globalThis.__redActive = false;
        console.log('%c[Switch] RED engine DEACTIVATED by setDungeonEngine.', 'color: #f0a');
    }
});

// SWITCH: Listen for profile changes — profile 0 activates RED
document.addEventListener('changeDungeonProfile', function (event) {
    const profileNumber = event.detail.profileNumber;
    if (profileNumber === 0) {
        globalThis.__redActive = true;
        console.log('%c[Switch] RED engine ACTIVATED by Profile 0.', 'color: #0a0');
    } else if (profileNumber >= 1) {
        globalThis.__redActive = false;
        console.log('%c[Switch] RED engine DEACTIVATED by Profile ' + profileNumber + '.', 'color: #f0a');
    }
});

// SWITCH: Listen for auto-start command from Pannello
document.addEventListener('autoStartDungeon', async function (event) {
    if (!globalThis.__redActive) return;
    const titanit = event.detail.maxTitanite || getInput('countTitanit');
    // Use HWHClasses.executeDungeon (BestDungeon constructor delegates to RED when __redActive)
    if (typeof HWHClasses !== 'undefined' && HWHClasses.executeDungeon) {
        const instance = new HWHClasses.executeDungeon(
            () => {},
            () => {}
        );
        if (instance && instance.start) {
            instance.start(titanit);
        }
    }
});

function loadSettings() {
    titanHealthSettings = GM_getValue('titanHealthSettings', defaultTitanHealthSettings);
}

function saveSettings() {
    GM_setValue('titanHealthSettings', titanHealthSettings);
}

loadSettings();

if (!this.HWHClasses) {
	console.log('%cObject for extension not found', 'color: red');
	return;
}

console.log('%cStart Extension ' + GM_info.script.name + ', v' + GM_info.script.version + ' by ' + GM_info.script.author, 'color: red');

let dungeonModeIndicator;
let clickMessage;

function initializeDungeonIndicator() {
    dungeonModeIndicator = document.createElement('div');
    dungeonModeIndicator.id = 'dungeonModeIndicator';
    dungeonModeIndicator.textContent = 'Dungeon Mode';

    clickMessage = document.createElement('div');
    clickMessage.id = 'dungeonModeClickMessage';
    clickMessage.style.fontSize = '10px';
    clickMessage.style.fontWeight = 'normal';
    clickMessage.style.textAlign = 'center';
    clickMessage.style.marginTop = '2px';
    clickMessage.textContent = 'click to show';

    dungeonModeIndicator.appendChild(clickMessage);

    dungeonModeIndicator.style.position = 'fixed';
    dungeonModeIndicator.style.top = '10px';
    dungeonModeIndicator.style.left = '10px';
    dungeonModeIndicator.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
    dungeonModeIndicator.style.color = 'white';
    dungeonModeIndicator.style.padding = '10px';
    dungeonModeIndicator.style.borderRadius = '5px';
    dungeonModeIndicator.style.zIndex = '9999';
    dungeonModeIndicator.style.fontFamily = 'Arial, sans-serif';
    dungeonModeIndicator.style.fontSize = '18px';
    dungeonModeIndicator.style.fontWeight = 'bold';
    dungeonModeIndicator.style.border = '2px solid white';
    dungeonModeIndicator.style.cursor = 'pointer';
    dungeonModeIndicator.style.display = 'flex';
    dungeonModeIndicator.style.flexDirection = 'column';
    dungeonModeIndicator.style.alignItems = 'center';

    document.body.appendChild(dungeonModeIndicator);
}

document.addEventListener('DOMContentLoaded', initializeDungeonIndicator);

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
} = HWHFuncs;

function executeDungeon(resolve, reject) {
	let countPredictionCard = 0;
	let dungeonActivity = 0;
	let startDungeonActivity = 0;
	let maxDungeonActivity = 150;
	let limitDungeonActivity = 30180;
	let countShowStats = 1;
	let end = false;

	let countTeam = [];
	let timeDungeon = {
		all: new Date().getTime(),
		findAttack: 0,
		attackNeutral: 0,
		attackEarthOrFire: 0,
	};

	let titansStates = {};
	let bestBattle = {};

	let teams = {
		neutral: [],
		water: [],
		earth: [],
		fire: [],
		hero: [],
	};

	let talentMsg = '';
	let talentMsgReward = '';

	let callsExecuteDungeon = {
		calls: [
			{
				name: 'dungeonGetInfo',
				args: {},
				ident: 'dungeonGetInfo',
			},
			{
				name: 'teamGetAll',
				args: {},
				ident: 'teamGetAll',
			},
			{
				name: 'teamGetFavor',
				args: {},
				ident: 'teamGetFavor',
			},
			{
				name: 'clanGetInfo',
				args: {},
				ident: 'clanGetInfo',
			},
			{
				name: 'inventoryGet',
				args: {},
				ident: 'inventoryGet',
			},
		],
	};

	// SWITCH: Dispatch CustomEvents to Pannello with titan states and floor data
	function dispatchPanelEvents(dungeonInfo) {
		if (!dungeonInfo) return;

		// 1. Build titan data organized by element
		const elementMap = {
			water: [4000, 4001, 4002, 4003, 4004],
			fire: [4010, 4011, 4012, 4013, 4014],
			earth: [4020, 4021, 4022, 4023, 4024],
			light: [4030, 4031, 4032, 4033, 4034],
			dark: [4040, 4041, 4042, 4043, 4044]
		};
		const titansByElement = {};
		for (const [element, ids] of Object.entries(elementMap)) {
			titansByElement[element] = [];
			for (const id of ids) {
				const t = titansStates[id];
				if (t) {
					let titanName = 'Titan ' + id;
					try {
						if (window.cheats && window.cheats.translate) {
							titanName = window.cheats.translate('LIB_HERO_NAME_' + id) || titanName;
						}
					} catch (e) {}
					titansByElement[element].push({
						name: titanName,
						hpPercent: t.maxHp ? Math.round(((t.hp || 0) / t.maxHp) * 100) : 0,
						energy: t.energy || 0,
						isDead: t.isDead || false
					});
				}
			}
		}
		document.dispatchEvent(new CustomEvent('titanStatesUpdated', { detail: titansByElement }));

		// 2. Build dungeon progress data
		const floorNumber = dungeonInfo.floorNumber || 0;
		let primeElement = 'unknown';
		if (dungeonInfo.floor && dungeonInfo.floor.userData && dungeonInfo.floor.userData.length > 0) {
			primeElement = dungeonInfo.floor.userData[0].attackerType || 'unknown';
		}
		// Extract healingBuff — fallback chain: dungeonInfo.states → HWHData → unsafeWindow (shared by Evo1) → default -85
		let healingBuffs = -85;
		try {
			if (dungeonInfo?.states?.healingBuff !== undefined) {
				healingBuffs = dungeonInfo.states.healingBuff;
			}
		} catch (e) {}
		if (healingBuffs === -85) {
			try {
				if (window.HWHData?.dungeon?.states?.healingBuff !== undefined) {
					healingBuffs = window.HWHData.dungeon.states.healingBuff;
				}
			} catch (e) {}
		}
		if (healingBuffs === -85 && unsafeWindow._lastHealingBuff !== undefined) {
			healingBuffs = unsafeWindow._lastHealingBuff;
		}

		const progressData = {
			floorNumber: floorNumber,
			floorType: dungeonInfo.floorType || 'info',
			primeElement: primeElement,
			currentTitanite: dungeonActivity,
			maxTitanite: maxDungeonActivity
		};
		// Only include healingBuffs if we have a real value (not the -85 sentinel)
		if (healingBuffs !== -85) {
			progressData.healingBuffs = healingBuffs;
		}
		document.dispatchEvent(new CustomEvent('dungeonProgressUpdated', { detail: progressData }));
		document.dispatchEvent(new CustomEvent('floorChanged', { detail: progressData }));
	}

	this.start = async function (titanit) {
		// SWITCH: If RED engine is not active, do not start
		if (!globalThis.__redActive) {
			console.log('%c[Switch] RED engine is inactive — skipping dungeon start.', 'color: #f0a');
			return;
		}
		maxDungeonActivity = titanit || getInput('countTitanit');
		send(JSON.stringify(callsExecuteDungeon), startDungeon);
	};

	function startDungeon(e) {
		// SWITCH: Mark engine as busy here (this function IS called, unlike this.start)
		unsafeWindow.__engineBusy = true;
		// Questa riga resetta stopDung a false all'inizio di ogni nuova spedizione.
		stopDung = false;
		let res = e.results;
		let dungeonGetInfo = res[0].result.response;
		if (!dungeonGetInfo) {
			endDungeon('noDungeon', res);
			return;
		}
		console.log('Начинаем копать на фулл: ', new Date());
		let teamGetAll = res[1].result.response;
		let teamGetFavor = res[2].result.response;
		dungeonActivity = res[3].result.response.stat.todayDungeonActivity;
		startDungeonActivity = res[3].result.response.stat.todayDungeonActivity;
		countPredictionCard = res[4].result.response.consumable[81];
		titansStates = dungeonGetInfo.states.titans;

		teams.hero = {
			favor: teamGetFavor.dungeon_hero,
			heroes: teamGetAll.dungeon_hero.filter((id) => id < 6000),
			teamNum: 0,
		};
		let heroPet = teamGetAll.dungeon_hero.filter((id) => id >= 6000).pop();
		if (heroPet) {
			teams.hero.pet = heroPet;
		}
		teams.neutral = getTitanTeam('neutral');
		teams.water = {
			favor: {},
			heroes: getTitanTeam('water'),
			teamNum: 0,
		};
		teams.earth = {
			favor: {},
			heroes: getTitanTeam('earth'),
			teamNum: 0,
		};
		teams.fire = {
			favor: {},
			heroes: getTitanTeam('fire'),
			teamNum: 0,
		};

		// SWITCH: Dispatch initial state to Pannello
		dispatchPanelEvents(dungeonGetInfo);
		checkFloor(dungeonGetInfo);
	}

	function getTitanTeam(type) {
		switch (type) {
			case 'neutral':
				// Mantenuta la lista completa per Neutrale (la logica di composizione usa calcFactor)
				return [4023, 4022, 4012, 4021, 4011, 4010, 4020, 4024]; 
			case 'water':
				// CORREZIONE: Filtra solo i Titani posseduti (!!titansStates[e]) e non morti
				return [4000, 4001, 4002, 4003].filter((e) => !!titansStates[e] && !titansStates[e].isDead);
			case 'earth':
				// CORREZIONE: Filtra solo i Titani posseduti (!!titansStates[e]) e non morti
				// Mantenuto 4024 e gli altri della Terra.
				return [4020, 4022, 4021, 4023, 4024].filter((e) => !!titansStates[e] && !titansStates[e].isDead);
			case 'fire':
				// CORREZIONE: Filtra solo i Titani posseduti (!!titansStates[e]) e non morti
				return [4010, 4011, 4012, 4013].filter((e) => !!titansStates[e] && !titansStates[e].isDead);
		}
	}

	function clone(a) {
		return JSON.parse(JSON.stringify(a));
	}

	function findElement(floor, element) {
		for (let i in floor) {
			if (floor[i].attackerType === element) {
				return i;
			}
		}
		return undefined;
	}

	async function checkFloor(dungeonInfo) {
		// SWITCH: Stop if RED engine is deactivated mid-dungeon
		if (!globalThis.__redActive) {
			console.log('%c[Switch] RED engine deactivated mid-dungeon — stopping.', 'color: #f0a');
			saveProgress();
			return;
		}
		if (!('floor' in dungeonInfo) || dungeonInfo.floor?.state == 2) {
			saveProgress();
			return;
		}
		checkTalent(dungeonInfo);
		maxDungeonActivity = getInput('countTitanit');
		setProgress(`${I18N('DUNGEON')}: ${I18N('TITANIT')} ${dungeonActivity}/${maxDungeonActivity} ${talentMsg}`);
		if (dungeonActivity >= maxDungeonActivity) {
			endDungeon('Стоп подземка,', 'набрано титанита: ' + dungeonActivity + '/' + maxDungeonActivity);
			return;
		}
		let activity = dungeonActivity - startDungeonActivity;
		titansStates = dungeonInfo.states.titans;
		// SWITCH: Dispatch updated states to Pannello
		dispatchPanelEvents(dungeonInfo);
		if (stopDung) { // Questo controllo userà la variabile stopDung dichiarata in alto
			endDungeon('Стоп подземка,', 'набрано титанита: ' + dungeonActivity + '/' + maxDungeonActivity);
			return;
		}
		bestBattle = {};
		let floorChoices = dungeonInfo.floor.userData;
		if (floorChoices.length > 1) {
			for (let element in teams) {
				let teamNum = findElement(floorChoices, element);
				if (!!teamNum) {
					if (element == 'earth') {
						teamNum = await chooseEarthOrFire(floorChoices);
						if (teamNum < 0) {
							endDungeon('Невозможно победить без потери Титана!', dungeonInfo);
							return;
						}
					}
					chooseElement(floorChoices[teamNum].attackerType, teamNum);
					return;
				}
			}
		} else {
			chooseElement(floorChoices[0].attackerType, 0);
		}
	}

	async function checkTalent(dungeonInfo) {
		const talent = dungeonInfo.talent;
		if (!talent) {
			return;
		}
		const dungeonFloor = +dungeonInfo.floorNumber;
		const talentFloor = +talent.floorRandValue;
		let doorsAmount = 3 - talent.conditions.doorsAmount;

		if (dungeonFloor === talentFloor && (!doorsAmount || !talent.conditions?.farmedDoors[dungeonFloor])) {
			const reward = await Send({
				calls: [
					{ name: 'heroTalent_getReward', args: { talentType: 'tmntDungeonTalent', reroll: false }, ident: 'group_0_body' },
					{ name: 'heroTalent_farmReward', args: { talentType: 'tmntDungeonTalent' }, ident: 'group_1_body' },
				],
			}).then((e) => e.results[0].result.response);
			const type = Object.keys(reward).pop();
			const itemId = Object.keys(reward[type]).pop();
			const count = reward[type][itemId];
			const itemName = cheats.translate(`LIB_${type.toUpperCase()}_NAME_${itemId}`);
			talentMsgReward += `<br> ${count} ${itemName}`;
			doorsAmount++;
		}
		talentMsg = `<br>TMNT Talent: ${doorsAmount}/3 ${talentMsgReward}<br>`;
	}

	async function chooseEarthOrFire(floorChoices) {
		bestBattle.recovery = -11;
		let selectedTeamNum = -1;
		for (let attempt = 0; selectedTeamNum < 0 && attempt < 4; attempt++) {
			for (let teamNum in floorChoices) {
				let attackerType = floorChoices[teamNum].attackerType;
				selectedTeamNum = await attemptAttackEarthOrFire(teamNum, attackerType, attempt);
			}
		}
		console.log('Выбор команды огня или земли: ', selectedTeamNum < 0 ? 'не сделан' : floorChoices[selectedTeamNum].attackerType);
		return selectedTeamNum;
	}

	async function attemptAttackEarthOrFire(teamNum, attackerType, attempt) {
		let start = new Date();
		let team = clone(teams[attackerType]);
		
        // Mantenuta la modifica per consentire 5 titani per Terra
        let maxTeamSize = (attackerType === 'earth') ? 5 : 4; 
        
		let startIndex = team.heroes.length + attempt - maxTeamSize;
        

		if (startIndex >= 0) {
			team.heroes = team.heroes.slice(startIndex);
			let recovery = await getBestRecovery(teamNum, attackerType, team, 25);
			if (recovery > bestBattle.recovery) {
				bestBattle.recovery = recovery;
				bestBattle.selectedTeamNum = teamNum;
				bestBattle.team = team;
			}
		}
		let workTime = new Date().getTime() - start.getTime();
		timeDungeon.attackEarthOrFire += workTime;
		if (bestBattle.recovery < -10) {
			return -1;
		}
		return bestBattle.selectedTeamNum;
	}

	async function chooseElement(attackerType, teamNum) {
		let result;
		switch (attackerType) {
			case 'hero':
			case 'water':
				result = await startBattle(teamNum, attackerType, teams[attackerType]);
				break;
			case 'earth':
			case 'fire':
				result = await attackEarthOrFire(teamNum, attackerType);
				break;
			case 'neutral':
				result = await attackNeutral(teamNum, attackerType);
		}
		if (!!result && attackerType != 'hero') {
			let recovery = (!!!bestBattle.recovery ? 10 * getRecovery(result) : bestBattle.recovery) * 100;
			let titans = result.progress[0].attackers.heroes;
			console.log('Проведен бой: ' + attackerType + ', recovery = ' + (recovery > 0 ? '+' : '') + Math.round(recovery) + '% \r\n', titans);
		}
		endBattle(result);
	}

	async function attackEarthOrFire(teamNum, attackerType) {
		if (!!!bestBattle.recovery) {
			bestBattle.recovery = -11;
			let selectedTeamNum = -1;
			for (let attempt = 0; selectedTeamNum < 0 && attempt < 4; attempt++) {
				selectedTeamNum = await attemptAttackEarthOrFire(teamNum, attackerType, attempt);
			}
			if (selectedTeamNum < 0) {
				endDungeon('Невозможно победить без потери Титана!', attackerType);
				return;
			}
		}
		return findAttack(teamNum, attackerType, bestBattle.team);
	}

	async function findAttack(teamNum, attackerType, team) {
		let start = new Date();
		let recovery = -1000;
		let iterations = 0;
		let result;
		let correction = 0.01;
		for (let needRecovery = bestBattle.recovery; recovery < needRecovery; needRecovery -= correction, iterations++) {
			result = await startBattle(teamNum, attackerType, team);
			recovery = getRecovery(result);
		}
		bestBattle.recovery = recovery;
		let workTime = new Date().getTime() - start.getTime();
		timeDungeon.findAttack += workTime;
		return result;
	}

	async function attackNeutral(teamNum, attackerType) {
		let start = new Date();
		let factors = calcFactor();
		bestBattle.recovery = -0.2;
		await findBestBattleNeutral(teamNum, attackerType, factors, true);
		if (bestBattle.recovery < 0 || (bestBattle.recovery < 0.2 && factors[0].value < 0.5)) {
			let recovery = 100 * bestBattle.recovery;
			console.log(
				'Не удалось найти удачный бой в быстром режиме: ' +
					attackerType +
					', recovery = ' +
					(recovery > 0 ? '+' : '') +
					Math.round(recovery) +
					'% \r\n',
				bestBattle.attackers
			);
			await findBestBattleNeutral(teamNum, attackerType, factors, false);
		}
		let workTime = new Date().getTime() - start.getTime();
		timeDungeon.attackNeutral += workTime;
		if (!!bestBattle.attackers) {
			let team = getTeam(bestBattle.attackers);
			return findAttack(teamNum, attackerType, team);
		}
		endDungeon('Не удалось найти удачный бой!', attackerType);
		return undefined;
	}

	async function findBestBattleNeutral(teamNum, attackerType, factors, mode) {
		let countFactors = factors.length < 4 ? factors.length : 4;
		let aradgi = !titansStates['4013']?.isDead;
		let edem = !titansStates['4023']?.isDead;
		let dark = [4032, 4033].filter((e) => !titansStates[e]?.isDead);
		let light = [4042].filter((e) => !titansStates[e]?.isDead);
		let actions = [];
		if (mode) {
			for (let i = 0; i < countFactors; i++) {
				actions.push(startBattle(teamNum, attackerType, getNeutralTeam(factors[i].id)));
			}
			if (countFactors > 1) {
				let firstId = factors[0].id;
				let secondId = factors[1].id;
				actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, 4001, secondId)));
				actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, 4002, secondId)));
				actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, 4003, secondId)));
			}
			if (aradgi) {
				actions.push(startBattle(teamNum, attackerType, getNeutralTeam(4013)));
				if (countFactors > 0) {
					let firstId = factors[0].id;
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, 4000, 4013)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, 4001, 4013)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, 4002, 4013)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, 4003, 4013)));
				}
				if (edem) {
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(4023, 4000, 4013)));
				}
			}
		} else {
			if (mode) { // This `if (mode)` block seems to be an error in original logic, as it's within `else` for `mode`
				for (let i = 0; i < factors.length; i++) {
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(factors[i].id)));
				}
			} else {
				countFactors = factors.length < 2 ? factors.length : 2;
			}
			for (let i = 0; i < countFactors; i++) {
				let mainId = factors[i].id;
				if (aradgi && (mode || i > 0)) {
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, 4000, 4013)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, 4001, 4013)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, 4002, 4013)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, 4003, 4013)));
				}
				for (let i = 0; i < dark.length; i++) {
					let darkId = dark[i];
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, 4001, darkId)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, 4002, darkId)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, 4003, darkId)));
				}
				for (let i = 0; i < light.length; i++) {
					let lightId = light[i];
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, 4001, lightId)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, 4002, lightId)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, 4003, lightId)));
				}
				let isFull = mode || i > 0;
				for (let j = isFull ? i + 1 : 2; j < factors.length; j++) {
					let extraId = factors[j].id;
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, 4000, extraId)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, 4001, extraId)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(mainId, 4002, extraId)));
				}
			}
			if (aradgi) {
				if (mode) { // This `if (mode)` block seems to be an error in original logic, as it's within `else` for `mode`
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(4013)));
				}
				for (let i = 0; i < dark.length; i++) {
					let darkId = dark[i];
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(darkId, 4001, 4013)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(darkId, 4002, 4013)));
				}
				for (let i = 0; i < light.length; i++) {
					let lightId = light[i];
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(lightId, 4001, 4013)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(lightId, 4002, 4013)));
				}
			}
			for (let i = 0; i < dark.length; i++) {
				let firstId = dark[i];
				actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId)));
				for (let j = i + 1; j < dark.length; j++) {
					let secondId = dark[j];
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, 4001, secondId)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, 4002, secondId)));
				}
			}
			for (let i = 0; i < light.length; i++) {
				let firstId = light[i];
				actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId)));
				for (let j = i + 1; j < light.length; j++) {
					let secondId = light[j];
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, 4001, secondId)));
					actions.push(startBattle(teamNum, attackerType, getNeutralTeam(firstId, 4002, secondId)));
				}
			}
		}
		for (let result of await Promise.all(actions)) {
			let recovery = getRecovery(result);
			if (recovery > bestBattle.recovery) {
				bestBattle.recovery = recovery;
				bestBattle.attackers = result.progress[0].attackers.heroes;
			}
		}
	}

	function getNeutralTeam(id, swapId, addId) {
		let neutralTeam = clone(teams.water);
		let neutral = neutralTeam.heroes;
		if (neutral.length == 4) {
			if (!!swapId) {
				for (let i in neutral) {
					if (neutral[i] == swapId) {
						neutral[i] = addId;
					}
				}
			}
		} else if (!!addId) {
			neutral.push(addId);
		}
		neutral.push(id);
		return neutralTeam;
	}

	function getTeam(titans) {
		return {
			favor: {},
			heroes: Object.keys(titans).map((id) => parseInt(id)),
			teamNum: 0,
		};
	}

	function calcFactor() {
		let neutral = teams.neutral;
		let factors = [];
		for (let i in neutral) {
			let titanId = neutral[i];
            // Controllo se il titano esiste in titansStates, altrimenti lo ignora
            if (!titansStates[titanId]) {
                continue;
            }
			let titan = titansStates[titanId];
			let factor = !!titan ? titan.hp / titan.maxHp + titan.energy / 10000.0 : 1;
			if (factor > 0) {
				factors.push({ id: titanId, value: factor });
			}
		}
		factors.sort(function (a, b) {
			return a.value - b.value;
		});
		return factors;
	}

	async function getBestRecovery(teamNum, attackerType, team, countBattle) {
		let bestRecovery = -1000;
		let actions = [];
		for (let i = 0; i < countBattle; i++) {
			actions.push(startBattle(teamNum, attackerType, team));
		}
		for (let result of await Promise.all(actions)) {
			let recovery = getRecovery(result);
			if (recovery > bestRecovery) {
				bestRecovery = recovery;
			}
		}
		return bestRecovery;
	}

	function getRecovery(result) {
		if (result.result.stars < 3) {
			return -100;
		}
		let beforeSumFactor = 0;
		let afterSumFactor = 0;
		let beforeTitans = result.battleData.attackers;
		let afterTitans = result.progress[0].attackers.heroes;
		for (let i in afterTitans) {
			let titan = afterTitans[i];
			let percentHP = titan.hp / beforeTitans[i].hp;
			let energy = titan.energy;
			let factor = checkTitan(i, energy, percentHP) ? getFactor(i, energy, percentHP) : -100;
			afterSumFactor += factor;
		}
		for (let i in beforeTitans) {
			let titan = beforeTitans[i];
			let state = titan.state;
			beforeSumFactor += !!state ? getFactor(i, state.energy, state.hp / titan.hp) : 1;
		}
		return afterSumFactor - beforeSumFactor;
	}

	function checkTitan(id, energy, percentHP) {
        const minOverallHP = titanHealthSettings.minOverallHP;

        if (percentHP < minOverallHP) {
            return false;
        }

        switch (id) {
            case '4020':
                return percentHP > titanHealthSettings.titan4020HP || (energy == 1000 && percentHP > titanHealthSettings.titan4020EnergyHP);
            case '4010':
                return percentHP + energy / 2000.0 > titanHealthSettings.titan4010Combined;
            case '4000':
                return percentHP > titanHealthSettings.titan4000HP || (energy < 1000 && ((percentHP > titanHealthSettings.titan4000Energy400HP && energy >= 400) || (percentHP > titanHealthSettings.titan4000Energy670HP && energy >= 670)));
            case '4024':
                return true;
        }
        return true;
    }

    function getFactor(id, energy, percentHP) {
        if (percentHP < 0.05) {
            return -100;
        }
        const currentSettings = titanHealthSettings;

        switch (id) {
            case '4020':
                return percentHP * 0.7 + (energy / 1000) * 0.3;
            case '4010':
                return percentHP * 0.5 + (energy / 1000) * 0.5;
            case '4000':
                return percentHP * 0.8 + (energy / 1000) * 0.2;
            default:
                return percentHP;
        }
    }

	function startBattle(teamNum, attackerType, args) {
		return new Promise(function (resolve, reject) {
			args.teamNum = teamNum;
			let startBattleCall = {
				calls: [
					{
						name: 'dungeonStartBattle',
						args,
						ident: 'body',
					},
				],
			};
			send(JSON.stringify(startBattleCall), resultBattle, {
				resolve,
				teamNum,
				attackerType,
			});
		});
	}

	function resultBattle(resultBattles, args) {
		// CORREZIONE: Aggiungi un controllo per assicurare che la risposta non sia un errore.
        if (!resultBattles || !resultBattles.results || resultBattles.results.length === 0 || !resultBattles.results[0].result || resultBattles.results[0].result.error) {
            console.error('Battle failed, results missing or contained error:', resultBattles);
            // Simula un risultato di battaglia fallito (ad esempio 0 stelle) per fermare il dungeon
            const failedResult = {
                result: { stars: 0, win: false },
                progress: [{ attackers: { heroes: {} } }],
                battleData: { attackers: {} },
                teamNum: args.teamNum,
                attackerType: args.attackerType
            };
            args.resolve(failedResult);
            return;
        }

		battleData = resultBattles.results[0].result.response;
		// Extract healing buff from dungeonStartBattle API response (same path as Evo1)
		if (battleData.effects?.defenders?.percentBuffAllEnemy_healing !== undefined) {
			unsafeWindow._lastHealingBuff = battleData.effects.defenders.percentBuffAllEnemy_healing;
		}
		battleType = 'get_tower';
		if (battleData.type == 'dungeon_titan') {
			battleType = 'get_titan';
		}
		battleData.progress = [{ attackers: { input: ['auto', 0, 0, 'auto', 0, 0] } }];
		BattleCalc(battleData, battleType, function (result) {
			result.result = result.result || { stars: 3 }; // Assicurati che result.result esista
            if (result.result.stars < 3) {
                console.warn("BattleCalc returned less than 3 stars. Treating as fail.");
            }
            
			result.teamNum = args.teamNum;
			result.attackerType = args.attackerType;
			args.resolve(result);
		});
	}

	async function endBattle(battleInfo) {
        // Aggiunto controllo per il fallimento simulato in resultBattle
        if (!battleInfo || battleInfo.result.stars < 3) {
            endDungeon('Герой или Титан мог погибнуть в бою / Errore durante l\'attacco!', battleInfo);
            return;
        }

		if (!!battleInfo) {
			const args = {
				result: battleInfo.result,
				progress: battleInfo.progress,
			};
			
			if (countPredictionCard > 0) {
				args.isRaid = true;
				countPredictionCard--;
			} else {
				const timer = getTimer(battleInfo.battleTime);
				console.log(timer);
				await countdownTimer(timer, `${I18N('DUNGEON')}: ${I18N('TITANIT')} ${dungeonActivity}/${maxDungeonActivity} ${talentMsg}`);
			}
			const calls = [
				{
					name: 'dungeonEndBattle',
					args,
					ident: 'body',
				},
			];
			lastDungeonBattleData = null;
			send(JSON.stringify({ calls }), resultEndBattle);
		} else {
			endDungeon('dungeonEndBattle win: false\n', battleInfo);
		}
	}
	function resultEndBattle(e) {
		if (!!e && !!e.results) {
			let battleResult = e.results[0].result.response;
			if ('error' in battleResult) {
				// Don't stop — progress to next floor (battle already consumed)
				saveProgress();
				return;
			}
			let dungeonGetInfo = battleResult.dungeon ?? battleResult;
			dungeonActivity += battleResult.reward.dungeonActivity ?? 0;
			checkFloor(dungeonGetInfo);
		} else {
			endDungeon('Потеряна связь с сервером игры!', 'break');
		}
	}

	function addTeam(team) {
		for (let i in countTeam) {
			if (equalsTeam(countTeam[i].team, team)) {
				countTeam[i].count++;
				return;
			}
		}
		countTeam.push({ team: team, count: 1 });
	}

	function equalsTeam(team1, team2) {
		if (team1.length == team2.length) {
			for (let i in team1) {
				if (team1[i] != team2[i]) {
					return false;
				}
			}
			return true;
		}
		return false;
	}

	function saveProgress() {
		unsafeWindow.__engineBusy = false;
		let saveProgressCall = {
			calls: [
				{
					name: 'dungeonSaveProgress',
					args: {},
					ident: 'body',
				},
			],
		};
		send(JSON.stringify(saveProgressCall), resultEndBattle);
	}

	function showStats() {
		let activity = dungeonActivity - startDungeonActivity;
		let workTime = clone(timeDungeon);
		workTime.all = new Date().getTime() - workTime.all;
		for (let i in workTime) {
			workTime[i] = Math.round(workTime[i] / 1000);
		}
		countTeam.sort(function (a, b) {
			return b.count - a.count;
		});
		console.log(titansStates);
		console.log('Собрано титанита: ', activity);
		console.log('Скорость сбора: ' + Math.round((3600 * activity) / workTime.all) + ' титанита/час');
		console.log('Время раскопок: ');
		for (let i in workTime) {
			let timeNow = workTime[i];
			console.log(
				i + ': ',
				Math.round(timeNow / 3600) + ' ч. ' + Math.round((timeNow % 3600) / 60) + ' мин. ' + (timeNow % 60) + ' сек.'
			);
		}
		console.log('Частота использования команд: ');
		for (let i in countTeam) {
			let teams = countTeam[i];
			console.log(teams.team + ': ', teams.count);
		}
	}

	function endDungeon(reason, info) {
		unsafeWindow.__engineBusy = false;
		if (!end) {
			end = true;
			console.log(reason, info);
			showStats();
			if (info == 'break') {
				setProgress(
					'Dungeon stoped: Титанит ' + dungeonActivity + '/' + maxDungeonActivity + '\r\nПотеряна связь с сервером игры!',
					false,
					hideProgress
				);
			} else {
				setProgress('Dungeon completed: Титанит ' + dungeonActivity + '/' + maxDungeonActivity, false, hideProgress);
			}

        if (titanHealthSettings.autoRefreshPage) {
            // Sostituisci cheats.refreshGame con location.reload()
            setTimeout(() => {
                location.reload();
            }, 1000); // Ritardo di 1 secondo per sicurezza
        }

        resolve();
		}
	}
}

this.HWHClasses.executeDungeon = executeDungeon;

function createGUI() {
    GM_addStyle(`
        #titanSettingsGUI {
            position: fixed;
            top: 50px;
            right: 10px;
            width: 280px;
            background-color: rgba(0, 0, 0, 0.85);
            border: 1px solid #444;
            border-radius: 10px;
            padding: 15px 20px;
            color: #E0E0E0;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
            display: flex;
            flex-direction: column;
            gap: 12px;
            transition: all 0.3s ease-in-out;
            max-height: calc(100vh - 70px);
            overflow-y: auto;
        }
        #titanSettingsGUI h3 {
            margin-top: 0;
            color: #FFD700;
            text-align: center;
            font-size: 18px;
            border-bottom: 1px solid #555;
            padding-bottom: 8px;
            margin-bottom: 15px;
        }
        #titanSettingsGUI h4 {
            margin-top: 5px;
            margin-bottom: 8px;
            color: #87CEEB;
            font-size: 15px;
            text-align: center;
        }
        #titanSettingsGUI label {
            display: block;
            margin-bottom: 4px;
            color: #ADD8E6;
            font-weight: bold;
        }
        #titanSettingsGUI input[type="number"] {
            width: calc(100% - 22px);
            padding: 9px 10px;
            margin-bottom: 10px;
            border: 1px solid #666;
            border-radius: 5px;
            background-color: #2a2a2a;
            color: white;
            box-sizing: border-box;
            font-size: 14px;
            -moz-appearance: textfield;
        }
        #titanSettingsGUI input[type="number"]::-webkit-outer-spin-button,
        #titanSettingsGUI input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        #titanSettingsGUI input[type="number"]:focus {
            outline: none;
            border-color: #FFD700;
            box-shadow: 0 0 5px rgba(255, 215, 0, 0.5);
        }
        #titanSettingsGUI button {
            background-color: #32CD32;
            color: white;
            padding: 10px 15px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: background-color 0.3s ease, transform 0.1s ease;
            margin-top: 10px;
        }
        #titanSettingsGUI button:hover {
            background-color: #228B22;
            transform: translateY(-1px);
        }
        #titanSettingsGUI button:active {
            transform: translateY(0);
        }
        #resetTitanSettings {
            background-color: #FF6347;
            width: fit-content;
            margin: 10px auto;
            display: block;
            padding: 8px 12px;
            font-size: 14px;
            border-radius: 5px;
            transition: background-color 0.3s ease;
        }
        #resetTitanSettings:hover {
            background-color: #E63946;
        }
    `);

    const resetButton = document.createElement('button');
    resetButton.id = 'resetTitanSettings';
    resetButton.textContent = 'Ripristina Valori Predefiniti';
    document.body.appendChild(resetButton);

    const gui = document.createElement('div');
    gui.id = 'titanSettingsGUI';
    gui.innerHTML = `
        <h3>dungeon cutoff settings</h3>
        <div>
            <input type="checkbox" id="autoRefreshPage">
            <label for="autoRefreshPage">Refresh(F5) after dungeon</label>
        </div>
        <div>
            <label for="minOverallHP">General Thresholds (%) (>=30):</label>
            <input type="number" id="minOverallHP" min="0" max="100" step="1">
        </div>
        <h4>Titan 4020 - Agnus</h4>
        <div>
            <label for="titan4020HP"> Minumum HP (%) (>=25):</label>
            <input type="number" id="titan4020HP" min="0" max="100" step="1">
        </div>
        <div>
            <label for="titan4020EnergyHP">Minimum HP with Max Energy (%) (>=5):</label>
            <input type="number" id="titan4020EnergyHP" min="0" max="100" step="1">
        </div>
        <h4>Titano 4010 - Moloch</h4>
        <div>
            <label for="titan4010Combined">HP + Energy combined (%) (>=63):</label>
            <input type="number" id="titan4010Combined" min="0" max="200" step="1">
        </div>
        <h4>Titano 4000 - Sigurd</h4>
        <div>
            <label for="titan4000HP">Minumum HP (%) (>=62):</label>
            <input type="number" id="titan4000HP" min="0" max="100" step="1">
        </div>
        <div>
            <label for="titan4000Energy400HP">Minumum HP With Energy >= 400 (%) (>=45):</label>
            <input type="number" id="titan4000Energy400HP" min="0" max="100" step="1">
        </div>
        <div>
            <label for="titan4000Energy670HP">Minumum HP With Energy >= 670 (%) (>=30):</label>
            <input type="number" id="titan4000Energy670HP" min="0" max="100" step="1">
        </div>
        <button id="saveTitanSettings">Save & Apply</button>
    `;
    document.body.appendChild(gui);

    gui.style.display = 'none';
    resetButton.style.display = 'none';

    function updateGUIFields() {
        document.getElementById('minOverallHP').value = titanHealthSettings.minOverallHP * 100;
        document.getElementById('titan4020HP').value = titanHealthSettings.titan4020HP * 100;
        document.getElementById('titan4020EnergyHP').value = titanHealthSettings.titan4020EnergyHP * 100;
        document.getElementById('titan4010Combined').value = titanHealthSettings.titan4010Combined * 100;
        document.getElementById('titan4000HP').value = titanHealthSettings.titan4000HP * 100;
        document.getElementById('titan4000Energy400HP').value = titanHealthSettings.titan4000Energy400HP * 100;
        document.getElementById('titan4000Energy670HP').value = titanHealthSettings.titan4000Energy670HP * 100;
		document.getElementById('autoRefreshPage').checked = titanHealthSettings.autoRefreshPage;
    }

    updateGUIFields();

    document.getElementById('saveTitanSettings').addEventListener('click', () => {
        titanHealthSettings.minOverallHP = parseFloat(document.getElementById('minOverallHP').value) / 100;
        titanHealthSettings.titan4020HP = parseFloat(document.getElementById('titan4020HP').value) / 100;
        titanHealthSettings.titan4020EnergyHP = parseFloat(document.getElementById('titan4020EnergyHP').value) / 100;
        titanHealthSettings.titan4010Combined = parseFloat(document.getElementById('titan4010Combined').value) / 100;
        titanHealthSettings.titan4000HP = parseFloat(document.getElementById('titan4000HP').value) / 100;
        titanHealthSettings.titan4000Energy400HP = parseFloat(document.getElementById('titan4000Energy400HP').value) / 100;
        titanHealthSettings.titan4000Energy670HP = parseFloat(document.getElementById('titan4000Energy670HP').value) / 100;
        titanHealthSettings.autoRefreshPage = document.getElementById('autoRefreshPage').checked;
        saveSettings();
        alert('Impostazioni salvate!');
    });

    resetButton.addEventListener('click', () => {
        if (confirm('Sei sicuro di voler ripristinare i valori predefiniti?')) {
            titanHealthSettings = Object.assign({}, defaultTitanHealthSettings);
            saveSettings();
            updateGUIFields();
            alert('Valori ripristinati con successo!');
        }
    });

        const inputs = gui.querySelectorAll('input[type="number"], input[type="checkbox"]');
        inputs.forEach(input => {
        input.addEventListener('change', () => {
        const id = input.id;
        if (titanHealthSettings.hasOwnProperty(id)) {
            if (input.type === 'checkbox') {
                titanHealthSettings[id] = input.checked;
            } else {
                titanHealthSettings[id] = parseFloat(input.value) / 100;
            }
        }
        saveSettings();
    });
});

    if (dungeonModeIndicator && gui && resetButton) {
        dungeonModeIndicator.addEventListener('click', () => {
            if (gui.style.display === 'none') {
                gui.style.display = 'flex';
                resetButton.style.display = 'block';
                clickMessage.textContent = 'click to hide';
            } else {
                gui.style.display = 'none';
                resetButton.style.display = 'none';
                clickMessage.textContent = 'click to show';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', createGUI);

})();
