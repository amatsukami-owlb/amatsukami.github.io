// Глобальные переменные
let currentTokenId = null;
let isGM = false;

// 1. Инициализация при загрузке расширения
async function init() {
  // Проверяем, есть ли доступ к OR API
  if (typeof OR === 'undefined') {
    console.error('Owlbear API не найден. Проверьте manifest.json и версию Owlbear.');
    return;
  }

  // Получаем статус GM (Мастер игры)
  isGM = await OR.user.isGM();

  // Подписываемся на событие выбора токена
  OR.scene.on('selectionChanged', handleSelectionChange);
  
  // Сразу проверяем текущий выбор
  const selected = await OR.scene.getSelectedTokens();
  if (selected.length > 0) {
    handleSelectionChange(selected);
  } else {
    hideUI();
  }
}

// 2. Обработка выбора токена
async function handleSelectionChange(tokens) {
  if (!tokens || tokens.length === 0) {
    currentTokenId = null;
    hideUI();
    return;
  }

  // Берем первый выбранный токен
  const token = tokens[0];
  currentTokenId = token.id;

  // ВАЖНО: Показываем панель только если:
  // 1. Ты GM (видишь всех)
  // 2. ИЛИ ты владелец этого токена (это твой персонаж)
  const isOwner = await token.isOwnedByCurrentUser();
  
  if (!isGM && !isOwner) {
    // Это чужой токен - скрываем способности
    document.querySelector('#no-token').innerText = 'Это не ваш персонаж';
    hideUI();
    return;
  }

  loadCharacterData(token);
}

// 3. Загрузка данных персонажа из метаданных токена
async function loadCharacterData(token) {
  document.querySelector('#no-token').style.display = 'none';
  
  // Читаем данные из токена
  // Ключ 'char-sheet' - это наше собственное имя для хранения данных
  const data = await token.getMeta('char-sheet');

  const name = data?.name || token.name || 'Неизвестный герой';
  const maxMana = data?.maxMana || 20; // Дефолт 20, если не задано
  let currentMana = data?.currentMana || maxMana;

  document.querySelector('#char-name').innerText = name;
  
  updateManaUI(currentMana, maxMana);
  setupButtons(maxMana, currentMana, token);
}

// 4. Обновление интерфейса маны
function updateManaUI(current, max) {
  const el = document.getElementById('mana-display');
  el.innerText = `Мана: ${current} / ${max}`;
  el.className = 'mana-bar ' + (current < max * 0.3 ? 'mana-low' : 'mana-ok');
}

// 5. Настройка кнопок и логики
function setupButtons(maxMana, currentMana, token) {
  const buttons = document.querySelectorAll('button');
  
  buttons.forEach(btn => {
    const cost = parseInt(btn.dataset.cost, 10);
    
    // Блокируем кнопку, если маны не хватает
    if (currentMana < cost) {
      btn.disabled = true;
      btn.style.opacity = '0.6';
    } else {
      btn.disabled = false;
      btn.style.opacity = '1';
    }

    // Обработчик клика
    btn.onclick = async () => {
      if (currentMana >= cost) {
        currentMana -= cost;
        
        // Сохраняем новое значение в токен (чтобы не потерялось при перезагрузке)
        await token.setMeta('char-sheet', {
          name: token.name,
          maxMana: maxMana,
          currentMana: currentMana
        });

        // Обновляем UI
        updateManaUI(currentMana, maxMana);
        setupButtons(maxMana, currentMana, token); // Перепроверяем блокировки
        
        console.log(`Использована способность: ${btn.dataset.name}`);
      }
    };
  });
}

function hideUI() {
  document.querySelector('#char-name').style.display = 'none';
  document.querySelector('.mana-bar').style.display = 'none';
  document.querySelectorAll('button').forEach(b => b.style.display = 'none');
  document.querySelector('#no-token').style.display = 'block';
  document.querySelector('#no-token').innerText = 'Выберите токен на сцене';
}

// Запуск
init();
