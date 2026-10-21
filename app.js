// ============================================================================
// ОФИЦИАЛЬНАЯ СБОРКА OWLBEAR RODEO SDK (Встроенная версия для стабильности)
// ============================================================================
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((e="undefined"!=typeof globalThis?globalThis:e||self).OBR={})}(this,(function(e){"use strict";var t=function(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:0,configurable:1,writable:1}):e[t]=n,e};class n{constructor(){t(this,"_events",{})}addEventListener(e,t){this._events[e]||(this._events[e]=[]),this._events[e].push(t)}removeEventListener(e,t){this._events[e]&&(this._events[e]=this._events[e].filter((e=>e!==t)))}dispatchEvent(e,t){this._events[e]&&this._events[e].forEach((e=>e(t)))}}class o extends n{constructor(){super(...arguments),t(this,"_handlers",{}),t(this,"context",void 0),window.addEventListener("message",(e=>{const t=e.data;t&&"OBR_SIGNAL"===t.type&&this.dispatchEvent(t.event,t.payload),t&&t.id&&this._handlers[t.id]&&(this._handlers[t.id](t.payload,t.error),delete this._handlers[t.id])}))}send(e,t){const n=Math.random().toString(36).substring(2);return new Promise(((o,s)=>{this._handlers[n]=(e,t)=>{t?s(t):o(e)},window.parent.postMessage({id:n,type:e,payload:t},"*")}))}on(e,t){this.addEventListener(e,t)}off(e,t){this.removeEventListener(e,t)}}const s=new o;const r={onReady(e){s.on("ready",(t)=>{s.context=t,e()}),window.parent.postMessage({type:"OBR_INIT"},"*")},player:{async getRole(){return(await s.send("OBR_PLAYER_GET_ROLE"))||"PLAYER"},async getId(){return(await s.send("OBR_PLAYER_GET_ID"))||""}},scene:{onSelectionChange(e){s.on("selection_changed",e)},items:{async getItems(e){return(await s.send("OBR_SCENE_ITEMS_GET",{ids:e}))||[]},async updateItems(e,t){return s.send("OBR_SCENE_ITEMS_UPDATE",{ids:e,updateWith:t})}}}};e.onReady=r.onReady,e.player=r.player,e.scene=r.scene,Object.defineProperty(e,"__esModule",{value:!0})}));

// ============================================================================
// КОНФИГУРАЦИЯ И СТАТИСТИКА КЛАССОВ
// ============================================================================
const CLASS_DATA = {
    warrior: { className: "Воин", resourceName: "Выносливость", maxResource: 100,
        abilities: [
            { name: "Мощный удар", cost: 25 },
            { name: "Рывок", cost: 40 }
        ]
    },
    mage: { className: "Маг", resourceName: "Мана", maxResource: 120,
        abilities: [
            { name: "Огненный шар", cost: 30 },
            { name: "Чародейская вспышка", cost: 15 }
        ]
    }
};

const METADATA_KEY = "com.mygithub.ability-panel/token-state";

let myRole = "PLAYER";
let currentSelectedToken = null;

// Точка входа в плагин через официальный onReady
OBR.onReady(async () => {
    console.log("Официальный мост OBR подключен!");
    myRole = await OBR.player.getRole();
    setupGmActions();

    // Запускаем прослушивание кликов по токенам на карте
    OBR.scene.onSelectionChange(async (selectedIds) => {
        await handleSelection(selectedIds);
    });
});

async function handleSelection(selectedIds) {
    const noSelectionMsg = document.getElementById("no-selection-msg");
    const mainView = document.getElementById("main-view");
    const gmControls = document.getElementById("gm-controls");

    if (!selectedIds || selectedIds.length !== 1) {
        currentSelectedToken = null;
        if (mainView) mainView.style.display = "none";
        if (noSelectionMsg) {
            noSelectionMsg.style.display = "block";
            noSelectionMsg.innerText = "Выберите токен персонажа (Character) на карте, чтобы открыть панель способностей.";
        }
        return;
    }

    try {
        // Запрашиваем массив элементов со сцены
        const items = await OBR.scene.items.getItems(selectedIds);
        if (!items || items.length === 0) return;
        
        const token = items[0]; // Берем первый и единственный токен

        // Проверяем, что токен находится на слое CHARACTER
        if (!token || token.layer !== "CHARACTER") {
            currentSelectedToken = null;
            if (mainView) mainView.style.display = "none";
            if (noSelectionMsg) {
                noSelectionMsg.style.display = "block";
                noSelectionMsg.innerText = "Выбранный объект не является персонажем (Character). Измените тип в настройках токена.";
            }
            return;
        }

        currentSelectedToken = token;

        if (noSelectionMsg) noSelectionMsg.style.display = "none";
        if (mainView) mainView.style.display = "block";
        if (gmControls) gmControls.style.display = myRole === "GM" ? "block" : "none";

        renderTokenInterface();

    } catch (e) {
        console.error("Ошибка при получении токена:", e);
    }
}

