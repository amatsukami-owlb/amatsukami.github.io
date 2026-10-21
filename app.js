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
// ОФИЦИАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ И СИНХРОНИЗАЦИЯ С СЕРВЕРОМ OBR
// ============================================================================
OBR.onReady(async () => {
    try {
        latestRoomMetadata = await OBR.room.getMetadata();
        console.log("Официальный мост OBR подключен к базе данных комнаты.");
    } catch(e) { 
        latestRoomMetadata = {}; 
    }
    
    // Автоматически перерисовываем интерфейсы при любых изменениях в комнате
    OBR.room.onChange((metadata) => {
        // Защита: OBR может присылать как полный объект, так и срез метаданных
        latestRoomMetadata = metadata || {};
        if (myRole === "GM") {
            updateGmMonitorTable();
        } else {
            renderPlayerInterface();
        }
    });
});

// Инициализация интерфейсных кнопок при загрузке DOM страницы
document.addEventListener("DOMContentLoaded", () => {
    const forceGmBtn = document.getElementById("force-gm-btn");
    const gmPasswordBlock = document.getElementById("gm-password-block");
    const submitPasswordBtn = document.getElementById("submit-gm-password-btn");
    const passwordInput = document.getElementById("gm-password-input");

    if (forceGmBtn && gmPasswordBlock) {
        forceGmBtn.onclick = () => {
            gmPasswordBlock.style.display = gmPasswordBlock.style.display === "none" ? "block" : "none";
        };
    }

    if (submitPasswordBtn && passwordInput) {
        submitPasswordBtn.onclick = () => {
            if (passwordInput.value === "1234") {
                myRole = "GM";
                buildGmCharacterSelect();
                setupGmActions();
                updateGmMonitorTable();

                document.getElementById("gm-view").style.display = "block";
                document.getElementById("player-setup-view").style.display = "none";
                passwordInput.value = "";
            } else {
                alert("Неверный пароль!");
                passwordInput.value = "";
            }
        };
    }

    setupPlayerLogin();
});

