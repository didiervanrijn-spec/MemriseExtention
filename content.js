function createSmartProbabilityTranslatorGUI() {
    const existingGui = document.getElementById('memrise-smart-gui');
    if (existingGui) existingGui.remove();

    window.memriseAnswerCache = window.memriseAnswerCache || {
        'bedankt': ['merci'],
        'merci': ['bedankt']
    };

    let laatstGeselecteerdeElement = null;
    let autoModusActief = false;
    let autoModusInterval = null;
    let isVerwerkenBezig = false;

    const gui = document.createElement('div');
    gui.id = 'memrise-smart-gui';
    gui.style.position = 'fixed';
    gui.style.top = '20px';
    gui.style.right = '20px';
    gui.style.zIndex = '999999';
    gui.style.backgroundColor = '#181825';
    gui.style.color = '#cdd6f4';
    gui.style.padding = '15px';
    gui.style.borderRadius = '8px';
    gui.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
    gui.style.fontFamily = 'sans-serif';
    gui.style.width = '280px';

    gui.innerHTML = `
        <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #89b4fa;">🎯 Ultimate Learning Engine</h4>
        <button id="toggle-auto-btn" style="width: 100%; padding: 10px; background-color: #f38ba8; border: none; border-radius: 5px; color: #11111b; font-weight: bold; cursor: pointer; margin-bottom: 6px;">🤖 Auto Modus: UIT</button>
        <button id="auto-translate-btn" style="width: 100%; padding: 10px; background-color: #a6e3a1; border: none; border-radius: 5px; color: #11111b; font-weight: bold; cursor: pointer; margin-bottom: 6px;">Analyseer & Klik / Hint</button>
        <button id="learn-correct-btn" style="width: 100%; padding: 6px; background-color: #f9e2af; border: none; border-radius: 5px; color: #11111b; font-weight: bold; cursor: pointer; margin-bottom: 6px;">📌 Onthoud Antwoord</button>
        <div style="display: flex; gap: 5px;">
            <button id="export-cache-btn" style="flex: 1; padding: 6px; background-color: #89b4fa; border: none; border-radius: 5px; color: #11111b; font-weight: bold; cursor: pointer;">💾 Export</button>
            <button id="import-cache-btn" style="flex: 1; padding: 6px; background-color: #cba6f7; border: none; border-radius: 5px; color: #11111b; font-weight: bold; cursor: pointer;">📂 Import</button>
        </div>
        <input type="file" id="import-file-input" style="display: none;" accept=".json">
        <div id="status-box" style="margin-top: 10px; padding: 8px; background-color: #313244; border-radius: 5px; font-size: 12px; word-break: break-word;">Klaar voor gebruik.</div>
    `;

    document.body.appendChild(gui);

    const statusBox = document.getElementById('status-box');
    const autoBtn = document.getElementById('toggle-auto-btn');

    function verplaatsNummerNaarAchter(tekst) {
        if (!tekst) return '';
        const match = tekst.trim().match(/^([\d\s.\-)]+)\s*(.+)$/);
        if (match) {
            return `${match[2].trim()} ${match[1].trim()}`.toLowerCase();
        }
        return tekst.trim().toLowerCase();
    }

    function verwijderNummersSchoon(tekst) {
        if (!tekst) return '';
        return tekst.replace(/^[\d\s.\-)]+/, '')
                    .replace(/[\d\s.\-)]+$/, '')
                    .replace(/[?!.,;:]/g, '')
                    .trim()
                    .toLowerCase();
    }

    function haalNummerOpUitOptie(tekst) {
        if (!tekst) return null;
        const match = tekst.trim().match(/^[\s(]*(\d+)[\s.\-)]*/);
        return match ? match[1] : null;
    }

    function isZichtbaar(element) {
        if (!element) return false;
        return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
    }

    function verstuurEnterToets(doelElement) {
        const target = doelElement || document.activeElement || document.body || document;
        const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        target.dispatchEvent(new KeyboardEvent('keydown', opts));
        target.dispatchEvent(new KeyboardEvent('keypress', opts));
        target.dispatchEvent(new KeyboardEvent('keyup', opts));
    }

    function verstuurToetsDruk(nummerChar) {
        const keyCode = 48 + parseInt(nummerChar, 10);
        ['keydown', 'keypress', 'keyup'].forEach(eventType => {
            document.dispatchEvent(new KeyboardEvent(eventType, {
                key: nummerChar, code: `Digit${nummerChar}`, keyCode: keyCode, which: keyCode, bubbles: true, cancelable: true
            }));
        });
    }

    function slaOpInGeheugen(vraagTekst, antwoordTekst) {
        const v = verplaatsNummerNaarAchter(vraagTekst);
        const a = verplaatsNummerNaarAchter(antwoordTekst);
        if (!v || !a) return;

        window.memriseAnswerCache[v] = window.memriseAnswerCache[v] || [];
        const indexV = window.memriseAnswerCache[v].indexOf(a);
        if (indexV !== -1) window.memriseAnswerCache[v].splice(indexV, 1);
        window.memriseAnswerCache[v].unshift(a);

        window.memriseAnswerCache[a] = window.memriseAnswerCache[a] || [];
        const indexA = window.memriseAnswerCache[a].indexOf(v);
        if (indexA !== -1) window.memriseAnswerCache[a].splice(indexA, 1);
        window.memriseAnswerCache[a].unshift(v);
    }

    function klikVolgendeKnopOfEnter() {
        let volgendeKnop = document.querySelector('button[data-testid*="next"], button[data-testid*="continue"], button.sc-klj6s2-0.cImqEs');
        
        if (!volgendeKnop) {
            volgendeKnop = Array.from(document.querySelectorAll('button, a, div[role="button"]')).find(el => {
                const tekst = el.innerText ? el.innerText.toLowerCase().trim() : '';
                return (tekst.includes('volgende') || tekst.includes('next') || tekst.includes('continue') || tekst.includes('begrepen') || tekst.includes('got it')) && isZichtbaar(el);
            });
        }

        if (volgendeKnop && isZichtbaar(volgendeKnop)) {
            volgendeKnop.click();
        } else {
            verstuurEnterToets();
        }
    }

    function controleerEnSlaFoutPaginaOp() {
        const alleTeksten = Array.from(document.querySelectorAll('*'))
            .filter(el => el.children.length === 0 && el.innerText && el.innerText.trim().length > 0 && isZichtbaar(el));

        const isFoutScherm = alleTeksten.some(el => /jouw antwoord|your answer/i.test(el.innerText));

        if (isFoutScherm) {
            let frTekst = '', nlTekst = '';
            for (let i = 0; i < alleTeksten.length; i++) {
                const t = alleTeksten[i].innerText.trim();
                if (/^french$/i.test(t) && i + 1 < alleTeksten.length) frTekst = alleTeksten[i + 1].innerText.trim();
                if (/^dutch$/i.test(t) && i + 1 < alleTeksten.length) nlTekst = alleTeksten[i + 1].innerText.trim();
            }

            if (frTekst && nlTekst) {
                slaOpInGeheugen(frTekst, nlTekst);
                statusBox.innerHTML = `⚠️ <b>Juiste antwoord bijgewerkt:</b><br>${frTekst} = ${nlTekst}`;
            } else {
                statusBox.innerHTML = `⚠️ <b>Foutscherm gedetecteerd. Druk op Enter...</b>`;
            }
            klikVolgendeKnopOfEnter();
            verstuurEnterToets();
            return true;
        }
        return false;
    }

    async function controleerEnSlaLeerpaginaOp() {
        const hoofdelement = document.querySelector('[data-testid="presentation-header"], h2, h1');
        const subelement = document.querySelector('[data-testid="presentation-translation"], h3');

        if (hoofdelement && subelement && isZichtbaar(hoofdelement) && hoofdelement.innerText && subelement.innerText) {
            slaOpInGeheugen(hoofdelement.innerText, subelement.innerText);
            statusBox.innerHTML = `🧠 <b>Nieuw woord geleerd:</b><br>${hoofdelement.innerText} = ${subelement.innerText}`;
            
            await new Promise(r => setTimeout(r, 100));
            
            klikVolgendeKnopOfEnter();
            
            await new Promise(r => setTimeout(r, 100));
            verstuurEnterToets();

            return true;
        }
        return false;
    }

    document.addEventListener('click', (e) => {
        const knop = e.target.closest('button, [data-testid*="option"], .sc-1vg77x4-0, .sc-klj6s2-0');
        if (knop && !knop.closest('#memrise-smart-gui')) {
            laatstGeselecteerdeElement = knop;
        }
    }, true);

    function berekenLevenshteinAfstand(a, b) {
        const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
        for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
            }
        }
        return matrix[a.length][b.length];
    }

    function berekenSimilarityScore(s1, s2) {
        const str1 = verplaatsNummerNaarAchter(s1);
        const str2 = verplaatsNummerNaarAchter(s2);
        if (str1 === str2) return 100;
        const maxLen = Math.max(str1.length, str2.length);
        if (maxLen === 0) return 100;
        return ((maxLen - berekenLevenshteinAfstand(str1, str2)) / maxLen) * 100;
    }

    function isWaarschijnlijkNederlands(tekst) {
        const nlWoorden = ['de', 'het', 'een', 'van', 'tot', 'later', 'hoe', 'gaat', 'met', 'jou', 'ja', 'dag', 'hallo', 'hoi', 'dank', 'wel', 'bedankt'];
        return tekst.toLowerCase().split(/\s+/).some(w => nlWoorden.includes(w));
    }

    async function vulInputIn(inputElement, tekst) {
        inputElement.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        if (nativeInputValueSetter) nativeInputValueSetter.call(inputElement, tekst);
        else inputElement.value = tekst;

        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        await new Promise(r => setTimeout(r, 30));
        klikVolgendeKnopOfEnter();
    }

    async function verwerkTappingOpdracht(doelTekst) {
        const verwachteWoorden = verwijderNummersSchoon(doelTekst).split(/\s+/).filter(w => w.length > 0);
        statusBox.innerHTML = `🧩 <b>Woorden klikken:</b><br><i>${verwachteWoorden.join(' ')}</i>`;

        for (const woord of verwachteWoorden) {
            const knoppen = Array.from(document.querySelectorAll('button, .sc-klj6s2-0')).filter(isZichtbaar);
            let besteKnop = null, besteScore = 0;

            knoppen.forEach(knop => {
                if (knop.closest('#memrise-smart-gui')) return;
                const knopTekst = verwijderNummersSchoon(knop.innerText);
                if (!knopTekst) return;

                const score = berekenSimilarityScore(knopTekst, woord);
                if (score > besteScore) {
                    besteScore = score;
                    besteKnop = knop;
                }
            });

            if (besteKnop && besteScore > 60) {
                besteKnop.click();
                await new Promise(r => setTimeout(r, 30));
            }
        }

        await new Promise(r => setTimeout(r, 50));
        klikVolgendeKnopOfEnter();
        statusBox.innerHTML = `✅ <b>Woorden ingeklikt & verzonden!</b>`;
    }

    document.getElementById('export-cache-btn').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.memriseAnswerCache, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "memrise_woordenlijst.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        statusBox.innerText = "💾 Woordenlijst geëxporteerd!";
    });

    document.getElementById('import-cache-btn').addEventListener('click', () => document.getElementById('import-file-input').click());

    document.getElementById('import-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const geïmporteerdeData = JSON.parse(event.target.result);
                
                Object.keys(geïmporteerdeData).forEach(key => {
                    const nieuweWaarden = Array.isArray(geïmporteerdeData[key]) ? geïmporteerdeData[key] : [geïmporteerdeData[key]];
                    if (!window.memriseAnswerCache[key]) {
                        window.memriseAnswerCache[key] = nieuweWaarden;
                    } else {
                        nieuweWaarden.reverse().forEach(val => {
                            const idx = window.memriseAnswerCache[key].indexOf(val);
                            if (idx !== -1) window.memriseAnswerCache[key].splice(idx, 1);
                            window.memriseAnswerCache[key].unshift(val);
                        });
                    }
                });

                statusBox.innerText = "📂 Woordenlijst succesvol ingeladen!";
            } catch (err) {
                statusBox.innerText = "❌ Ongeldig JSON-bestand.";
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('learn-correct-btn').addEventListener('click', () => {
        const targetElement = document.querySelector('span[dir="auto"], div[dir="auto"], [dir="auto"]');
        if (!targetElement || !isZichtbaar(targetElement) || !targetElement.innerText.trim() || !laatstGeselecteerdeElement || !laatstGeselecteerdeElement.innerText.trim()) {
            statusBox.innerText = "❌ Selecteer eerst een antwoord op het scherm.";
            return;
        }
        slaOpInGeheugen(targetElement.innerText, laatstGeselecteerdeElement.innerText);
        statusBox.innerHTML = `✅ <b>Opgeslagen!</b><br>Vraag: <i>${targetElement.innerText}</i><br>Antwoord: <b>${laatstGeselecteerdeElement.innerText}</b>`;
    });

    async function voerAnalyseUit() {
        if (isVerwerkenBezig) return;
        isVerwerkenBezig = true;

        try {
            if (controleerEnSlaFoutPaginaOp()) return;
            if (await controleerEnSlaLeerpaginaOp()) return;

            const targetElement = document.querySelector('span[dir="auto"], div[dir="auto"], [dir="auto"]');
            if (!targetElement || !isZichtbaar(targetElement) || !targetElement.innerText.trim()) {
                statusBox.innerText = "❌ Geen actieve vraag op het scherm.";
                return;
            }

            const teVertalenTekst = verplaatsNummerNaarAchter(targetElement.innerText);
            let mogelijkeVertalingen = new Set();

            if (window.memriseAnswerCache[teVertalenTekst]) {
                window.memriseAnswerCache[teVertalenTekst].forEach(v => mogelijkeVertalingen.add(verplaatsNummerNaarAchter(v)));
                statusBox.innerText = `⚡ Uit geheugen geladen...`;
            } else {
                let vanTaal = isWaarschijnlijkNederlands(teVertalenTekst) ? 'nl' : 'fr';
                let naarTaal = (vanTaal === 'nl') ? 'fr' : 'nl';
                statusBox.innerText = `🔍 Ophalen vertalingen...`;

                try {
                    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(teVertalenTekst)}&langpair=${vanTaal}|${naarTaal}`);
                    const data = await res.json();
                    if (data.responseData?.translatedText) mogelijkeVertalingen.add(verplaatsNummerNaarAchter(data.responseData.translatedText));
                    if (Array.isArray(data.matches)) data.matches.forEach(m => { if (m.translation) mogelijkeVertalingen.add(verplaatsNummerNaarAchter(m.translation)); });
                    window.memriseAnswerCache[teVertalenTekst] = Array.from(mogelijkeVertalingen);
                } catch (error) {
                    console.error(error);
                }
            }

            const vertalingenLijst = Array.from(mogelijkeVertalingen);
            const besteVertaling = vertalingenLijst[0] || "";

            const tappingContainer = document.querySelector('button[data-testid="tapping-response-clear"]');
            if (tappingContainer && isZichtbaar(tappingContainer)) {
                await verwerkTappingOpdracht(besteVertaling);
                return;
            }

            const inputField = document.querySelector('input[type="text"], textarea');
            if (inputField && isZichtbaar(inputField)) {
                const schoneTekst = verwijderNummersSchoon(besteVertaling);
                await vulInputIn(inputField, schoneTekst);
                statusBox.innerHTML = `✍️ <b>Antwoord ingevuld & verzonden:</b><br><b>${schoneTekst}</b>`;
                return;
            }

            const schermOpties = Array.from(document.querySelectorAll('button, [data-testid*="option"], .sc-1vg77x4-0, .sc-klj6s2-0')).filter(isZichtbaar);
            const negeerTeksten = ['ik weet het niet', 'weet ik niet', 'geen idee', "don't know", 'i dont know'];
            let geanalyseerdeOpties = [];

            schermOpties.forEach((optie, index) => {
                if (optie.closest('#memrise-smart-gui') || optie === targetElement) return;
                const knopTekst = verplaatsNummerNaarAchter(optie.innerText);
                if (!knopTekst || knopTekst.length > 80 || negeerTeksten.some(ongewenst => knopTekst.includes(ongewenst))) return;

                let hoogsteKnopScore = 0;
                vertalingenLijst.forEach(vertaling => {
                    const score = berekenSimilarityScore(knopTekst, vertaling);
                    if (score > hoogsteKnopScore) hoogsteKnopScore = score;
                });

                geanalyseerdeOpties.push({
                    element: optie,
                    tekst: knopTekst,
                    score: hoogsteKnopScore,
                    nummer: haalNummerOpUitOptie(optie.innerText) || (index + 1).toString()
                });
            });

            geanalyseerdeOpties.sort((a, b) => b.score - a.score);

            if (geanalyseerdeOpties.length > 0 && isZichtbaar(geanalyseerdeOpties[0].element)) {
                const besteMatch = geanalyseerdeOpties[0];
                if (besteMatch.nummer) verstuurToetsDruk(besteMatch.nummer);
                besteMatch.element.click();

                await new Promise(r => setTimeout(r, 50));
                klikVolgendeKnopOfEnter();
            } else {
                statusBox.innerHTML = `💡 Geen zichtbare antwoordopties gevonden op het scherm.`;
            }
        } finally {
            isVerwerkenBezig = false;
        }
    }

    document.getElementById('auto-translate-btn').addEventListener('click', voerAnalyseUit);

    autoBtn.addEventListener('click', () => {
        autoModusActief = !autoModusActief;
        if (autoModusActief) {
            autoBtn.innerText = "🤖 Auto Modus: AAN";
            autoBtn.style.backgroundColor = "#a6e3a1";
            autoModusInterval = setInterval(voerAnalyseUit, 250);
        } else {
            autoBtn.innerText = "🤖 Auto Modus: UIT";
            autoBtn.style.backgroundColor = "#f38ba8";
            clearInterval(autoModusInterval);
        }
    });
}

// VERVANG DE LAATSTE REGEL (createSmartProbabilityTranslatorGUI();) DOOR DIT:

function controleerEnStartGUI() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['systeemActief'], (data) => {
            // Standaard staat hij op FALSE (UIT) tenzij ingeschakeld
            const isActief = data.systeemActief === true;
            const existingGui = document.getElementById('memrise-smart-gui');

            if (isActief) {
                if (!existingGui) {
                    createSmartProbabilityTranslatorGUI();
                }
            } else {
                if (existingGui) {
                    existingGui.remove();
                }
            }
        });
    }
}

// Luister naar de Toggle knop in popup.js
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request) => {
        if (request.actie === "updateStatus") {
            const existingGui = document.getElementById('memrise-smart-gui');
            if (request.isActief) {
                if (!existingGui) createSmartProbabilityTranslatorGUI();
            } else {
                if (existingGui) existingGui.remove();
            }
        }
    });
}

// Voer de controle uit bij het laden
controleerEnStartGUI();

// Blijf elke seconde controleren (voor SPA-navigatie binnen Memrise)
setInterval(controleerEnStartGUI, 1000);
