// 1.0.6
const ALLOWED_CHARACTERS = ["Mira", "Bolt", "Grom", "Taya"];

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

const ROOM_METADATA_KEY = "com.mygithub.ability-panel/room-state";

let myRole = "PLAYER";
let activeCharacterName = null; 
let latestRoomMetadata = {}; 

// ============================================================================
// НАТИВНЫЙ МОСТ С OWLBEAR RODEO
// ============================================================================

window.parent.postMessage({ type: "OBR_INIT" }, "*");

window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg) return;

    if (msg.type === "OBR_READY") {
        myRole = msg.payload?.role || "PLAYER";
        latestRoomMetadata = msg.payload?.roomMetadata || {};
        console.log("OBR_READY получен! Роль:", myRole);
        startPluginInterface();
    }

    if (msg.type === "OBR_ROOM_METADATA_CHANGED") {
        latestRoomMetadata = msg.payload || {};
        if (myRole === "GM") { updateGmViewData(); } else { renderPlayerInterface(); }
    }
});

// АВАРИЙНЫЙ РУЧНОЙ СТАРТ: Если через 1 секунду OBR не ответил, включаем плагин принудительно!
setTimeout(() => {
    // Если экраны всё ещё скрыты, значит OBR_READY завис в сети — пробиваем его вручную
    if (document.getElementById("gm-view").style.display !== "block" && 
        document.getElementById("player-setup-view").style.display !== "block") {
        
        console.log("Аварийный таймер сработал. Принудительно включаю интерфейс...");
        
        // По умолчанию открываем как PLAYER, чтобы вы или игроки могли ввести имя.
        // Если вы тестируете под аккаунтом Мастера, замените "PLAYER" на "GM" в строке ниже, чтобы сразу видеть ГМ-панель:
        myRole = "GM"; 
        
        startPluginInterface();
    }
}, 1000);

function startPluginInterface() {
    if (myRole === "GM") {
        document.getElementById("gm-view").style.display = "block";
        document.getElementById("player-setup-view").style.display = "none";
        buildGmCharacterSelect();
        setupGmActions();
        updateGmViewData();
    } else {
        document.getElementById("gm-view").style.display = "none";
        document.getElementById("player-setup-view").style.display = "block";
        setupPlayerLogin();
    }
}

// ==========================================
// ЛОГИКА ДЛЯ ИГРОКА (PLAYER)
// ==========================================
function setupPlayerLogin() {
    const loginBtn = document.getElementById("login-char-btn");
    const inputField = document.getElementById("character-name-input");

    loginBtn.onclick = () => {
        const enteredName = inputField.value.trim();
        const matchedName = ALLOWED_CHARACTERS.find(c => c.toLowerCase() === enteredName.toLowerCase());

        if (!matchedName) {
            alert(`Персонаж не найден. Доступные имена: ${ALLOWED_CHARACTERS.join(", ")}`);
            return;
        }

        activeCharacterName = matchedName;
        
        document.getElementById("player-setup-view").style.display = "none";
        document.getElementById("player-main-view").style.display = "block";

        renderPlayerInterface();
    };
}

function renderPlayerInterface() {
    if (!activeCharacterName) return;

    const globalState = latestRoomMetadata[ROOM_METADATA_KEY] || {};
    const charState = globalState[activeCharacterName] || { classType: "none", currentResource: 0 };

    document.getElementById("char-display-name").innerText = activeCharacterName;
    const classTitle = document.getElementById("class-title");
    const resourceDisplay = document.getElementById("resource-display");
    const listContainer = document.getElementById("abilities-list");

    listContainer.innerHTML = "";

    if (charState.classType === "none" || !CLASS_DATA[charState.classType]) {
        classTitle.innerText = "Класс не назначен Мастером";
        resourceDisplay.innerText = "Ресурс: —";
        return;
    }

    const currentClass = CLASS_DATA[charState.classType];
    classTitle.innerText = `Класс: ${currentClass.className}`;
    resourceDisplay.innerText = `${currentClass.resourceName}: ${charState.currentResource} / ${currentClass.maxResource}`;

    currentClass.abilities.forEach(ability => {
        const btn = document.createElement("button");
        btn.className = "ability-btn";
        btn.innerText = `${ability.name} (${ability.cost} ${currentClass.resourceName.slice(0,3)}.)`;
        
        if (charState.currentResource < ability.cost) {
            btn.disabled = true;
        } else {
            btn.addEventListener("click", () => {
                const nextRes = Math.max(0, charState.currentResource - ability.cost);
                
                charState.currentResource = nextRes;
                globalState[activeCharacterName] = charState;

                // Напрямую отправляем обновленное состояние в Owlbear Rodeo
                window.parent.postMessage({
                    type: "OBR_ROOM_SET_METADATA",
                    payload: { [ROOM_METADATA_KEY]: globalState }
                }, "*");
            });
        }
        listContainer.appendChild(btn);
    });
}

