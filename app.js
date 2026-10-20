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

OBR.onReady(async () => {
    try {
        const role = await OBR.player.getRole();

        if (role === "GM") {
            // Включаем интерфейс мастера
            document.getElementById("gm-view").style.display = "block";
            initGmInterface();
        } else {
            // Включаем интерфейс игрока
            document.getElementById("player-view").style.display = "block";
            initPlayerInterface();
        }
    } catch (e) {
        console.error("Ошибка инициализации:", e);
    }
});

// ==========================================
// ЛОГИКА ДЛЯ ИГРОКА (PLAYER VIEW)
// ==========================================
async function initPlayerInterface() {
    const myId = await OBR.player.getId();
    const myName = await OBR.player.getName();
    
    // Рисуем интерфейс сразу
    const initialMetadata = await OBR.player.getMetadata();
    renderPlayer({ id: myId, name: myName, metadata: initialMetadata });

    // Следим за изменениями своего персонажа (если ГМ поменяет нам класс или ману)
    OBR.player.onChange((player) => {
        renderPlayer(player);
    });
}

function renderPlayer(player) {
    const state = player.metadata[METADATA_KEY] || { classType: "none", currentResource: 0 };
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
    classTitle.innerText = `${currentClass.className} (${player.name})`;
    resourceDisplay.innerText = `${currentClass.resourceName}: ${state.currentResource} / ${currentClass.maxResource}`;

    currentClass.abilities.forEach(ability => {
        const btn = document.createElement("button");
        btn.className = "ability-btn";
        btn.innerText = `${ability.name} (${ability.cost} ${currentClass.resourceName.slice(0,3)}.)`;
        
        if (state.currentResource < ability.cost) {
            btn.disabled = true;
        } else {
            btn.onclick = async () => {
                const nextResource = Math.max(0, state.currentResource - ability.cost);
                await OBR.player.setMetadata({
                    [METADATA_KEY]: { ...state, currentResource: nextResource }
                });
            };
        }
        listContainer.appendChild(btn);
    });
}

// ==========================================
// ЛОГИКА ДЛЯ МАСТЕРА (GM VIEW)
// ==========================================
async function initGmInterface() {
    // Собираем всех участников и обновляем ГМ-панель
    await refreshGmPanel();

    // Автоматически перерисовываем таблицу ГМа, когда игроки тратят ресурсы
    OBR.party.onChange(async () => {
        await refreshGmPanel();
    });
}

async function refreshGmPanel() {
    const myId = await OBR.player.getId();
    const myName = await OBR.player.getName();
    const myMetadata = await OBR.player.getMetadata();
    
    // В OBR создатель комнаты — тоже игрок, добавляем его в общий список
    const gmUser = { id: myId, name: myName + " (Вы/GM)", metadata: myMetadata };
    const remotePlayers = await OBR.party.getPlayers();
    const allUsers = [gmUser, ...remotePlayers];

    // 1. Обновляем выпадающий список выбора игроков
    const select = document.getElementById("player-select");
    const currentSelection = select.value;
    select.innerHTML = "";
    
    // 2. Заполняем таблицу мониторинга
    const tableBody = document.getElementById("party-status-list");
    tableBody.innerHTML = "";

    allUsers.forEach(p => {
        // Добавляем в выпадающее меню
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.innerText = p.name;
        if (p.id === currentSelection) opt.selected = true;
        select.appendChild(opt);

        // Добавляем строчку в таблицу статуса
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

    // Кнопка: Назначить класс
    document.getElementById("assign-btn").onclick = async () => {
        const targetId = select.value;
        const selectedClass = document.getElementById("class-select").value;
        if (!targetId) return;

        const maxRes = selectedClass !== "none" ? CLASS_DATA[selectedClass].maxResource : 0;
        const newState = { classType: selectedClass, currentResource: maxRes };

        if (targetId === myId) {
            await OBR.player.setMetadata({ [METADATA_KEY]: newState });
        } else {
            await OBR.party.setPlayerMetadata(targetId, { [METADATA_KEY]: newState });
        }
        await refreshGmPanel();
    };

    // Кнопка: Полный отдых (Восстановить ресурс до максимума)
    document.getElementById("rest-btn").onclick = async () => {
        const targetId = select.value;
        if (!targetId) return;

        const targetUser = allUsers.find(u => u.id === targetId);
        const state = targetUser?.metadata[METADATA_KEY];
        
        if (state && state.classType !== "none" && CLASS_DATA[state.classType]) {
            const maxRes = CLASS_DATA[state.classType].maxResource;
            const newState = { ...state, currentResource: maxRes };

            if (targetId === myId) {
                await OBR.player.setMetadata({ [METADATA_KEY]: newState });
            } else {
                await OBR.party.setPlayerMetadata(targetId, { [METADATA_KEY]: newState });
            }
            await refreshGmPanel();
        }
    };
}
