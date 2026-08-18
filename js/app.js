// ---- Telegram Mini App init ----
(function initTelegram() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg) return;
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor('#0A0C10'); } catch (e) {}
  try { tg.setBackgroundColor('#0A0C10'); } catch (e) {}
})();

// ---- Router ----
const Router = (() => {
  let current = 'today';
  const renderers = {};

  function register(name, fn) { renderers[name] = fn; }

  function go(name) {
    current = name;
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.toggle('active', s.dataset.screen === name);
    });
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    if (renderers[name]) renderers[name]();
  }

  return { register, go, current: () => current };
})();

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => Router.go(btn.dataset.tab));
});

// ---- Bottom sheet ----
const Sheet = (() => {
  const backdrop = document.getElementById('sheet-backdrop');
  const sheet = document.getElementById('sheet');
  const content = document.getElementById('sheet-content');

  function open(html, onMount) {
    content.innerHTML = html;
    backdrop.classList.add('open');
    sheet.classList.add('open');
    if (onMount) onMount(content);
  }
  function close() {
    backdrop.classList.remove('open');
    sheet.classList.remove('open');
  }
  backdrop.addEventListener('click', close);

  return { open, close };
})();

// ---- Date formatting ----
const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
function formatToday() {
  const d = new Date();
  return `${DOW[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}`;
}

// ==========================================================
// TODAY
// ==========================================================
function renderToday() {
  document.getElementById('today-date').textContent = formatToday();

  const s = Store.getState();
  const total = s.habits.length;
  const done = s.habits.filter(h => h.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('today-pct').textContent = pct + '%';
  const ring = document.getElementById('today-ring');
  const circumference = 327;
  ring.style.strokeDashoffset = circumference - (pct / 100) * circumference;

  document.getElementById('today-habit-count').textContent = `${done} из ${total}`;

  const list = document.getElementById('today-habit-list');
  list.innerHTML = s.habits.map(h => `
    <li>
      <span class="check ${h.done ? 'done' : ''}" data-toggle-habit="${h.id}"></span>
      <span class="item-text ${h.done ? 'done' : ''}">${escapeHtml(h.text)}</span>
      <span class="item-del" data-del-habit="${h.id}">✕</span>
    </li>
  `).join('') || '<li class="muted">Пока нет привычек</li>';

  document.getElementById('today-water-val').textContent = `${s.water.count} / ${s.water.goal}`;
  document.getElementById('today-water-bar').style.width = Math.min(100, (s.water.count / s.water.goal) * 100) + '%';

  document.getElementById('today-cal-val').textContent = `${s.nutrition.eaten} / ${s.nutrition.goal}`;
  document.getElementById('today-cal-bar').style.width = Math.min(100, (s.nutrition.eaten / s.nutrition.goal) * 100) + '%';
}
Router.register('today', renderToday);

document.getElementById('screen-today').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.toggleHabit) { Store.toggleHabit(t.dataset.toggleHabit); renderToday(); }
  if (t.dataset.delHabit) { Store.removeHabit(t.dataset.delHabit); renderToday(); }
  if (t.closest('[data-action="add-habit"]')) openAddHabitSheet();
  if (t.closest('[data-action="open-water"]')) openWaterSheet();
  if (t.closest('[data-action="open-nutrition"]')) openNutritionSheet();
});

function openAddHabitSheet() {
  Sheet.open(`
    <h3>Новая привычка</h3>
    <input class="field" id="sheet-habit-text" placeholder="Например, Читать 20 страниц" autofocus>
    <button class="primary-btn" id="sheet-habit-save">Добавить</button>
  `, root => {
    root.querySelector('#sheet-habit-save').addEventListener('click', () => {
      const val = root.querySelector('#sheet-habit-text').value.trim();
      if (val) { Store.addHabit(val); renderToday(); renderOverview(); Sheet.close(); }
    });
  });
}

function openWaterSheet() {
  const s = Store.getState();
  Sheet.open(`
    <h3>Вода</h3>
    <div class="stat-row"><span class="stat-num">${s.water.count}</span><span class="muted">/ ${s.water.goal} стаканов</span></div>
    <div class="chip-row">
      <span class="chip" id="w-minus">− стакан</span>
      <span class="chip" id="w-plus">+ стакан</span>
    </div>
    <button class="primary-btn" id="w-done">Готово</button>
  `, root => {
    root.querySelector('#w-plus').addEventListener('click', () => { Store.addWater(1); renderToday(); openWaterSheet(); });
    root.querySelector('#w-minus').addEventListener('click', () => { Store.addWater(-1); renderToday(); openWaterSheet(); });
    root.querySelector('#w-done').addEventListener('click', Sheet.close);
  });
}

function openNutritionSheet() {
  const s = Store.getState();
  Sheet.open(`
    <h3>Калории</h3>
    <input class="field" id="sheet-cal" type="number" inputmode="numeric" placeholder="Съедено, ккал" value="${s.nutrition.eaten || ''}">
    <button class="primary-btn" id="sheet-cal-save">Сохранить</button>
  `, root => {
    root.querySelector('#sheet-cal-save').addEventListener('click', () => {
      const val = parseInt(root.querySelector('#sheet-cal').value, 10);
      if (!isNaN(val)) { Store.setNutrition(val); renderToday(); renderOverview(); Sheet.close(); }
    });
  });
}