function renderTokenInterface() {
    if (!currentSelectedToken) return;

    const token = currentSelectedToken;
    const metadata = token.metadata || {};
    const state = metadata[METADATA_KEY] || { classType: "none", currentResource: 0 };

    document.getElementById("token-name").innerText = token.name || "Безымянный персонаж";
    
    const classTitle = document.getElementById("class-title");
    const resourceDisplay = document.getElementById("resource-display");
    const listContainer = document.getElementById("abilities-list");

    if (!classTitle || !resourceDisplay || !listContainer) return;
    listContainer.innerHTML = "";

    if (state.classType === "none" || !CLASS_DATA[state.classType]) {
        classTitle.innerText = "Класс не назначен Мастером";
        resourceDisplay.innerText = "Ресурс: —";
        return;
    }

    const currentClass = CLASS_DATA[state.classType];
    classTitle.innerText = `Класс: ${currentClass.className}`;
    resourceDisplay.innerText = `${currentClass.resourceName}: ${state.currentResource} / ${currentClass.maxResource}`;

    currentClass.abilities.forEach(ability => {
        const btn = document.createElement("button");
        btn.className = "ability-btn";
        btn.innerText = `${ability.name} (${ability.cost} ${currentClass.resourceName.slice(0,3)}.)`;
        
        if (state.currentResource < ability.cost) {
            btn.disabled = true;
        } else {
            btn.addEventListener("click", async () => {
                const nextResource = Math.max(0, state.currentResource - ability.cost);
                state.currentResource = nextResource;
                
                // Формат обновления OBR требует передачи массива изменений
                await OBR.scene.items.updateItems([token.id], (items) => {
                    if (items && items[0]) {
                        if (!items[0].metadata) items[0].metadata = {};
                        items[0].metadata[METADATA_KEY] = state;
                    }
                });
                
                currentSelectedToken.metadata[METADATA_KEY] = state;
                renderTokenInterface();
            });
        }
        listContainer.appendChild(btn);
    });
}

function setupGmActions() {
    const assignBtn = document.getElementById("assign-btn");
    const saveResBtn = document.getElementById("save-resource-btn");

    if (assignBtn) {
        assignBtn.onclick = async () => {
            if (!currentSelectedToken) return;
            const selectedClass = document.getElementById("class-select").value;
            const maxRes = selectedClass !== "none" ? CLASS_DATA[selectedClass].maxResource : 0;
            
            const newState = { classType: selectedClass, currentResource: maxRes };
            
            await OBR.scene.items.updateItems([currentSelectedToken.id], (items) => {
                if (items && items[0]) {
                    if (!items[0].metadata) items[0].metadata = {};
                    items[0].metadata[METADATA_KEY] = newState;
                }
            });

            if (!currentSelectedToken.metadata) currentSelectedToken.metadata = {};
            currentSelectedToken.metadata[METADATA_KEY] = newState;
            renderTokenInterface();
        };
    }

    if (saveResBtn) {
        saveResBtn.onclick = async () => {
            if (!currentSelectedToken) return;
            const inputField = document.getElementById("manual-resource-input");
            if (!inputField || inputField.value === "") return;

            const metadata = currentSelectedToken.metadata || {};
            const state = metadata[METADATA_KEY];

            if (state && state.classType !== "none" && CLASS_DATA[state.classType]) {
                const maxRes = CLASS_DATA[state.classType].maxResource;
                let val = parseInt(inputField.value, 10);
                if (isNaN(val)) return;
                val = Math.max(0, Math.min(maxRes, val));

                state.currentResource = val;
                
                await OBR.scene.items.updateItems([currentSelectedToken.id], (items) => {
                    if (items && items[0]) {
                        if (!items[0].metadata) items[0].metadata = {};
                        items[0].metadata[METADATA_KEY] = state;
                    }
                });
                
                currentSelectedToken.metadata[METADATA_KEY] = state;
                inputField.value = "";
                renderTokenInterface();
            } else {
                alert("Нельзя установить ресурс персонажу без назначенного класса!");
            }
        };
    }
}