// ==========================================
// ЛОГИКА ДЛЯ ИГРОКА (PLAYER)
// ==========================================
function setupPlayerLogin() {
    const loginBtn = document.getElementById("login-char-btn");
    const inputField = document.getElementById("character-name-input");

    if (!loginBtn || !inputField) return;

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

    // ИСПРАВЛЕНИЕ: Безопасно ищем состояние комнаты в любом формате ответа OBR
    let globalState = {};
    if (latestRoomMetadata[ROOM_METADATA_KEY]) {
        globalState = latestRoomMetadata[ROOM_METADATA_KEY];
    } else if (latestRoomMetadata.roomMetadata && latestRoomMetadata.roomMetadata[ROOM_METADATA_KEY]) {
        globalState = latestRoomMetadata.roomMetadata[ROOM_METADATA_KEY];
    } else {
        globalState = latestRoomMetadata; // Если OBR прислал чистый срез ключей
    }

    const charState = globalState[activeCharacterName] || { classType: "none", currentResource: 0 };

    document.getElementById("char-display-name").innerText = activeCharacterName;
    const classTitle = document.getElementById("class-title");
    const resourceDisplay = document.getElementById("resource-display");
    const listContainer = document.getElementById("abilities-list");

    if (!classTitle || !resourceDisplay || !listContainer) return;
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
            btn.addEventListener("click", async () => {
                const nextRes = Math.max(0, charState.currentResource - ability.cost);
                charState.currentResource = nextRes;
                
                // Перезаписываем в правильную структуру
                const updatePayload = {};
                updatePayload[ROOM_METADATA_KEY] = globalState;
                updatePayload[ROOM_METADATA_KEY][activeCharacterName] = charState;

                // Обновляем локально для моментального отклика
                latestRoomMetadata = updatePayload;
                renderPlayerInterface();

                try {
                    await OBR.room.setMetadata(updatePayload);
                } catch(e) { console.error("Ошибка сохранения ресурса игрока:", e); }
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
    if (!select) return;
    select.innerHTML = "";
    ALLOWED_CHARACTERS.forEach(char => {
        const opt = document.createElement("option");
        opt.value = char;
        opt.innerText = char;
        select.appendChild(opt);
    });
}

function updateGmMonitorTable() {
    const tableBody = document.getElementById("gm-mon-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    
    // ИСПРАВЛЕНИЕ: Универсальный поиск состояния группы для ГМа
    let globalState = {};
    if (latestRoomMetadata[ROOM_METADATA_KEY]) {
        globalState = latestRoomMetadata[ROOM_METADATA_KEY];
    } else if (latestRoomMetadata.roomMetadata && latestRoomMetadata.roomMetadata[ROOM_METADATA_KEY]) {
        globalState = latestRoomMetadata.roomMetadata[ROOM_METADATA_KEY];
    } else {
        globalState = latestRoomMetadata;
    }

    ALLOWED_CHARACTERS.forEach(char => {
        const charState = globalState[char] || { classType: "none", currentResource: 0 };
        const tr = document.createElement("tr");

        let classLabel = "Нет";
        let resourceLabel = "—";
        let inputHtml = `<span style="color:#666; font-style:italic;">Назначьте класс</span>`;

        if (charState.classType !== "none" && CLASS_DATA[charState.classType]) {
            const cls = CLASS_DATA[charState.classType];
            classLabel = cls.className;
            resourceLabel = `${charState.currentResource} / ${cls.maxResource}`;
            
            inputHtml = `
                <div class="table-input-group">
                    <input type="number" id="input-res-${char}" min="0" max="${cls.maxResource}" placeholder="Цифра">
                    <button id="btn-save-${char}">ОК</button>
                </div>
            `;
        }

        tr.innerHTML = `<td><b>${char}</b></td><td>${classLabel}</td><td>${resourceLabel}</td><td>${inputHtml}</td>`;
        tableBody.appendChild(tr);

        if (charState.classType !== "none" && CLASS_DATA[charState.classType]) {
            const saveBtn = document.getElementById(`btn-save-${char}`);
            const inputField = document.getElementById(`input-res-${char}`);
            
            if (saveBtn && inputField) {
                saveBtn.onclick = async () => {
                    if (inputField.value === "") return;
                    let val = parseInt(inputField.value, 10);
                    const cls = CLASS_DATA[charState.classType];
                    
                    if (isNaN(val)) return;
                    val = Math.max(0, Math.min(cls.maxResource, val));

                    // РЕАКТИВНОСТЬ: Мгновенно обновляем локальную память ГМа
                    charState.currentResource = val;
                    globalState[char] = charState;
                    
                    const updatePayload = {};
                    updatePayload[ROOM_METADATA_KEY] = globalState;
                    latestRoomMetadata = updatePayload;
                    
                    // Перерисовываем таблицу для мгновенного отображения новой цифры
                    updateGmMonitorTable();

                    // Отправляем легальный запрос в облако OBR
                    try {
                        await OBR.room.setMetadata(updatePayload);
console.log("Ресурс для ${char} успешно изменен ГМом на ${val}");
} catch(e) { console.error("Ошибка сохранения ресурса ГМом:", e); }
};
}
}
});
}
function setupGmActions() {
const assignBtn = document.getElementById("assign-btn");
const select = document.getElementById("gm-char-select");
if (assignBtn && select) {
assignBtn.onclick = async () => {
const targetChar = select.value;
const selectedClass = document.getElementById("class-select").value;
if (!targetChar) return;
const maxRes = selectedClass !== "none" ? CLASS_DATA[selectedClass].maxResource : 0;
const charState = { classType: selectedClass, currentResource: maxRes };
let globalState = {};
if (latestRoomMetadata[ROOM_METADATA_KEY]) {
globalState = latestRoomMetadata[ROOM_METADATA_KEY];
} else if (latestRoomMetadata.roomMetadata && latestRoomMetadata.roomMetadata[ROOM_METADATA_KEY]) {
globalState = latestRoomMetadata.roomMetadata[ROOM_METADATA_KEY];
}
globalState[targetChar] = charState;
const updatePayload = {};
updatePayload[ROOM_METADATA_KEY] = globalState;
latestRoomMetadata = updatePayload;
updateGmMonitorTable();
try {
await OBR.room.setMetadata(updatePayload);
} catch(e) { console.error("Ошибка назначения класса ГМом:", e); }
};
}
}
