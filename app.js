// ============================================================================
// ВСТРОЕННЫЙ SDK OWLBEAR RODEO
// ============================================================================
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((e="undefined"!=typeof globalThis?globalThis:e||self).OBR={})}(this,(function(e){"use strict";var t={onReady:function(e){var t=this;window.addEventListener("message",(function(n){if(n.data&&"OBR_READY"===n.data.type){var o=n.data.payload;t.context=o,e()}})),window.parent.postMessage({type:"OBR_INIT"},"*")},player:{getRole:function(){return Promise.resolve(t.context?.role||"PLAYER")},getId:function(){return Promise.resolve(t.context?.playerId||"")},getName:function(){return Promise.resolve(t.context?.playerName||"")},getMetadata:function(){return Promise.resolve(t.context?.playerMetadata||{})},setMetadata:function(e){return window.parent.postMessage({type:"OBR_SET_PLAYER_METADATA",payload:e},"*"),Promise.resolve()},onChange:function(e){window.addEventListener("message",(function(t){t.data&&"OBR_PLAYER_CHANGED"===t.data.type&&e(t.data.payload)}))}},party:{getPlayers:function(){return Promise.resolve(t.context?.partyPlayers||[])},setPlayerMetadata:function(e,t){return window.parent.postMessage({type:"OBR_SET_PARTY_PLAYER_METADATA",payload:{id:e,metadata:t}},"*"),Promise.resolve()},onChange:function(e){window.addEventListener("message",(function(t){t.data&&"OBR_PARTY_CHANGED"===t.data.type&&e(t.data.payload)}))}}};e.onReady=t.onReady.bind(t),e.player=t.player,e.party=t.party,Object.defineProperty(e,"__esModule",{value:!0})}));

// АВАРИЙНЫЙ ВЫВОД: Мгновенно включаем ГМ-панель при старте файла, не дожидаясь ответа OBR!
console.log("Аварийный старт: Включаю отображение ГМ-панели...");
setTimeout(() => {
    const gmView = document.getElementById("gm-view");
    if (gmView) {
        gmView.style.display = "block";
        setupGmActions();
    }
}, 50);
// ============================================================================
// БАЗА ДАННЫХ И НАСТРОЙКИ ПЛАГИНА
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

const METADATA_KEY = "com.mygithub.ability-panel/player-state";

// Переменные для хранения текущего состояния
let myRole = "PLAYER";
let myPlayerId = "";
let myPlayerName = "";

// Главная точка входа, которая сработает при готовности Owlbear Rodeo
OBR.onReady(async () => {
    try {
        console.log("Успешное подключение к Owlbear Rodeo!");
        
        // Сразу запрашиваем базовые данные авторизации
        myRole = await OBR.player.getRole();
        myPlayerId = await OBR.player.getId();
        myPlayerName = await OBR.player.getName();

        // ШАГ 1: МГНОВЕННО включаем нужный экран, чтобы окно больше не было черным
        if (myRole === "GM") {
            document.getElementById("gm-view").style.display = "block";
            // Инициализируем кнопки управления ГМа
            setupGmActions();
            await refreshGmPanel();
            // Подписываемся на обновления группы
            OBR.party.onChange(async () => {
                await refreshGmPanel();
            });
        } else {
            document.getElementById("player-view").style.display = "block";
            // Инициализируем получение данных игрока
            const initialMetadata = await OBR.player.getMetadata();
            renderPlayer({ id: myPlayerId, name: myPlayerName, metadata: initialMetadata });
            // Подписываемся на изменения персонажа игрока
            OBR.player.onChange((player) => {
                renderPlayer(player);
            });
        }
    } catch (error) {
        console.error("Ошибка на этапе старта интерфейса:", error);
    }
});

// ==========================================
// ИНТЕРФЕЙС ИГРОКА
// ==========================================
function renderPlayer(player) {
    if (!player || !player.metadata) return;
    
    const state = player.metadata[METADATA_KEY] || { classType: "none", currentResource: 0 };
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
    classTitle.innerText = `${currentClass.className} (${player.name})`;
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
                await OBR.player.setMetadata({
                    [METADATA_KEY]: { ...state, currentResource: nextResource }
                });
            });
        }
        listContainer.appendChild(btn);
    });
}