// ==========================================================
// OVERVIEW
// ==========================================================
function renderOverview() {
  document.getElementById('overview-date').textContent = formatToday();
  const s = Store.getState();

  document.getElementById('ov-cal').textContent = s.nutrition.eaten;
  document.getElementById('ov-cal-bar').style.width = Math.min(100, (s.nutrition.eaten / s.nutrition.goal) * 100) + '%';

  document.getElementById('ov-workout').textContent = s.workout.minutes;
  document.getElementById('ov-workout-bar').style.width = Math.min(100, (s.workout.minutes / s.workout.goal) * 100) + '%';

  const todaySpend = s.spending.filter(sp => sp.date === Store.todayISO());
  const spendTotal = todaySpend.reduce((sum, sp) => sum + sp.amount, 0);
  document.getElementById('ov-spend').textContent = spendTotal + ' ₽';
  document.getElementById('ov-spend-list').innerHTML = todaySpend.slice(0, 3).map(sp => `
    <li><span class="item-text">${escapeHtml(sp.category)}</span><span class="muted">−${sp.amount} ₽</span></li>
  `).join('') || '<li class="muted">Пока нет трат</li>';

  const activeTasks = s.tasks.filter(t => !t.done);
  document.getElementById('ov-tasks').textContent = activeTasks.length;

  document.getElementById('ov-notes-list').innerHTML = s.notes.slice(0, 2).map(n => `
    <li class="item-text">${escapeHtml(n.text)}</li>
  `).join('') || '<li class="muted">Пока нет заметок</li>';
}
Router.register('overview', renderOverview);

document.getElementById('screen-overview').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-action="open-nutrition"]')) openNutritionSheet();
  if (t.closest('[data-action="open-workout"]')) openWorkoutSheet();
  if (t.closest('[data-action="add-spend"]')) openAddSpendSheet();
  if (t.closest('[data-action="add-task"]')) openAddTaskSheet();
  if (t.closest('[data-action="add-note"]')) openAddNoteSheet();
});

function openWorkoutSheet() {
  const s = Store.getState();
  Sheet.open(`
    <h3>Тренировка</h3>
    <input class="field" id="sheet-workout" type="number" inputmode="numeric" placeholder="Минут сегодня" value="${s.workout.minutes || ''}">
    <button class="primary-btn" id="sheet-workout-save">Сохранить</button>
  `, root => {
    root.querySelector('#sheet-workout-save').addEventListener('click', () => {
      const val = parseInt(root.querySelector('#sheet-workout').value, 10);
      if (!isNaN(val)) {
        Store.addWorkoutMinutes(val - s.workout.minutes);
        renderOverview();
        Sheet.close();
      }
    });
  });
}

function openAddSpendSheet() {
  const cats = ['Продукты', 'Кофе', 'Транспорт', 'Подписка', 'Другое'];
  let selected = cats[0];
  Sheet.open(`
    <h3>Новая трата</h3>
    <input class="field" id="sheet-amt" type="number" inputmode="numeric" placeholder="Сумма, ₽">
    <div class="chip-row" id="sheet-cats">
      ${cats.map((c, i) => `<span class="chip ${i === 0 ? 'selected' : ''}" data-cat="${c}">${c}</span>`).join('')}
    </div>
    <button class="primary-btn" id="sheet-spend-save">Добавить</button>
  `, root => {
    root.querySelectorAll('[data-cat]').forEach(chip => {
      chip.addEventListener('click', () => {
        root.querySelectorAll('[data-cat]').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        selected = chip.dataset.cat;
      });
    });
    root.querySelector('#sheet-spend-save').addEventListener('click', () => {
      const amt = parseFloat(root.querySelector('#sheet-amt').value);
      if (!isNaN(amt) && amt > 0) {
        Store.addSpend(amt, selected);
        renderOverview();
        Sheet.close();
      }
    });
  });
}

function openAddTaskSheet() {
  Sheet.open(`
    <h3>Новая задача</h3>
    <input class="field" id="sheet-task-text" placeholder="Что нужно сделать">
    <button class="primary-btn" id="sheet-task-save">Добавить</button>
  `, root => {
    root.querySelector('#sheet-task-save').addEventListener('click', () => {
      const val = root.querySelector('#sheet-task-text').value.trim();
      if (val) { Store.addTask(val); renderOverview(); Sheet.close(); }
    });
  });
}

function openAddNoteSheet() {
  Sheet.open(`
    <h3>Новая заметка</h3>
    <input class="field" id="sheet-note-text" placeholder="Мысль или запись">
    <button class="primary-btn" id="sheet-note-save">Сохранить</button>
  `, root => {
    root.querySelector('#sheet-note-save').addEventListener('click', () => {
      const val = root.querySelector('#sheet-note-text').value.trim();
      if (val) { Store.addNote(val); renderOverview(); Sheet.close(); }
    });
  });
}

