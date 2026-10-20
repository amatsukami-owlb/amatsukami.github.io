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

function startPlugin() {
    if (typeof OBR === "undefined") return;
    clearInterval(checkObrInterval);

    OBR.onReady(async () => {
        try {
            const role = await OBR.player.getRole();

            if (role === "GM") {
                const gmView = document.getElementById("gm-view");
                if (gmView) gmView.className = "visible-view";
                initGmInterface();
            } else {
                const playerView = document.getElementById("player-view");
                if (playerView) playerView.className = "visible-view";
                initPlayerInterface();
            }
        } catch (e) {
            console.error("Ошибка инициализации SDK:", e);
        }
    });
}

const checkObrInterval = setInterval(startPlugin, 100);

// ==========================================
// ЛОГИКА ДЛЯ ИГРОКА (PLAYER VIEW)
// ==========================================
async function initPlayerInterface() {
    try {
        const myId = await OBR.player.getId();
        const myName = await OBR.player.getName();
        const initialMetadata = await OBR.player.getMetadata();
        
        renderPlayer({ id: myId, name: myName, metadata: initialMetadata });

        OBR.player.onChange((player) => {
            renderPlayer(player);
        });
    } catch (e) {
        console.error("Ошибка интерфейса игрока:", e);
    }
}

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
            // Безопасное назначение клика черезaddEventListener без инлайн-кода
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
// ЛОГИКА ДЛЯ МАСТЕРА (GM VIEW)
// ==========================================
async function initGmInterface() {
    setupGmActions();
    await refreshGmPanel();

    OBR.party.onChange(async () => {
        await refreshGmPanel();
    });
}

async function refreshGmPanel() {
    try {
        const myId = await OBR.player.getId();
        const myName = await OBR.player.getName();
        const myMetadata = await OBR.player.getMetadata();
        
        const gmUser = { id: myId, name: myName + " (Вы/GM)", metadata: myMetadata };
        
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
        console.error("Ошибка обновления панели GM:", e);
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
    const myId = await OBR.player.getId();
    if (targetId === myId) {
        await OBR.player.setMetadata({ [METADATA_KEY]: newState });
    } else {
        await OBR.party.setPlayerMetadata(targetId, { [METADATA_KEY]: newState });
    }
}

async function findUserById(id) {
    const myId = await OBR.player.getId();
    const myName = await OBR.player.getName();
    const myMetadata = await OBR.player.getMetadata();
    
    if (id === myId) return { id: myId, name: myName, metadata: myMetadata };
    
    const remotePlayers = await OBR.party.getPlayers();
    return remotePlayers.find(p => p.id === id);
}
