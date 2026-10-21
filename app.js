// ============================================================================
// ПУЛ ИМЕН ВАШИХ ПЕРСОНАЖЕЙ (Сюда вписывайте кого угодно)
// ============================================================================
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
let activeCharacterName = null; // Для игрока: кого он контролирует в этой вкладке

OBR.onReady(async () => {
    console.log("Мост OBR успешно инициализирован!");
    myRole = await OBR.player.getRole();

    if (myRole === "GM") {
        // Включаем ГМ-экран
        document.getElementById("gm-view").style.display = "block";
        buildGmCharacterSelect();
        setupGmActions();
        await updateGmViewData();
        
        // Мастер слушает любые изменения маны от игроков в реальном времени
        window.addEventListener("message", (e) => {
            if (e.data && e.data.type === "OBR_ROOM_METADATA_CHANGED") {
                updateGmViewData();
            }
        });
    } else {
        // Включаем экран логина для игрока
        document.getElementById("player-setup-view").style.display = "block";
        setupPlayerLogin();
    }
});

// ==========================================
// ЛОГИКА ДЛЯ ИГРОКА (PLAYER)
// ==========================================
function setupPlayerLogin() {
    const loginBtn = document.getElementById("login-char-btn");
    const inputField = document.getElementById("character-name-input");

    loginBtn.onclick = async () => {
        const enteredName = inputField.value.trim();
        
        // Защита от дурака: проверяем, есть ли такое имя в пуле
        const matchedName = ALLOWED_CHARACTERS.find(c => c.toLowerCase() === enteredName.toLowerCase());

        if (!matchedName) {
            alert(`Персонаж с именем "${enteredName}" не найден в списке группы. Доступные имена: ${ALLOWED_CHARACTERS.join(", ")}`);
            return;
        }

        activeCharacterName = matchedName;
        
        // Переключаем экраны
        document.getElementById("player-setup-view").style.display = "none";
        document.getElementById("player-main-view").style.display = "block";

        await renderPlayerInterface();

        // Слушаем изменения (если ГМ поменяет ману, экран игрока обновится сам)
        window.addEventListener("message", (e) => {
            if (e.data && e.data.type === "OBR_ROOM_METADATA_CHANGED") {
                renderPlayerInterface();
            }
        });
    };
}

async function renderPlayerInterface() {
    if (!activeCharacterName) return;

    // Вытаскиваем глобальное состояние комнаты из OBR
    const context = window.OBR?.context?.roomMetadata || {};
    const globalState = context[ROOM_METADATA_KEY] || {};
    
    // Ищем данные конкретно нашего персонажа
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
            btn.addEventListener("click", async () => {
                const nextRes = Math.max(0, charState.currentResource - ability.cost);
                
                // Перезаписываем данные в глобальное облако комнаты OBR
                charState.currentResource = nextRes;
                globalState[activeCharacterName] = charState;

                window.parent.postMessage({
                    type: "OBR_ROOM_SET_METADATA",
                    payload: { [ROOM_METADATA_KEY]: globalState }
                }, "*");

                renderPlayerInterface();
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

    // При смене персонажа в списке — обновляем текст его текущего состояния
    select.onchange = async () => {
        await updateGmViewData();
    };
}

async function updateGmViewData() {
    const select = document.getElementById("gm-char-select");
    const statusLabel = document.getElementById("gm-status-label");
    if (!select || !statusLabel) return;

    const targetChar = select.value;
    const context = window.OBR?.context?.roomMetadata || {};
    const globalState = context[ROOM_METADATA_KEY] || {};
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
            
            const context = window.OBR?.context?.roomMetadata || {};
            const globalState = context[ROOM_METADATA_KEY] || {};
            
            globalState[targetChar] = { classType: selectedClass, currentResource: maxRes };

            window.parent.postMessage({
                type: "OBR_ROOM_SET_METADATA",
                payload: { [ROOM_METADATA_KEY]: globalState }
            }, "*");

            updateGmViewData();
        };
    }

    if (saveResBtn && select) {
        saveResBtn.onclick = () => {
            const targetChar = select.value;
            const inputField = document.getElementById("manual-resource-input");
            if (!targetChar || !inputField || inputField.value === "") return;

            const context = window.OBR?.context?.roomMetadata || {};
            const globalState = context[ROOM_METADATA_KEY] || {};
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
                updateGmViewData();
            } else {
                alert("Сначала назначьте класс этому персонажу!");
            }
        };
    }
}