// ==========================================
// ЛОГИКА ДЛЯ МАСТЕРА (GM)
// ==========================================
function buildGmCharacterSelect() {
    const select = document.getElementById("gm-char-select");
    select.innerHTML = "";
    ALLOWED_CHARACTERS.forEach(char => {
        const opt = document.createElement("option");
        opt.value = char;
        opt.innerText = char;
        select.appendChild(opt);
    });

    select.onchange = () => {
        updateGmViewData();
    };
}

function updateGmViewData() {
    const select = document.getElementById("gm-char-select");
    const statusLabel = document.getElementById("gm-status-label");
    if (!select || !statusLabel) return;

    const targetChar = select.value;
    const globalState = latestRoomMetadata[ROOM_METADATA_KEY] || {};
    const charState = globalState[targetChar] || { classType: "none", currentResource: 0 };

    if (charState.classType === "none" || !CLASS_DATA[charState.classType]) {
        statusLabel.innerText = "Класс не назначен";
        statusLabel.style.color = "#aaa";
    } else {
        const cls = CLASS_DATA[charState.classType];
        statusLabel.innerText = `${cls.className} (${charState.currentResource} / ${cls.maxResource})`;
        statusLabel.style.color = "#ffc107";
    }
}

function setupGmActions() {
    const assignBtn = document.getElementById("assign-btn");
    const saveResBtn = document.getElementById("save-resource-btn");
    const select = document.getElementById("gm-char-select");

    if (assignBtn && select) {
        assignBtn.onclick = () => {
            const targetChar = select.value;
            const selectedClass = document.getElementById("class-select").value;
            if (!targetChar) return;

            const maxRes = selectedClass !== "none" ? CLASS_DATA[selectedClass].maxResource : 0;
            const globalState = latestRoomMetadata[ROOM_METADATA_KEY] || {};
            
            globalState[targetChar] = { classType: selectedClass, currentResource: maxRes };

            window.parent.postMessage({
                type: "OBR_ROOM_SET_METADATA",
                payload: { [ROOM_METADATA_KEY]: globalState }
            }, "*");
        };
    }

    if (saveResBtn && select) {
        saveResBtn.onclick = () => {
            const targetChar = select.value;
            const inputField = document.getElementById("manual-resource-input");
            if (!targetChar || !inputField || inputField.value === "") return;

            const globalState = latestRoomMetadata[ROOM_METADATA_KEY] || {};
            const charState = globalState[targetChar];

            if (charState && charState.classType !== "none" && CLASS_DATA[charState.classType]) {
                const maxRes = CLASS_DATA[charState.classType].maxResource;
                let val = parseInt(inputField.value, 10);
                if (isNaN(val)) return;
                val = Math.max(0, Math.min(maxRes, val));

                charState.currentResource = val;
                globalState[targetChar] = charState;

                window.parent.postMessage({
                    type: "OBR_ROOM_SET_METADATA",
                    payload: { [ROOM_METADATA_KEY]: globalState }
                }, "*");

                inputField.value = "";
            } else {
                alert("Сначала назначьте класс этому персонажу!");
            }
        };
    }
}
