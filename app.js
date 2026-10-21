// 2.0.7
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

// ============================================================================
// АВТОНОМНЫЙ ЗАПУСК КНОПОК (Работает мгновенно, не дожидаясь ответов OBR!)
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
    const forceGmBtn = document.getElementById("force-gm-btn");
    const gmPasswordBlock = document.getElementById("gm-password-block");
    const submitPasswordBtn = document.getElementById("submit-gm-password-btn");
    const passwordInput = document.getElementById("gm-password-input");
    const errorMsg = document.getElementById("gm-error-msg");

    // 1. По клику на желтую ссылку МГНОВЕННО разворачиваем поле ввода пароля
    if (forceGmBtn && gmPasswordBlock) {
        forceGmBtn.onclick = () => {
            gmPasswordBlock.style.display = gmPasswordBlock.style.display === "none" ? "block" : "none";
            if (errorMsg) errorMsg.style.display = "none";
        };
    }

    // 2. Проверяем пароль Мастера при клике на ОК
    if (submitPasswordBtn && passwordInput) {
        submitPasswordBtn.onclick = async () => {
            // ВАШ СЕКРЕТНЫЙ ПАРОЛЬ (Поменяйте "1234" на любой свой)
            if (passwordInput.value === "1234") {
                myRole = "GM";
                document.getElementById("gm-view").style.display = "block";
                document.getElementById("player-setup-view").style.display = "none";
                
                // Только теперь запускаем функции ГМа внутри OBR
                OBR.onReady(async () => {
                    buildGmCharacterSelect();
                    setupGmActions();
                    await updateGmViewData();
                    
                    OBR.room.onChange(async () => {
                        await updateGmViewData();
                    });
                });
            } else {
                if (errorMsg) errorMsg.style.display = "block";
                passwordInput.value = "";
            }
        };
    }

    // 3. Инициализируем вход для игрока
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

        // Запускаем синхронизацию игрока с OBR после успешного ввода имени
        OBR.onReady(async () => {
            await renderPlayerInterface();
            OBR.room.onChange(async () => {
                await renderPlayerInterface();
            });
        });
    };
}

async function renderPlayerInterface() {
    if (!activeCharacterName) return;

    const context = await OBR.room.getMetadata();
    const globalState = context[ROOM_METADATA_KEY] || {};
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
                globalState[activeCharacterName] = charState;

                await OBR.room.setMetadata({ [ROOM_METADATA_KEY]: globalState });
                await renderPlayerInterface();
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

    select.onchange = async () => {
        await updateGmViewData();
    };
}

async function updateGmViewData() {
    const select = document.getElementById("gm-char-select");
    const statusLabel = document.getElementById("gm-status-label");
    if (!select || !statusLabel) return;

    const targetChar = select.value;
    const context = await OBR.room.getMetadata();
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
        assignBtn.onclick = async () => {
            const targetChar = select.value;
            const selectedClass = document.getElementById("class-select").value;
            if (!targetChar) return;

            const maxRes = selectedClass !== "none" ? CLASS_DATA[selectedClass].maxResource : 0;
            const context = await OBR.room.getMetadata();
            const globalState = context[ROOM_METADATA_KEY] || {};
            
            globalState[targetChar] = { classType: selectedClass, currentResource: maxRes };

            await OBR.room.setMetadata({ [ROOM_METADATA_KEY]: globalState });
            await updateGmViewData();
        };
    }

    if (saveResBtn && select) {
        saveResBtn.onclick = async () => {
            const targetChar = select.value;
            const inputField = document.getElementById("manual-resource-input");
            if (!targetChar || !inputField || inputField.value === "") return;

            const context = await OBR.room.getMetadata();
            const globalState = context[ROOM_METADATA_KEY] || {};
            const charState = globalState[targetChar];

            if (charState && charState.classType !== "none" && CLASS_DATA[charState.classType]) {
                const maxRes = CLASS_DATA[charState.classType].maxResource;
                let val = parseInt(inputField.value, 10);
                if (isNaN(val)) return;
                val = Math.max(0, Math.min(maxRes, val));

                charState.currentResource = val;
                globalState[targetChar] = charState;

                await OBR.room.setMetadata({ [ROOM_METADATA_KEY]: globalState });
                inputField.value = "";
                await updateGmViewData();
            } else {
                alert("Сначала назначьте класс этому персонажу!");
            }
        };
    }
}