// ==========================================================
// HISTORY
// ==========================================================
let historyCursor = new Date();
historyCursor.setDate(1);
let selectedDay = null;

function renderHistory() {
  const y = historyCursor.getFullYear();
  const m = historyCursor.getMonth();
  document.getElementById('history-month-label').textContent = `${MONTHS[m]} ${y}`;

  const snapshots = Store.getMonthSnapshots(y, m);
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const grid = document.getElementById('history-grid');
  let html = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => `<div class="cal-dow">${d}</div>`).join('');

  for (let i = 0; i < firstDow; i++) html += `<div class="cal-day empty"></div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateISO = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const snap = snapshots[dateISO];
    const pct = snap ? snap.pct : null;
    let level = 'l0';
    if (pct !== null) {
      if (pct >= 90) level = 'l4';
      else if (pct >= 70) level = 'l3';
      else if (pct >= 40) level = 'l2';
      else level = 'l1';
    }
    const isToday = dateISO === Store.todayISO();
    const isSelected = dateISO === selectedDay;
    html += `<div class="cal-day ${level} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-day="${dateISO}">
      ${day}${pct !== null ? `<span class="pct">${pct}%</span>` : ''}
    </div>`;
  }
  grid.innerHTML = html;

  if (!selectedDay || snapshots[selectedDay] === undefined) {
    selectedDay = snapshots[Store.todayISO()] ? Store.todayISO() : null;
  }
  renderDayDetail();
}
Router.register('history', renderHistory);

function renderDayDetail() {
  const title = document.getElementById('history-day-title');
  const list = document.getElementById('history-day-list');
  if (!selectedDay) {
    title.textContent = 'Выберите день';
    list.innerHTML = '';
    return;
  }
  const snap = Store.getDaySnapshot(selectedDay);
  const [y, m, d] = selectedDay.split('-');
  title.textContent = `${d} ${MONTHS[parseInt(m, 10) - 1].toLowerCase()}`;
  if (!snap) {
    list.innerHTML = '<li class="muted">Нет данных за этот день</li>';
    return;
  }
  list.innerHTML = `
    <li><span class="item-text">Привычки выполнены</span><span class="muted">${snap.pct}%</span></li>
    <li><span class="item-text">Калории</span><span class="muted">${snap.calories} ккал</span></li>
    <li><span class="item-text">Траты</span><span class="muted">${snap.spending} ₽</span></li>
  `;
}

document.getElementById('screen-history').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-action="hist-prev"]')) { historyCursor.setMonth(historyCursor.getMonth() - 1); renderHistory(); }
  if (t.closest('[data-action="hist-next"]')) { historyCursor.setMonth(historyCursor.getMonth() + 1); renderHistory(); }
  const dayEl = t.closest('[data-day]');
  if (dayEl) { selectedDay = dayEl.dataset.day; renderHistory(); }
});

// ==========================================================
// ANALYTICS
// ==========================================================
function renderAnalytics() {
  const days = Store.getRecentDays(14);

  const pcts = days.map(d => d.pct ?? 0);
  const avgPct = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  document.getElementById('an-habit-avg').textContent = avgPct + '%';
  Charts.line(document.getElementById('chart-habits'), pcts, { color: '#2C8C7F', max: 100 });

  const cals = days.map(d => d.calories ?? 0);
  const avgCal = Math.round(cals.reduce((a, b) => a + b, 0) / cals.length);
  document.getElementById('an-cal-avg').textContent = avgCal + ' ккал';
  Charts.line(document.getElementById('chart-calories'), cals, { color: '#4A6FA0' });

  const spends = days.map(d => d.spending ?? 0);
  const avgSpend = Math.round(spends.reduce((a, b) => a + b, 0) / spends.length);
  document.getElementById('an-spend-avg').textContent = avgSpend + ' ₽';
  Charts.bars(document.getElementById('chart-spending'), spends, { color: '#A9803D' });
}
Router.register('analytics', renderAnalytics);

// ==========================================================
// ASSISTANT
// ==========================================================
function renderAssistant() {
  const log = document.getElementById('chat-log');
  if (log.children.length === 0) {
    addMessage('bot', 'Привет! Здесь будет ИИ-помощник по твоим данным. Бэкенд пока не подключён — это заготовка интерфейса под будущую интеграцию.');
  }
}
Router.register('assistant', renderAssistant);

function addMessage(role, text) {
  const log = document.getElementById('chat-log');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollIntoView({ block: 'end' });
}

document.getElementById('chat-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('chat-text');
  const val = input.value.trim();
  if (!val) return;
  addMessage('user', val);
  input.value = '';
  // Placeholder response — replace with real backend call when ready.
  setTimeout(() => addMessage('bot', 'Пока отвечаю заглушкой — подключение к настоящей модели будет добавлено отдельно.'), 300);
});

// ---- utils ----
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- boot ----
Router.go('today');
