// 1.0.3 ============================================================================
// ВСТРОЕННЫЙ SDK OWLBEAR RODEO (С поддержкой работы со сценой и токенами)
// ============================================================================
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((e="undefined"!=typeof globalThis?globalThis:e||self).OBR={})}(this,(function(e){"use strict";var t={onReady:function(e){var t=this;window.addEventListener("message",(function(n){if(n.data&&"OBR_READY"===n.data.type){var o=n.data.payload;t.context=o,e()}})),window.parent.postMessage({type:"OBR_INIT"},"*")},player:{getRole:function(){return Promise.resolve(t.context?.role||"PLAYER")},getId:function(){return Promise.resolve(t.context?.playerId||"")}},scene:{onSelectionChange:function(e){window.addEventListener("message",(function(t){t.data&&"OBR_SCENE_SELECTION_CHANGED"===t.data.type&&e(t.data.payload)}))},items:{updateItems:function(e,t){window.parent.postMessage({type:"OBR_SCENE_ITEMS_UPDATE",payload:{ids:e,updateWith:t}},"*");return Promise.resolve()}}}};e.onReady=t.onReady.bind(t),e.player=t.player,e.scene=t.scene,Object.defineProperty(e,"__esModule",{value:!0})}));

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
    
    // Подписываемся на выделение токенов на карте стола
    OBR.scene.onSelectionChange((selectedIds) => {
        handleSelection(selectedIds);
    });
});

// Обработка клика по токену на карте
async function handleSelection(selectedIds) {
    const noSelectionMsg = document.getElementById("no-selection-msg");
    const mainView = document.getElementById("main-view");
    const gmControls = document.getElementById("gm-controls");

    // Если ничего не выбрано или выбрано несколько объектов
    if (!selectedIds || selectedIds.length !== 1) {
        currentSelectedToken = null;
        mainView.style.display = "none";
        noSelectionMsg.style.display = "block";
        noSelectionMsg.innerText = "Выберите ровно один токен персонажа (Character) на карте.";
        return;
    }

    // Запрашиваем данные о выбранном токене из Owlbear через событие payload
    // Примечание: В мини-SDK данные элемента приходят в массиве выбранных объектов
    const token = selectedIds[0]; 
    
    // Проверяем, является ли объект персонажем (CHARACTER)
    if (!token || token.layer !== "CHARACTER") {
        currentSelectedToken = null;
        mainView.style.display = "none";
        noSelectionMsg.style.display = "block";
        noSelectionMsg.innerText = "Выбранный объект не является персонажем (Character).";
        return;
    }

    // ПРОВЕРКА ПРАВ ДОСТУПА ДЛЯ ИГРОКА
    if (myRole !== "GM") {
        const myId = await OBR.player.getId();
        // Если у токена заполнено поле создателя/контроллера, и оно не совпадает с вашим ID
        if (token.createdBy && token.createdBy !== myId) {
            currentSelectedToken = null;
            mainView.style.display = "none";
            noSelectionMsg.style.display = "block";
            noSelectionMsg.innerText = "У вас нет прав управления этим персонажем.";
            return;
        }
    }

    // Сохраняем текущий активный токен в память плагина
    currentSelectedToken = token;

    // Включаем отображение интерфейса
    noSelectionMsg.style.display = "none";
    mainView.style.display = "block";

    // Показываем панель управления, если зашел Мастер (GM)
    if (myRole === "GM") {
        gmControls.style.display = "block";
    } else {
        gmControls.style.display = "none";
    }

    // Отрисовываем данные токена
    renderTokenInterface();
}

function renderTokenInterface() {
    if (!currentSelectedToken) return;

    const token = currentSelectedToken;
    const state = token.metadata[METADATA_KEY] || { classType: "none", currentResource: 0 };

    document.getElementById("token-name").innerText = token.name || "Безымянный персонаж";
    
    const classTitle = document.getElementById("class-title");
    const resourceDisplay = document.getElementById("resource-display");
    const listContainer = document.getElementById("abilities-list");

    listContainer.innerHTML = "";

    if (state.classType === "none" || !CLASS_DATA[state.classType]) {
        classTitle.innerText = "Класс не назначен";
        resourceDisplay.innerText = "Ресурс: —";
        return;
    }

    const currentClass = CLASS_DATA[state.classType];
    classTitle.innerText = `Класс: ${currentClass.className}`;
    resourceDisplay.innerText = `${currentClass.resourceName}: ${state.currentResource} / ${currentClass.maxResource}`;

    // Рисуем кнопки способностей персонажа
    currentClass.abilities.forEach(ability => {
        const btn = document.createElement("button");
        btn.className = "ability-btn";
        btn.innerText = `${ability.name} (${ability.cost} ${currentClass.resourceName.slice(0,3)}.)`;
        
        if (state.currentResource < ability.cost) {
            btn.disabled = true;
        } else {
            btn.addEventListener("click", async () => {
                const nextResource = Math.max(0, state.currentResource - ability.cost);
                
                // Обновляем метаданные прямо внутри самого токена на сцене!
                state.currentResource = nextResource;
                token.metadata[METADATA_KEY] = state;
                
                await OBR.scene.items.updateItems([token.id], (items) => {
                    if(items[0]) items[0].metadata[METADATA_KEY] = state;
                });
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
            
            currentSelectedToken.metadata[METADATA_KEY] = newState;
            await OBR.scene.items.updateItems([currentSelectedToken.id], (items) => {
                if(items[0]) items[0].metadata[METADATA_KEY] = newState;
            });
            renderTokenInterface();
        };
    }

    if (saveResBtn) {
        saveResBtn.onclick = async () => {
            if (!currentSelectedToken) return;
            const inputField = document.getElementById("manual-resource-input");
            if (!inputField || inputField.value === "") return;

            const state = currentSelectedToken.metadata[METADATA_KEY];
            if (state && state.classType !== "none" && CLASS_DATA[state.classType]) {
                const maxRes = CLASS_DATA[state.classType].maxResource;
                let val = parseInt(inputField.value, 10);
                if (isNaN(val)) return;
                val = Math.max(0, Math.min(maxRes, val));

                state.currentResource = val;
                currentSelectedToken.metadata[METADATA_KEY] = state;
                
                await OBR.scene.items.updateItems([currentSelectedToken.id], (items) => {
                    if(items[0]) items[0].metadata[METADATA_KEY] = state;
                });
                
                inputField.value = "";
                renderTokenInterface();
            } else {
                alert("Нельзя установить ресурс токену без назначенного класса!");
            }
        };
    }
}
