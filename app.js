// База данных ваших способностей, написанная вручную
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

// Ждем готовности SDK OBR
OBR.onReady(async () => {
    const role = await OBR.player.getRole();
    const myId = await OBR.player.getId();

    // 1. Если зашел ГМ — показываем панель настройки игроков
    if (role === "GM") {
        document.getElementById("gm-panel").style.display = "block";
        setupGmPanel();
    }

    // 2. Подписываемся на обновление списка игроков, чтобы локально перерисовывать интерфейс
    OBR.party.onChange((players) => {
        // Ищем себя в списке участников лобби
        const me = players.find(p => p.id === myId);
        if (me) {
            renderPlayerInterface(me);
        }
        
        if (role === "GM") {
            updateGmPlayerList(players);
        }
    });
});

// Функция отрисовки кнопок для игрока
function renderPlayerInterface(player) {
    // Достаем метаданные нашего расширения из игрока
    const state = player.metadata[METADATA_KEY] || { classType: "none", currentResource: 0 };
    
    const classTitle = document.getElementById("class-title");
    const resourceDisplay = document.getElementById("resource-display");
    const listContainer = document.getElementById("abilities-list");
    
    listContainer.innerHTML = ""; // Очищаем старые кнопки

    if (state.classType === "none" || !CLASS_DATA[state.classType]) {
        classTitle.innerText = "Класс не назначен Мастером";
        resourceDisplay.innerText = "Ресурс: —";
        return;
    }

    const currentClass = CLASS_DATA[state.classType];
    classTitle.innerText = `${currentClass.className} (${player.name})`;
    resourceDisplay.innerText = `${currentClass.resourceName}: ${state.currentResource} / ${currentClass.maxResource}`;

    // Генерируем кнопки способностей
    currentClass.abilities.forEach(ability => {
        const btn = document.createElement("button");
        btn.className = "ability-btn";
        btn.innerText = `${ability.name} (${ability.cost} ${currentClass.resourceName.slice(0,4)}.)`;
        
        // Главная проверка: если ресурса мало, кнопка становится серой (disabled)
        if (state.currentResource < ability.cost) {
            btn.disabled = true;
        } else {
            btn.onclick = () => useAbility(player, ability.cost);
        }
        
        listContainer.appendChild(btn);
    });
}

// Функция траты ресурса
async function useAbility(player, cost) {
    const state = player.metadata[METADATA_KEY];
    const nextResource = Math.max(0, state.currentResource - cost);

    // Перезаписываем метаданные игрока. OBR автоматически отправит это на сервер
    await OBR.player.setMetadata({
        [METADATA_KEY]: {
            ...state,
            currentResource: nextResource
        }
    });
}

// ЛОГИКА ДЛЯ МАСТЕРА (GM)
async function setupGmPanel() {
    const players = await OBR.party.getPlayers();
    updateGmPlayerList(players);

    document.getElementById("assign-btn").onclick = async () => {
        const targetPlayerId = document.getElementById("player-select").value;
        const selectedClass = document.getElementById("class-select").value;

        if (!targetPlayerId) return;

        const maxRes = selectedClass !== "none" ? CLASS_DATA[selectedClass].maxResource : 0;

        // Мастер обновляет метаданные конкретного выбранного игрока в лобби
        await OBR.party.setPlayerMetadata(targetPlayerId, {
            [METADATA_KEY]: {
                classType: selectedClass,
                currentResource: maxRes
            }
        });
    };
}

function updateGmPlayerList(players) {
    const select = document.getElementById("player-select");
    const currentSelection = select.value;
    select.innerHTML = "";

    players.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.innerText = p.name;
        if (p.id === currentSelection) opt.selected = true;
        select.appendChild(opt);
    });
}
