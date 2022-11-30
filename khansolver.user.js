// ==UserScript==
// @name         Khan Solver
// @version      2.0
// @downloadURL  https://raw.githubusercontent.com/0mlml/khansolver/main/script.js
// @updateURL    https://raw.githubusercontent.com/0mlml/khansolver/main/script.js
// @description  solve khan academy so i dont have to do it myself
// @require      https://cdn.jsdelivr.net/npm/katex@0.15.3/dist/katex.min.js
// @require      https://cdn.jsdelivr.net/npm/katex@0.15.3/dist/contrib/auto-render.min.js
// @author       0mlml
// @match        https://www.khanacademy.org/*
// @grant        none
// ==/UserScript==

(() => {
    'use strict';
    const config = {
        enableKatex: {
            key: 'khansolver_dokatex',
            type: 'checkbox',
            helptext: 'Enable KaTeX rendering',
            value: true
        },
        logRequests: {
            key: 'khansolver_logallrequests',
            type: 'checkbox',
            helptext: 'Enable to log all requests for debug',
            value: false
        },
        doImages: {
            key: 'khansolver_doimages',
            type: 'checkbox',
            helptext: 'Render images',
            value: true
        },
        verbose: {
            key: 'khansolver_verbosity',
            type: 'checkbox',
            helptext: 'Be verbose (debugging)',
            value: false
        },
        logAnswers: {
            key: 'khansolver_loganswers',
            type: 'checkbox',
            helptext: 'Log answers',
            value: true
        },
        renderConsole: {
            key: 'khansolver_enablerender',
            type: 'hidden',
            value: true
        },
        windowPosition: {
            key: 'khansolver_windowposition',
            type: 'hidden',
            value: '30px;30px'
        }
    }

    const { fetch: origFetch } = window;
    window.fetch = async (...args) => {
        const response = await origFetch(...args);
        response.clone().json().then(body => handleInterception(args[0], body)).catch(r => { });
        if (config.logRequests.value) console.log(args[0].url.match(/(?<=.org)(.+?(?=\&|\?))/)[0], args[0]);
        return response;

    }

    const wrapQuestionKey = key => `[[☃ ${key}]]`;

    const handleInterception = (req, body) => {
        if (req.url.includes('getAssessmentItem')) {
            const answerData = JSON.parse(body.data.assessmentItem.item.itemData);
            window.khansolver_storedanswers.push(body.data.assessmentItem.item.itemData);

            let answerPrintout = 'Answers found!\n';
            answerPrintout += answerData.question.content;
            let finalString = answerData.question.content;

            for (const k of Object.keys(answerData.question.widgets)) {
                let answer;
                switch (k.split(' ')[0]) {
                    case 'expression':
                        answer = answerData.question.widgets[k].options.answerForms[0].value;
                        answerPrintout += `\n\nKey: ${k}\nType: ${k.split(' ')[0]}\nValue: ${answer}`;
                        finalString = finalString.replace(wrapQuestionKey(k), answer);
                        break;
                    case 'input-number':
                        answer = answerData.question.widgets[k].options.value;
                        answerPrintout += `\n\nKey: ${k}\nType: ${k.split(' ')[0]}\nValue: ${answer}`;
                        finalString = finalString.replace(wrapQuestionKey(k), answer);
                        break;
                    case 'numeric-input':
                        answer = answerData.question.widgets[k].options.answers[0].value;
                        answerPrintout += `\n\nKey: ${k}\nType: ${k.split(' ')[0]}\nValue: ${answer}`;
                        finalString = finalString.replace(wrapQuestionKey(k), answer);
                        break;
                    case 'radio':
                        answerPrintout += `\n\nKey: ${k}\nType: ${k.split(' ')[0]}\nValue: ${answerData.question.widgets[k].options.choices.map(v => `\nCorrect: ${v.correct}`).join('')}`;
                        let radioAnswerString = '';
                        for (let exp of answerData.question.widgets[k].options.choices) radioAnswerString += (exp.correct ? '✅\n' : '❌\n') + exp.content + '\n';
                        finalString = finalString.replace(wrapQuestionKey(k), radioAnswerString);
                        break;
                    case 'dropdown':
                        answerPrintout += `\n\nKey: ${k}\nType: ${k.split(' ')[0]}\nValue: ${answerData.question.widgets[k].options.choices.map(v => `\nCorrect: ${v.correct}`).join('')}`;
                        finalString = finalString.replace(wrapQuestionKey(k), answerData.question.widgets[k].options.choices.filter(v => v.correct).map(v => v.content).join(' | '));
                        break;
                    case 'plotter':
                        answerPrintout += `\n\nKey: ${k}\nType: ${k.split(' ')[0]}\nValue: ${answerData.question.widgets[k].options.correct.join('; ')}`;
                        let plotterAnswerStrings = [];
                        for (let correctIndex in answerData.question.widgets[k].options.correct) plotterAnswerStrings.push(`${answerData.question.widgets[k].options.categories[correctIndex].replace(/\$/g, '')}-${answerData.question.widgets[k].options.categories[++correctIndex].replace(/\$/g, '')} = ${answerData.question.widgets[k].options.correct[--correctIndex]}`);
                        finalString = finalString.replace(wrapQuestionKey(k), plotterAnswerStrings.join(' | '));
                        break;
                    case 'sorter':
                        answerPrintout += `\n\nKey: ${k}\nType: ${k.split(' ')[0]}\nValue: ${answerData.question.widgets[k].options.correct.join('; ')}`;
                        finalString = finalString.replace(wrapQuestionKey(k), answerData.question.widgets[k].options.correct.join(' | '));
                        break;
                    case 'matcher':
                        let matcherAnswerStrings = [];
                        for (let leftIndex in answerData.question.widgets[k].options.left) matcherAnswerStrings.push(`${answerData.question.widgets[k].options.left[leftIndex]} | ${answerData.question.widgets[k].options.right[leftIndex]}`);
                        finalString = finalString.replace(wrapQuestionKey(k), matcherAnswerStrings.join(' \n '));
                        break;
                }
            }
            const toPrint = [answerPrintout];
            if (config.verbose.value) toPrint.push(answerData);
            if (toPrint.length) console.log(...toPrint);
            if (config.logAnswers.value) addToConsole(finalString, true);
        } 
    }

    const inputHandler = (input) => {
        let configKey = input.target ? Object.keys(config).find(k => config[k].key === input.target.id) : input.key;
        if (configKey) {
            switch (config[configKey].type) {
                case 'checkbox':
                    config[configKey].value = input.target.checked;
                    break;
                case 'text':
                    config[configKey].value = input.target.value;
                    break;
                case 'hidden':
                    config[configKey].value = input.value;
                    break;
            }
            window.localStorage.setItem(config[configKey].key, config[configKey].value);
        }
        if (config.renderConsole.value) document.getElementById('khansolver_main').style.display = 'flex';
        else document.getElementById('khansolver_main').style.display = 'none';
    }


    const keyCallback = e => {
        if (e.altKey && e.key === 'k') {
            toggleMainDisplay();
            e.preventDefault();
        }
    }

    const init = () => {
        for (const k of Object.keys(config)) {
            const stored = window.localStorage.getItem(config[k].key);
            if (stored)
                config[k].value =
                    config[k].type === 'checkbox'
                        ? (stored === 'true' ? true : false)
                        : stored;
            console.log(k, config[k].value)
        }
        makeConsole();
        document.addEventListener('keydown', keyCallback);
        window.khansolver_storedanswers = [];
        addToConsole(`Loaded! This is version ${GM_info.script.version}`);
    }

    const makeDraggable = (elem) => {
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

        const draggable_mouseDown = (e) => {
            e = e || window.event;
            e.preventDefault();

            x2 = e.clientX;
            y2 = e.clientY;
            document.addEventListener('mouseup', draggable_endDrag);
            document.addEventListener('mousemove', draggable_handleDrag);
        }

        const draggable_handleDrag = (e) => {
            e = e || window.event;
            e.preventDefault();

            x1 = x2 - e.clientX;
            y1 = y2 - e.clientY;
            x2 = e.clientX;
            y2 = e.clientY;

            elem.style.top = (elem.offsetTop - y1) + 'px';
            elem.style.left = (elem.offsetLeft - x1) + 'px';

            inputHandler({ key: 'windowPosition', value: `${elem.style.left};${elem.style.top}` });
        }

        const draggable_endDrag = () => {
            document.removeEventListener('mousedown', draggable_endDrag);
            document.removeEventListener('mousemove', draggable_handleDrag);
        }

        if (document.getElementById(elem.id + '_headerbar')) document.getElementById(elem.id + '_headerbar').addEventListener('mousedown', draggable_mouseDown);
        else elem.addEventListener('mousedown', draggable_mouseDown);
    }

    const makeConsole = () => {
        document.body.style.backgroundColor = '#222';

        const main = document.createElement('div');
        main.id = 'khansolver_main';
        main.style = 'overflow:auto;resize:both;position:fixed;min-height:30vh;min-width:50vw;width:50vw;aspect-ratio:1.7;background:#000;display:none;flex-direction:column;align-items:center;z-index:5;box-shadow:0px 0px 10px #000;border-radius:2px;border:2px solid #222;color:#ccc;font-family:monospace;';
        if (config.renderConsole.value) main.style.display = 'flex';
        main.style.left = config.windowPosition.value.split(';')[0];
        main.style.top = config.windowPosition.value.split(';')[1];

        const headerbar = document.createElement('span');
        headerbar.id = 'khansolver_main_headerbar';
        headerbar.style = 'top:0;left:0;margin:0;width:100%;height:3vh;background:rgba(130,130,130,1);display:flex;flex-direction:column;cursor:move;';

        const topDecoLine = document.createElement('span');
        topDecoLine.style = 'width:100%;height:10%;margin:0;padding:0;background:linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet);'

        headerbar.appendChild(topDecoLine);

        const tabs = document.createElement('div');
        tabs.style = 'width:100%;height:90%;margin:0;padding:0;background-color:#000;border-bottom:2px solid #222;;display:flex;flex-direction:row;cursor:move;'

        const hamburger = document.createElement('img');
        hamburger.src = 'https://cdn-icons-png.flaticon.com/512/56/56763.png';
        hamburger.style = 'height:calc(100%-3px);aspect-ratio:1;margin:0;padding:3px;filter:invert(30%);cursor:pointer;'
        tabs.appendChild(hamburger);

        const tabsTitle = document.createElement('div');
        tabsTitle.style = 'margin:0;padding:0;display:flex;align-items:center;align-content:center;user-select:none;flex-grow:1000';
        tabsTitle.innerText = 'KhanSolver Console';
        tabs.appendChild(tabsTitle)

        const tabsX = document.createElement('div');
        tabsX.style = 'height:calc(100%-3px);background:#222;aspect-ratio:1;margin:0;padding:0;display:flex;align-items:center;align-content:center;justify-content:center;cursor:pointer;border:2px solid #222;border-radius:5px';
        tabsX.innerText = 'x';
        tabsX.addEventListener('click', toggleMainDisplay);
        tabs.appendChild(tabsX);

        headerbar.appendChild(tabs);
        main.appendChild(headerbar);

        const navMenu = document.createElement('div');
        navMenu.style = 'width:7vw;background-color:#000;position:absolute;top:3vh;left:0;border:2px solid #222;border-radius:5px;display:none;flex-direction:column;align-items:stretch;z-index:6;'
        main.appendChild(navMenu);

        hamburger.addEventListener('click', (e) => {
            if (navMenu.style.display === 'none') navMenu.style.display = 'flex';
            else navMenu.style.display = 'none';
        });

        navMenu.addButton = (text) => {
            const elem = document.createElement('div');
            elem.style = 'height:3.5vh;background-color:#000;border-bottom:2px solid #222;text-align:center;line-height:3.5vh;font-size:1.75vh;color:#fff;font-family:monospace;user-select:none;cursor:pointer;';
            elem.innerText = text;
            navMenu.appendChild(elem);
            return elem;
        }

        const screenContainer = document.createElement('div');
        screenContainer.style = 'width:100%;height:90%;position:absolute;margin:0;padding:0;top:10%;left:0;'
        main.appendChild(screenContainer);

        const consoleViewport = document.createElement('div');
        consoleViewport.style = 'width:100%;height:100%;overflow-y:scroll;flex-direction:column;';
        consoleViewport.id = 'khansolver_consolevp';
        screenContainer.appendChild(consoleViewport);

        const settingsViewport = document.createElement('div');
        settingsViewport.style = 'width:100%;height:100%;overflow-y:scroll;display:none;flex-direction:row;align-items:stretch;align-content:stretch;justify-content:center;';
        settingsViewport.id = 'khansolver_settingsvp';

        const content_left = document.createElement('div');
        content_left.style = 'padding:13px;display:flex;flex-direction:column;align-items:left;align-content:stretch;justify-content:center;';
        const content_right = document.createElement('div');
        content_right.style = 'padding:12px;display:flex;flex-direction:column;align-items:center;align-content:stretch;justify-content:center;';
        settingsViewport.appendChild(content_left);
        settingsViewport.appendChild(content_right);

        for (const k of Object.keys(config)) {
            if (config[k].type === 'hidden') continue;
            const label = document.createElement('label');
            label.htmlFor = config[k].key;
            label.innerText = config[k].helptext;
            label.title = config[k].helptext;
            content_left.appendChild(label);

            let elem;
            switch (config[k].type) {
                case 'checkbox':
                    elem = document.createElement('input');
                    elem.type = 'checkbox';
                    elem.checked = config[k].value;
                    break;
                case 'text':
                    elem = document.createElement('input');
                    elem.type = 'text';
                    break;
            }
            elem.title = config[k].helptext;
            elem.id = config[k].key;
            elem.addEventListener('change', inputHandler);
            content_right.appendChild(elem);
        }

        screenContainer.appendChild(settingsViewport);

        navMenu.addButton('Console').addEventListener('click', e => {
            screenContainer.childNodes.forEach(el => {
                el.style.display = 'none';
            });
            consoleViewport.style.display = 'flex';
        });

        navMenu.addButton('Config').addEventListener('click', e => {
            screenContainer.childNodes.forEach(el => {
                el.style.display = 'none';
            });
            settingsViewport.style.display = 'flex';
        });


        document.body.appendChild(main);
        makeDraggable(main);

        if (!katex) addToConsole('Katex not found! Rendering will be bad!');
        return main;
    }

    const DOMify = (string) => {
        string = string.replace(/\*{2}(.*?)\*{2}/g, '<strong>$1</strong>');
        string = string.replace(/\*(.*?)\*/g, '<em>$1</em>');
        string = string.replace(/\n/g, '<br>');
        for (const m of string.matchAll(/!\[(.+?)\]\((.+?)\)/g)) {
            if (!config.doImages.value) string = string.replace(m[0], `<img alt="${m[1]}" src=""`);
            else string = string.replace(m[0], `<img alt="${m[1]}" src="${document.querySelectorAll(`[alt="${m[1]}"]`).src}"`);
        }
        return string;
    }

    const addToConsole = (text, isMathematical) => {
        const next = document.createElement('div');
        next.style = 'border-bottom:2px solid #333;padding-left:3px;';
        next.innerHTML = DOMify(text);

        if (isMathematical) {
            try {
                renderMathInElement(next, { delimiters: [{ left: '$', right: '$', display: false }] });
            } catch (e) {
                addToConsole('Katex Error, see real console');
                console.error(e);
            }
        }

        document.getElementById('khansolver_consolevp').appendChild(next);
    }

    const toggleMainDisplay = () => {
        const main = document.getElementById('khansolver_main');
        if (main) {
            if (main.style.display === 'flex') main.style.display = 'none';
            else main.style.display = 'flex';
        }
    }

    window.khansolver_cleanup = () => {
        delete window.khansolver_cleanup;
        delete window.khansolver_storedanswers;
        document.getElementById('khansolver_main').remove();
        window.fetch = origFetch;
        localStorage.clear();
        document.removeEventListener('keydown', keyCallback);
        console.clear();
    }

    init();
})();
