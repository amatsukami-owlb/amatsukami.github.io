const CLASS_DATA = {
    warrior: {
        className: "Воин",
        resourceName: "Выносливость",
        maxResource: 100,
        abilities: [
            { name: "Мощный удар", cost: 25, desc: "Наносит физический урон" },
            { name: "Рывок", cost: 40, desc: "Приближает к цели" }
        ]
    },
    mage: {
        className: "Маг",
        resourceName: "Мана",
        maxResource: 120,
        abilities: [
            { name: "Огненный шар", cost: 30, desc: "Взрыв в радиусе" },
            { name: "Чародейская вспышка", cost: 15, desc: "Быстрое заклинание" }
        ]
    }
};

const METADATA_KEY = "com.mygithub.ability-panel/player-state";

OBR.onReady(async () => {
    try {
        const role = await OBR.player.getRole();
        const myId = await OBR.player.getId();

        // 1. Показываем панель мастера, если зашел ГМ
        if (role === "GM") {
            const gmPanel = document.getElementById("gm-panel");
            if (gmPanel) gmPanel.style.display = "block";
            await setupGmPanel();
        }

        // 2. Первичная отрисовка самого себя при старте плагина
        const initialMetadata = await OBR.player.getMetadata();
        const myName = await OBR.player.getName();
        // Собираем виртуального игрока для функции отрисовки
        const fakeMe = { id: myId, name: myName, metadata: initialMetadata };
        renderPlayerInterface(fakeMe);

        // 3. Отслеживаем изменения нашей собственной карточки игрока
        OBR.player.onChange((player) => {
            renderPlayerInterface(player);
        });

        // 4. Отслеживаем изменения списка остальных игроков (для панели GM)
        OBR.party.onChange(async (players) => {
            if (role === "GM") {
                // Получаем актуальные данные ГМа
                const currentMetadata = await OBR.player.getMetadata();
                const currentName = await OBR.player.getName();
                const gmUser = { id: myId, name: currentName + " (Вы/GM)", metadata: currentMetadata };
                
                // Объединяем ГМа и игроков в один список для выпадающего меню
                updateGmPlayerList([gmUser, ...players]);
            }
        });

    } catch (error) {
        console.error("Ошибка инициализации OBR плагина:", error);
    }
});

function renderPlayerInterface(player) {
    if (!player || !player.metadata) return;

    const state = player.metadata[METADATA_KEY] || { classType: "none", currentResource: 0 };
    
    const classTitle = document.getElementById("class-title");
    const resourceDisplay = document.getElementById("resource-display");
    const listContainer = document.getElementById("abilities-list");
    
    if (!classTitle || !resourceDisplay || !listContainer) return;
    
    listContainer.innerHTML = ""; 

    if (state.classType === "none" || !CLASS_DATA[state.classType]) {
        classTitle.innerText = "Класс не назначен";
        resourceDisplay.innerText = "Ресурс: —";
        return;
    }

    const currentClass = CLASS_DATA[state.classType];
    classTitle.innerText = `${currentClass.className} (${player.name})`;
    resourceDisplay.innerText = `${currentClass.resourceName}: ${state.currentResource} / ${currentClass.maxResource}`;

    currentClass.abilities.forEach(ability => {
        const btn = document.createElement("button");
        btn.className = "ability-btn";
        btn.innerText = `${ability.name} (${ability.cost} ${currentClass.resourceName.slice(0,4)}.)`;
        
        if (state.currentResource < ability.cost) {
            btn.disabled = true;
        } else {
            btn.onclick = () => useAbility(player, ability.cost);
        }
        
        listContainer.appendChild(btn);
    });
}

async function useAbility(player, cost) {
    const state = player.metadata[METADATA_KEY];
    const nextResource = Math.max(0, state.currentResource - cost);

    // Сохраняем обратно в метаданные текущего игрока через OBR.player
    await OBR.player.setMetadata({
        [METADATA_KEY]: {
            ...state,
            currentResource: nextResource
        }
    });
}

async function setupGmPanel() {
    const myId = await OBR.player.getId();
    const myName = await OBR.player.getName();
    const myMetadata = await OBR.player.getMetadata();
    const gmUser = { id: myId, name: myName + " (Вы/GM)", metadata: myMetadata };

    const players = await OBR.party.getPlayers();
    updateGmPlayerList([gmUser, ...players]);

    const assignBtn = document.getElementById("assign-btn");
    if (assignBtn) {
        assignBtn.onclick = async () => {
            const targetPlayerId = document.getElementById("player-select").value;
            const selectedClass = document.getElementById("class-select").value;

            if (!targetPlayerId) return;

            const maxRes = selectedClass !== "none" ? CLASS_DATA[selectedClass].maxResource : 0;
            const newState = { classType: selectedClass, currentResource: maxRes };

            // Если ГМ назначает класс САМ СЕБЕ
            if (targetPlayerId === myId) {
                await OBR.player.setMetadata({ [METADATA_KEY]: newState });
            } else {
                // Если ГМ назначает класс другому игроку из party
                await OBR.party.setPlayerMetadata(targetPlayerId, { [METADATA_KEY]: newState });
            }
        };
    }
}

function updateGmPlayerList(allRoomUsers) {
    const select = document.getElementById("player-select");
    if (!select) return;
    
    const currentSelection = select.value;
    select.innerHTML = "";

    allRoomUsers.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.innerText = p.name;
        if (p.id === currentSelection) opt.selected = true;
        select.appendChild(opt);
    });
}
