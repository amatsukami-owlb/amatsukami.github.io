// 1.4
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
let myPlayerId = "";
let currentSelectedToken = null;

// ============================================================================
// НАВЕДЕНИЕ МОСТОВ: Прямой обмен сообщениями с Owlbear Rodeo
// ============================================================================

// 1. Говорим Owlbear, что наш плагин загрузился и готов к работе
window.parent.postMessage({ type: "OBR_INIT" }, "*");

// 2. Слушаем ответы от Owlbear Rodeo
window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg) return;

    // Owlbear прислал данные при старте (роль и ID игрока)
    if (msg.type === "OBR_READY") {
        myRole = msg.payload?.role || "PLAYER";
        myPlayerId = msg.payload?.playerId || "";
        console.log("Соединение установлено! Роль:", myRole);
        setupGmActions();
    }

    // Игрок кликнул на токен или сменил выделение на карте
    if (msg.type === "OBR_SCENE_SELECTION_CHANGED") {
        const selectedIds = msg.payload; // Получаем массив ID выделенных токенов
        
        if (!selectedIds || selectedIds.length !== 1) {
            hideInterface("Выберите ровно один токен персонажа (Character) на карте.");
            return;
        }

        // Запрашиваем у Owlbear полную карточку этого токена по его ID
        window.parent.postMessage({ type: "OBR_SCENE_ITEMS_GET", payload: { ids: selectedIds } }, "*");
    }

    // Owlbear вернул нам полные данные запрошенного токена
    if (msg.type === "OBR_SCENE_ITEMS_RETURN") {
        const items = msg.payload;
        if (!items || items.length === 0) return;

        const token = items[0]; // Берем наш выделенный токен

        // Проверяем, что это слой персонажей
        if (token.layer !== "CHARACTER") {
            hideInterface("Выбранный объект не является персонажем (Character). Измените тип в настройках токена.");
            return;
        }

        // ЗАЩИТА ОТ ПОДГЛЯДЫВАНИЯ ДЛЯ ИГРОКОВ
        if (myRole !== "GM") {
            // Если у токена прописаны владельцы, и текущего игрока нет в этом списке
            if (token.owners && token.owners.length > 0 && !token.owners.includes(myPlayerId)) {
                hideInterface("У вас нет прав управления этим персонажем.");
                return;
            }
        }

        // Если все проверки пройдены — сохраняем токен и рисуем меню
        currentSelectedToken = token;
        showInterface();
    }
});

// ============================================================================
// ЛОГИКА ИНТЕРФЕЙСА
// ============================================================================

function hideInterface(text) {
    currentSelectedToken = null;
    document.getElementById("main-view").style.display = "none";
    const msg = document.getElementById("no-selection-msg");
    msg.style.display = "block";
    msg.innerText = text;
}

function showInterface() {
    document.getElementById("no-selection-msg").style.display = "none";
    document.getElementById("main-view").style.display = "block";
    document.getElementById("gm-controls").style.display = myRole === "GM" ? "block" : "none";
    renderTokenInterface();
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
            btn.addEventListener("click", () => {
                const nextResource = Math.max(0, state.currentResource - ability.cost);
                state.currentResource = nextResource;
                
                // Отправляем команду обновления ресурса в Owlbear
                sendUpdateToOwlbear(token.id, state);
                
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
        assignBtn.onclick = () => {
            if (!currentSelectedToken) return;
            const selectedClass = document.getElementById("class-select").value;
            const maxRes = selectedClass !== "none" ? CLASS_DATA[selectedClass].maxResource : 0;
            
            const newState = { classType: selectedClass, currentResource: maxRes };
            sendUpdateToOwlbear(currentSelectedToken.id, newState);
            
            currentSelectedToken.metadata[METADATA_KEY] = newState;
            renderTokenInterface();
        };
    }

    if (saveResBtn) {
        saveResBtn.onclick = () => {
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
                sendUpdateToOwlbear(currentSelectedToken.id, state);
                
                currentSelectedToken.metadata[METADATA_KEY] = state;
                inputField.value = "";
                renderTokenInterface();
            } else {
                alert("Нельзя установить ресурс персонажу без назначенного класса!");
            }
        };
    }
}

// Отправка измененных метаданных обратно в карточку токена на серверах OBR
function sendUpdateToOwlbear(tokenId, newState) {
    window.parent.postMessage({
        type: "OBR_SCENE_ITEMS_UPDATE",
        payload: {
            ids: [tokenId],
            updateWith: [{ metadata: { [METADATA_KEY]: newState } }]
        }
    }, "*");
}