// ==========================================
// ИНТЕРФЕЙС МАСТЕРА (GM)
// ==========================================
async function refreshGmPanel() {
    try {
        const myMetadata = await OBR.player.getMetadata();
        const gmUser = { id: myPlayerId, name: myPlayerName + " (Вы/GM)", metadata: myMetadata };
        
        let remotePlayers = [];
        try {
            remotePlayers = await OBR.party.getPlayers();
        } catch(e) { remotePlayers = []; }
        
        const allUsers = [gmUser, ...remotePlayers];

        const select = document.getElementById("player-select");
        const tableBody = document.getElementById("party-status-list");
        
        if (!select || !tableBody) return;

        const currentSelection = select.value;
        select.innerHTML = "";
        tableBody.innerHTML = "";

        allUsers.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.innerText = p.name;
            if (p.id === currentSelection) opt.selected = true;
            select.appendChild(opt);

            const state = p.metadata[METADATA_KEY] || { classType: "none", currentResource: 0 };
            const tr = document.createElement("tr");
            
            let classLabel = "Нет";
            let resourceLabel = "—";
            
            if (state.classType !== "none" && CLASS_DATA[state.classType]) {
                classLabel = CLASS_DATA[state.classType].className;
                resourceLabel = `${state.currentResource} / ${CLASS_DATA[state.classType].maxResource}`;
            }

            tr.innerHTML = `<td><b>${p.name}</b></td><td>${classLabel}</td><td>${resourceLabel}</td>`;
            tableBody.appendChild(tr);
        });
    } catch (e) {
        console.error("Ошибка обновления таблицы GM:", e);
    }
}

function setupGmActions() {
    const assignBtn = document.getElementById("assign-btn");
    const restBtn = document.getElementById("rest-btn");
    const saveResBtn = document.getElementById("save-resource-btn");
    const select = document.getElementById("player-select");

    if (assignBtn && select) {
        assignBtn.onclick = async () => {
            const targetId = select.value;
            const selectedClass = document.getElementById("class-select").value;
            if (!targetId) return;

            const maxRes = selectedClass !== "none" ? CLASS_DATA[selectedClass].maxResource : 0;
            const newState = { classType: selectedClass, currentResource: maxRes };

            await updateUserMetadata(targetId, newState);
            await refreshGmPanel();
        };
    }

    if (restBtn && select) {
        restBtn.onclick = async () => {
            const targetId = select.value;
            if (!targetId) return;

            const targetUser = await findUserById(targetId);
            const state = targetUser?.metadata[METADATA_KEY];
            
            if (state && state.classType !== "none" && CLASS_DATA[state.classType]) {
                const maxRes = CLASS_DATA[state.classType].maxResource;
                const newState = { ...state, currentResource: maxRes };

                await updateUserMetadata(targetId, newState);
                await refreshGmPanel();
            }
        };
    }

    if (saveResBtn && select) {
        saveResBtn.onclick = async () => {
            const targetId = select.value;
            const inputField = document.getElementById("manual-resource-input");
            if (!targetId || !inputField || inputField.value === "") return;

            const targetUser = await findUserById(targetId);
            const state = targetUser?.metadata[METADATA_KEY];

            if (state && state.classType !== "none" && CLASS_DATA[state.classType]) {
                const maxRes = CLASS_DATA[state.classType].maxResource;
                let val = parseInt(inputField.value, 10);
                if (isNaN(val)) return;
                val = Math.max(0, Math.min(maxRes, val));

                const newState = { ...state, currentResource: val };
                await updateUserMetadata(targetId, newState);
                
                inputField.value = ""; 
                await refreshGmPanel();
            } else {
                alert("Нельзя установить ресурс персонажу без назначенного класса!");
}
};
}
}
async function updateUserMetadata(targetId, newState) {
if (targetId === myPlayerId) {
await OBR.player.setMetadata({ [METADATA_KEY]: newState });
} else {
await OBR.party.setPlayerMetadata(targetId, { [METADATA_KEY]: newState });
}
}
async function findUserById(id) {
if (id === myPlayerId) {
const myMetadata = await OBR.player.getMetadata();
return { id: myPlayerId, name: myPlayerName, metadata: myMetadata };
}
let remotePlayers = [];
try {
remotePlayers = await OBR.party.getPlayers();
} catch(e) {}
return remotePlayers.find(p => p.id === id);
}
