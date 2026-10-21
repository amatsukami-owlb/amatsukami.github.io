const ROOM_METADATA_KEY = "com.mygithub.ability-panel/room-state";

// Инициализируем мост OBR для фонового процесса
OBR.onReady(async () => {
    console.log("ФОНОВЫЙ СКРИПТ: Успешно запущен и имеет полные права на запись!");

    // Слушаем запросы от нашего окна-поповера (интерфейса игрока или ГМа)
    window.addEventListener("message", async (event) => {
        const msg = event.data;
        if (!msg || msg.source !== "owlbear-ability-popover") return;

        // Запрос на обновление метаданных комнаты (вызов класса или изменение маны)
        if (msg.type === "UPDATE_ROOM_METADATA") {
            try {
                const globalState = msg.payload;
                // Фоновый скрипт легально и без блокировок записывает данные в комнату!
                await OBR.room.setMetadata({ [ROOM_METADATA_KEY]: globalState });
                console.log("ФОНОВЫЙ СКРИПТ: Метаданные комнаты успешно обновлены в облаке OBR.");
            } catch (e) {
                console.error("ФОНОВЫЙ СКРИПТ: Ошибка записи в OBR:", e);
            }
        }
    });
});
