// ==UserScript==
// @name             HWHAutoSkillsExt
// @name:en          HWHAutoSkillsExt
// @name:ru          HWHAutoSkillsExt
// @namespace        HWHAutoSkillsExt
// @version          1.1.1
// @description      Extension for HeroWarsHelper script - Auto Skills Improvement Only
// @description:en   Extension for HeroWarsHelper script - Auto Skills Improvement Only
// @description:ru   Расширение для скрипта HeroWarsHelper - Только автопрокачка умений
// @author           Green (Extracted)
// @match            https://www.hero-wars.com/*
// @match            https://apps-1701433570146040.apps.fbsbx.com/*
// @run-at           document-start
// @grant            none
// ==/UserScript==

(async function () {
	if (!this.HWHClasses) {
		console.log('%cObject for extension not found', 'color: red');
		return;
	}

    console.log('%cStart Extension ' + GM_info.script.name + ', v' + GM_info.script.version + ' by ' + GM_info.script.author, 'color: red');
    const { addExtentionName } = HWHFuncs;

    addExtentionName(GM_info.script.name, GM_info.script.version, GM_info.script.author);

    const { othersPopupButtons, i18nLangData } = HWHData;
    const { popup, confShow, setSaveVal, getSaveVal, I18N, Events, setProgress, hideProgress } = HWHFuncs;

    const i18nLangDataEn = {
        IS_IMPROVING_SKILLS: 'Skills Improvement',
        IS_IMPROVING_SKILLS_TITLE: 'Automatic Skills Improvement',
        IS_IMPROVING_SKILLS_MESSAGE: `To enable automatic skills improvement, you need to select heroes and turn on automatic improvement.
          The script will notify you when the skills for selected heroes are upgraded to the maximum available level. The order of heroes for improvement is determined by ID.
          <br><br>The first skills improvement occurs during game loading. If you turn on a timer, repeated improvements will occur every hour.
          <br><br><span style='color: Lime;'>When automatic improvement is disabled, skills won't be upgraded regardless of the timer status</span>
          <br><br>You need to reload the game to apply changes`,
        IS_TURN_ON_SKILL_IMPROVEMENT: 'Turn On',
        IS_TURN_ON_SKILL_IMPROVEMENT_TITLE: 'Turn on automatic skills improvement',
        IS_TURN_ON_SKILL_IMPROVEMENT_MESSAGE: 'Automatic skills improvement is enabled',
        IS_TURN_OFF_SKILL_IMPROVEMENT: 'Turn Off',
        IS_TURN_OFF_SKILL_IMPROVEMENT_TITLE: 'Turn off automatic skills improvement',
        IS_TURN_OFF_SKILL_IMPROVEMENT_MESSAGE: 'Automatic skills improvement is disabled',
        IS_HEROES: 'Heroes',
        IS_HEROES_TITLE: 'Select heroes for skills improvement',
        IS_SELECT_HEROES: 'Select heroes<br>to improve their skills',
        IS_HAVE_NO_HEROES: 'You have no heroes that can improve their skills',
        IS_NO_HEROES_SELECTED: 'Automatic skills improvement is enabled, but no heroes are selected.<br>Select heroes or disable automatic improvement.',
        IS_IMPROVING_SKILLS_RESULT: 'Hero skills improved <span style="color: Lime;">{skillPointsSpent}</span> times',
        IS_SKILLS_IMPROVED_TO_MAXIMUM_LEVEL: 'Maximum available hero skill level reached. Improve current heroes or select different ones',
        IS_NOT_ENOUGH_GOLD: 'Not enough gold to further improve hero skills',
        IS_TURN_ON_TIMER: 'Enable Timer',
        IS_TURN_ON_TIMER_MESSAGE: 'Hourly automatic skills improvement activated',
        IS_TURN_OFF_TIMER: 'Disable Timer',
        IS_TURN_OFF_TIMER_MESSAGE: 'Hourly automatic skills improvement deactivated',
        IS_TURN_ON_TIMER_TITLE: 'Turn on hourly automatic skills improvement',
        IS_TURN_OFF_TIMER_TITLE: 'Turn off hourly automatic skills improvement',
        IS_IMPROVING_SKILLS_TIMER_RESULT: `Hero skills improved <span style="color: Lime;">{skillPointsSpent}</span> times <br> Next upgrade in 1 hour`,
        HB_APPLY: 'Apply',
        BTN_CANCEL: 'Cancel'
    };

    i18nLangData['en'] = Object.assign(i18nLangData['en'], i18nLangDataEn);

    const i18nLangDataRu = {
        IS_IMPROVING_SKILLS: 'Улучшение умений',
        IS_IMPROVING_SKILLS_TITLE: 'Автоматическое улучшение умений героев',
        IS_IMPROVING_SKILLS_MESSAGE: `Для автоматического улучшения умений необходимо выбрать героев, и включить автоматическое улучшение.
          Скрипт оповестит, когда умения для выбранных героев будут улучшены до максимально доступного уровня. Очередность героев для улучшения определяется по Id.
          <br> <br> Первое улучшение умений происходит во время загрузки игры.
          Если добавить таймер, то повторное улучшение умений будет происходить каждый час.
          <br> <br> <span style="color: Lime;">При выключении автоматического улучшения умения не улучшаются, независимо от состояния таймера</span>
          <br> <br> Для применения изменений необходимо перезагрузить игру`,
        IS_TURN_ON_SKILL_IMPROVEMENT: 'Включить',
        IS_TURN_ON_SKILL_IMPROVEMENT_TITLE: 'Включить автоматическое улучшение умений',
        IS_TURN_ON_SKILL_IMPROVEMENT_MESSAGE: 'Автоматическое улучшение  умений включено',
        IS_TURN_OFF_SKILL_IMPROVEMENT: 'Выключить',
        IS_TURN_OFF_SKILL_IMPROVEMENT_TITLE: 'Выключить автоматическое улучшение умений',
        IS_TURN_OFF_SKILL_IMPROVEMENT_MESSAGE: 'Автоматическое улучшение умений выключено',
        IS_HEROES: 'Герои',
        IS_HEROES_TITLE: 'Выбрать героев для улучшения умений',
        IS_SELECT_HEROES: 'Выберите героев, <br> которым улучшать умения',
        IS_HAVE_NO_HEROES: 'У Вас нет героев, которым можно улучшить умения',
        IS_NO_HEROES_SELECTED: 'Автоматическое улучшение умений включено, но герои не выбраны. <br>Выберите героев или выключите автоматическое улучшение уменийА.',
        IS_IMPROVING_SKILLS_RESULT: 'Умения героев улучшены <span style="color: Lime;">{skillPointsSpent}</span> раз',
        IS_SKILLS_IMPROVED_TO_MAXIMUM_LEVEL: 'Достигнут максимальный доступный уровень умений героев. Улучшите текущих героев или выберите других',
        IS_NOT_ENOUGH_GOLD: 'Для дальнейшего улучшения умений героя недостаточно золота',
        IS_TURN_ON_TIMER: 'Добавить таймер',
        IS_TURN_ON_TIMER_MESSAGE: 'Автоматическое улучшение умений каждый час включено',
        IS_TURN_OFF_TIMER: 'Убрать таймер',
        IS_TURN_OFF_TIMER_MESSAGE: 'Автоматическое улучшение умений каждый час выключено',
        IS_TURN_ON_TIMER_TITLE: 'Включить автоматическое улучшение умений каждый час',
        IS_TURN_OFF_TIMER_TITLE: 'Выключить автоматическое улучшение умений каждый час',
        IS_IMPROVING_SKILLS_TIMER_RESULT: `Умения героев улучшены <span style="color: Lime;">{skillPointsSpent}</span> раз
          <br> Следующее улучшение умений через час`,
        HB_APPLY: 'Применить',
        BTN_CANCEL: 'Отмена'
    };

    i18nLangData['ru'] = Object.assign(i18nLangData['ru'], i18nLangDataRu);

    let automaticSkillImprovement = false;
    let automaticSkillImprovementTimer = false;

    Events.on('startGame', async () => {
        automaticSkillImprovement = getSaveVal('automaticSkillImprovement', false);
        automaticSkillImprovementTimer = getSaveVal('automaticSkillImprovementTimer', false);
        if (automaticSkillImprovement) {
            await automaticallyImproveHeroesSkills();
            if (automaticSkillImprovementTimer) {
                for (let i = 1; i <= 6; i++){
                    const startTime = Date.now();
                    const hour = 57 * 60 * 1000; // 57 minutes in ms
                    while (Date.now() - startTime < hour) {
                        await new Promise((e) => setTimeout(e, 60000)); // 60s timeout
                        console.log('Time passed:', Math.round((Date.now() - startTime) / 1000), 'sec');
                    }
                    let stopTheTimer = await automaticallyImproveHeroesSkills();
                    if (stopTheTimer) {
                        console.log("Skill improvement timer stopped");
                        break;
                    }
                }
            }
        }
    });

    othersPopupButtons.push({
        get msg() {
            return I18N('IS_IMPROVING_SKILLS');
        },
        get title() {
            return I18N('IS_IMPROVING_SKILLS_TITLE');
        },
        result: async function () {
			await onClickImprovingSkillss();
		},
		color: 'pink',
	});

    async function onClickImprovingSkillss() {
        let isClosed = false;
        while (!isClosed) {
            automaticSkillImprovement = getSaveVal('automaticSkillImprovement', false);
            let colorButton = 'green';
            if (!automaticSkillImprovement) {
                colorButton = 'graphite';
            }
            automaticSkillImprovementTimer = getSaveVal('automaticSkillImprovementTimer', false);
            let timerButtonColor = 'green';
            if (!automaticSkillImprovementTimer) {
                timerButtonColor = 'graphite';
            }
            const popupButtons = [
                {
                    get msg() {
                        if (automaticSkillImprovement) {
                            return I18N('IS_TURN_OFF_SKILL_IMPROVEMENT');
                        }
                        return I18N('IS_TURN_ON_SKILL_IMPROVEMENT');
                    },
                    get title() {
                        if (automaticSkillImprovement) {
                            return I18N('IS_TURN_OFF_SKILL_IMPROVEMENT_TITLE');
                        }
                        return I18N('IS_TURN_ON_SKILL_IMPROVEMENT_TITLE');
                    },
                    result: async function () {
                        let msg = '';
                        if (automaticSkillImprovement) {
                            automaticSkillImprovement = false;
                            msg = I18N('IS_TURN_OFF_SKILL_IMPROVEMENT_MESSAGE');
                        } else {
                            automaticSkillImprovement = true;
                            msg = I18N('IS_TURN_ON_SKILL_IMPROVEMENT_MESSAGE');
                        }
                        setSaveVal('automaticSkillImprovement', automaticSkillImprovement);
                        confShow(msg);
                        return;
                    },
                    color: colorButton,
                },
                {
                    get msg() {
                        if (automaticSkillImprovementTimer) {
                            return I18N('IS_TURN_OFF_TIMER');
                        }
                        return I18N('IS_TURN_ON_TIMER');
                    },
                    get title() {
                        if (automaticSkillImprovementTimer) {
                            return I18N('IS_TURN_OFF_TIMER_TITLE');
                        }
                        return I18N('IS_TURN_ON_TIMER_TITLE');
                    },
                    result: async function () {
                        let msg = '';
                        if (automaticSkillImprovementTimer) {
                            automaticSkillImprovementTimer = false;
                            msg = I18N('IS_TURN_OFF_TIMER_MESSAGE');
                        } else {
                            automaticSkillImprovementTimer = true;
                            msg = I18N('IS_TURN_ON_TIMER_MESSAGE');
                        }
                        setSaveVal('automaticSkillImprovementTimer', automaticSkillImprovementTimer);
                        confShow(msg);
                        return;
                    },
                    color: timerButtonColor,
                },
                {
                    get msg() {
                        return I18N('IS_HEROES');
                    },
                    get title() {
                        return I18N('IS_HEROES_TITLE');
                    },
                    result: async function () {
                        await selectHeroes();
                    },
                },
            ];
            popupButtons.push({ result: false, isClose: true });
            const answer = await popup.confirm(`${I18N('IS_IMPROVING_SKILLS_MESSAGE')}`, popupButtons);
            if (typeof answer === 'function') {
                await answer();
            } else {
                isClosed = true;
            }
        }
    };

    async function automaticallyImproveHeroesSkills() {
        let stopTheTimer = false;
        let selectedHeroIdsForImprovement = getSaveVal('selectedHeroIdsForImprovement', []);
        if (selectedHeroIdsForImprovement.length == 0) {
            confShow(I18N('IS_NO_HEROES_SELECTED'));
            stopTheTimer = true;
            return stopTheTimer;
        }
        const [heroes, user] = await Caller.send(['heroGetAll', 'userGetInfo']);
        let skillPoints = user.refillable[1].amount;
        let skillPointsStart = skillPoints;
        let gold = user.gold;
        let notEnoughGold = false;
        if (skillPoints < 3) {
            stopTheTimer = false;
            return stopTheTimer;
        }
        const colors = [1, 2, 4, 7];
        for (let heroId of selectedHeroIdsForImprovement) {
            if (skillPoints == 0 || notEnoughGold) {
                break;
            }
            let skills = getHeroSkills(Number(heroId));
            let heroLvl = heroes[heroId].level;
            let heroColor = heroes[heroId].color;
            for (let skill of skills) {
                let skillLvl = heroes[heroId].skills[skill];
                if (heroColor < colors[skills.indexOf(skill)] || skillPoints == 0 || notEnoughGold) {
                    break;
                }
                if (skillLvl == heroLvl) {
                    continue;
                }
                let calls = [];
                while (skillPoints > 0){
                    if (skillLvl == heroLvl) {
                        break;
                    }
                    let nextLevelSkillCost = lib.data.level.skillLevelCost[skillLvl+1].tierCost[1];
                    if (gold > nextLevelSkillCost) {
                        calls.push({name: 'heroUpgradeSkill', args: {heroId: heroId, skill: skills.indexOf(skill)+1}});
                        gold -= nextLevelSkillCost;
                        skillLvl ++;
                        skillPoints --;
                    } else {
                        notEnoughGold = true;
                        break;
                    }
                }
                if (calls.length >= 1) {
                    await Caller.send(calls);
                }
            }
        }
        if (skillPoints < skillPointsStart) {
            await new Promise((e) => setTimeout(e, 4000));
            if (automaticSkillImprovementTimer) {
                setProgress(I18N('IS_IMPROVING_SKILLS_TIMER_RESULT', {skillPointsSpent: skillPointsStart - skillPoints}), false, hideProgress);
                console.log("%cHero skills have been improved: " + (skillPointsStart - skillPoints), "color: red; font-weight: bold;");
            } else {
                setProgress(I18N('IS_IMPROVING_SKILLS_RESULT', {skillPointsSpent: skillPointsStart - skillPoints}), false, hideProgress);
                console.log("%cHero skills have been improved: " + (skillPointsStart - skillPoints), "color: red; font-weight: bold;");
            }
        }
        if (notEnoughGold) {
            confShow(I18N('IS_NOT_ENOUGH_GOLD'));
            stopTheTimer = true;
            return stopTheTimer;
        }
        if (skillPoints > 0) {
            confShow(I18N('IS_SKILLS_IMPROVED_TO_MAXIMUM_LEVEL'));
            stopTheTimer = true;
            return stopTheTimer;
        }
    }

    async function selectHeroes() {
        let heroes = await getAllHeroesWithoutMaxSkills();
        if (heroes.length == 0) {
            confShow(I18N('IS_HAVE_NO_HEROES'));
            return;
        }
        let selectedHeroIdsForImprovement = getSaveVal('selectedHeroIdsForImprovement', []);
        let newListHeroIds = [];
        if (selectedHeroIdsForImprovement.length > 0){
            for (let hero of heroes) {
                let newHero = true;
                for (let heroId of selectedHeroIdsForImprovement) {
                    if (hero.id == Number(heroId)) {
                        newListHeroIds.push({
                            name: hero.id,
                            label: cheats.translate(`LIB_HERO_NAME_${hero.id}`),
                            checked: true,
                        });
                        newHero = false;
                        break;
                    }
                }
                if (newHero) {
                    newListHeroIds.push({
                        name: hero.id,
                        label: cheats.translate(`LIB_HERO_NAME_${hero.id}`),
                        checked: false,
                    });
                }
            }
        }

        if (selectedHeroIdsForImprovement.length == 0){
            for (let hero of heroes) {
                newListHeroIds.push({
                    name: hero.id,
                    label: cheats.translate(`LIB_HERO_NAME_${hero.id}`),
                    checked: false,
                });
            }
        }
        newListHeroIds = newListHeroIds.sort((a, b) => a.label.localeCompare(b.label));
        let answer = await popup.confirm(
            I18N('IS_SELECT_HEROES') + `<style>.PopUp_checkboxes { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; text-align: left; margin: 0 auto; gap: 5px; }</style>`,
            [
                { msg: I18N('HB_APPLY'), result: true, color: 'green' },
                { msg: I18N('BTN_CANCEL'), result: false, isCancel: true, color: 'red' },
            ],
            newListHeroIds
        );
        if (!answer) {
            return;
        }
        const taskList = popup.getCheckBoxes();
        selectedHeroIdsForImprovement = [];
        for (let hero of taskList) {
            if (hero.checked == true) {
                selectedHeroIdsForImprovement.push(hero.name);
            }
        }
        setSaveVal('selectedHeroIdsForImprovement', selectedHeroIdsForImprovement);
    }

    async function getAllHeroesWithoutMaxSkills() {
        const colors = [1, 2, 4, 7];
        const skillLib = lib.getData('skill');

        let result = await Caller.send('heroGetAll');
        let heroGetAll = Object.values(result);
        let heroes = heroGetAll;
        for (let hero of heroGetAll) {
            const heroLvl = hero.level;
            const heroColor = hero.color;
            let allSkillsLvl = [];
            for (let skillId in hero.skills) {
                const tier = skillLib[skillId].tier;
                if (heroColor < colors[tier] || tier < 1 || tier > 4) {
                    continue;
                }
                allSkillsLvl.push(hero.skills[skillId]);
            }
            if (allSkillsLvl.length != 4){
                continue;
            }
            if (allSkillsLvl.every((e) => e == 130)){
                heroes = heroes.filter((e) => e.id != hero.id);
            }
        }
        return heroes;
    }

    function getHeroSkills(heroId) {
        const skils = Object.values(lib.getData('skill'))
        .filter((e) => e.hero === heroId &&
                e.tier >= 1 &&
                e.tier <= 4 &&
                e.disabled == null
               ).sort((a, b) => a.tier - b.tier).map((e) => e.id);
        return skils;
    }

})();
