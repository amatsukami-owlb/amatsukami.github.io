// 1.3=========================================================================
// ОФИЦИАЛЬНЫЙ SDK OWLBEAR RODEO (С полной поддержкой работы со сценой)
// ============================================================================
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((e="undefined"!=typeof globalThis?globalThis:e||self).OBR={})}(this,(function(e){"use strict";var t={onReady:function(e){var t=this;window.addEventListener("message",(function(n){if(n.data&&"OBR_READY"===n.data.type){var o=n.data.payload;t.context=o,e()}})),window.parent.postMessage({type:"OBR_INIT"},"*")},player:{getRole:function(){return Promise.resolve(t.context?.role||"PLAYER")},getId:function(){return Promise.resolve(t.context?.playerId||"")}},scene:{onSelectionChange:function(e){window.addEventListener("message",(function(t){t.data&&"OBR_SCENE_SELECTION_CHANGED"===t.data.type&&e(t.data.payload)}))},items:{getItems:function(e){return window.parent.postMessage({type:"OBR_SCENE_ITEMS_GET",payload:{ids:e}},"*"),new Promise((function(t){var n=function(o){o.data&&"OBR_SCENE_ITEMS_RETURN"===o.data.type&&(window.removeEventListener("message",n),t(o.data.payload))};window.addEventListener("message",n)}))},updateItems:function(e,t){window.parent.postMessage({type:"OBR_SCENE_ITEMS_UPDATE",payload:{ids:e,updateWith:t}},"*");return Promise.resolve()}}}};e.onReady=t.onReady.bind(t),e.player=t.player,e.scene=t.scene,Object.defineProperty(e,"__esModule",{value:!0})}));

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

// Старт плагина
OBR.onReady(async () => {
    myRole = await OBR.player.getRole();
    setupGmActions();

    // Слушаем изменение выделения (прилетает массив ID)
    OBR.scene.onSelectionChange(async (selectedIds) => {
        await handleSelection(selectedIds);
    });
});

// Обработка клика по токену на карте
async function handleSelection(selectedIds) {
    const noSelectionMsg = document.getElementById("no-selection-msg");
    const mainView = document.getElementById("main-view");
    const gmControls = document.getElementById("gm-controls");

    // Проверка: выделен ли ровно один объект
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
        // МЫ ПРЕВРАЩАЕМ МАССИВ ID В ПОЛНОЦЕННЫЕ ОБЪЕКТЫ ТОКЕНОВ
        const items = await OBR.scene.items.getItems(selectedIds);
        const token = items && items[0];

        // Проверяем слой токена (в OBR персонажи лежат строго на слое CHARACTER)
        if (!token || token.layer !== "CHARACTER") {
            currentSelectedToken = null;
            if (mainView) mainView.style.display = "none";
            if (noSelectionMsg) {
                noSelectionMsg.style.display = "block";
                noSelectionMsg.innerText = "Выбранный объект не является персонажем (Character). Переключите тип токена в настройках Owlbear.";
            }
            return;
        }

        // ПРОВЕРКА ПРАВ ДОСТУПА ДЛЯ ИГРОКОВ (Защита от подглядывания)
        if (myRole !== "GM") {
            const myId = await OBR.player.getId();
            
            // Если у токена настроены владельцы (в OBR 2.0+ это массив в поле token.owners)
            if (token.owners && token.owners.length > 0 && !token.owners.includes(myId)) {
                currentSelectedToken = null;
                if (mainView) mainView.style.display = "none";
                if (noSelectionMsg) {
                    noSelectionMsg.style.display = "block";
                    noSelectionMsg.innerText = "У вас нет прав управления этим персонажем.";
                }
                return;
            }
        }

        // Сохраняем токен в память и переключаем интерфейс
        currentSelectedToken = token;

        if (noSelectionMsg) noSelectionMsg.style.display = "none";
        if (mainView) mainView.style.display = "block";

        // Показываем панель управления ГМа, если роль совпадает
        if (gmControls) {
            gmControls.style.display = myRole === "GM" ? "block" : "none";
        }

        renderTokenInterface();

    } catch (e) {
        console.error("Ошибка при получении токена со сцены:", e);
    }
}

function renderTokenInterface() {
    if (!currentSelectedToken) return;

    const token = currentSelectedToken;
    // Безопасно вытаскиваем метаданные токена
    const tokenMetadata = token.metadata || {};
    const state = tokenMetadata[METADATA_KEY] || { classType: "none", currentResource: 0 };

    const tokenNameField = document.getElementById("token-name");
    const classTitle = document.getElementById("class-title");
    const resourceDisplay = document.getElementById("resource-display");
    const listContainer = document.getElementById("abilities-list");

    if (tokenNameField) tokenNameField.innerText = token.name || "Безымянный персонаж";
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
                
                // Записываем обновлённые метаданные обратно в токен на сервере OBR
                await OBR.scene.items.updateItems([token.id], (updatedItems) => {
                    if (updatedItems && updatedItems[0]) {
                        if (!updatedItems[0].metadata) updatedItems[0].metadata = {};
                        updatedItems[0].metadata[METADATA_KEY] = state;
                    }
                });
                
                // Локально обновляем отображение ресурса в памяти
                currentSelectedToken.metadata[METADATA_KEY] = state;
                renderTokenInterface();
            });
        }
        listContainer.appendChild(btn);
    });
}

// ==========================================
// НАСТРОЙКА КНОПОК ДЛЯ МАСТЕРА (GM ACTIONS)
// ==========================================
function setupGmActions() {
    const assignBtn = document.getElementById("assign-btn");
    const saveResBtn = document.getElementById("save-resource-btn");

    if (assignBtn) {
        assignBtn.onclick = async () => {
            if (!currentSelectedToken) return;
            const selectedClass = document.getElementById("class-select").value;
            const maxRes = selectedClass !== "none" ? CLASS_DATA[selectedClass].maxResource : 0;
            
            const newState = { classType: selectedClass, currentResource: maxRes };
            
            await OBR.scene.items.updateItems([currentSelectedToken.id], (updatedItems) => {
                if (updatedItems && updatedItems[0]) {
                    if (!updatedItems[0].metadata) updatedItems[0].metadata = {};
                    updatedItems[0].metadata[METADATA_KEY] = newState;
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

            const tokenMetadata = currentSelectedToken.metadata || {};
            const state = tokenMetadata[METADATA_KEY];

            if (state && state.classType !== "none" && CLASS_DATA[state.classType]) {
                const maxRes = CLASS_DATA[state.classType].maxResource;
                let val = parseInt(inputField.value, 10);
                if (isNaN(val)) return;
                val = Math.max(0, Math.min(maxRes, val));

                state.currentResource = val;
                
                await OBR.scene.items.updateItems([currentSelectedToken.id], (updatedItems) => {
                    if (updatedItems && updatedItems[0]) {
                        if (!updatedItems[0].metadata) updatedItems[0].metadata = {};
updatedItems[0].metadata[METADATA_KEY] = state;
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
