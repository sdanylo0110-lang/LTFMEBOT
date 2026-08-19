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
    window.scrollTo(0, 0);
  }

  return { register, go, current: () => current };
})();

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => Router.go(btn.dataset.tab));
});

document.getElementById('app').addEventListener('click', e => {
  const back = e.target.closest('[data-action="back-to-overview"]');
  if (back) Router.go('overview');
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
function fmtMoney(n) { return Math.round(n).toLocaleString('ru-RU') + ' ₽'; }

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

  renderWaterCard();

  document.getElementById('today-cal-val').textContent = `${s.nutrition.eaten} / ${s.nutrition.goal}`;
  document.getElementById('today-cal-bar').style.width = Math.min(100, (s.nutrition.eaten / s.nutrition.goal) * 100) + '%';
}
Router.register('today', renderToday);

function renderWaterCard() {
  const s = Store.getState();
  const liters = (s.water.count * s.water.mlPerGlass / 1000).toFixed(1);
  document.getElementById('today-water-val').textContent = `${s.water.count} / ${s.water.goal} стак. · ${liters} л`;
  document.getElementById('today-water-bar').style.width = Math.min(100, (s.water.count / s.water.goal) * 100) + '%';

  const row = document.getElementById('today-cup-row');
  let html = '';
  for (let i = 1; i <= s.water.goal; i++) {
    html += `<div class="cup ${i <= s.water.count ? 'filled' : ''}" data-set-water="${i}">${i <= s.water.count ? '💧' : ''}</div>`;
  }
  row.innerHTML = html;
}

document.getElementById('screen-today').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.toggleHabit) { Store.toggleHabit(t.dataset.toggleHabit); renderToday(); }
  if (t.dataset.delHabit) { Store.removeHabit(t.dataset.delHabit); renderToday(); }
  if (t.closest('[data-action="add-habit"]')) openAddHabitSheet();
  if (t.closest('[data-action="open-nutrition-detail"]')) Router.go('nutrition-detail');
  if (t.dataset.setWater) {
    const clicked = parseInt(t.dataset.setWater, 10);
    const s = Store.getState();
    // tapping the already-filled top cup removes it; otherwise fill up to it
    Store.setWater(clicked === s.water.count ? clicked - 1 : clicked);
    renderWaterCard();
  }
  if (t.closest('[data-action="water-plus"]')) { Store.addWater(1); renderWaterCard(); }
  if (t.closest('[data-action="water-minus"]')) { Store.addWater(-1); renderWaterCard(); }
});

function openAddHabitSheet() {
  Sheet.open(`
    <h3>Новая привычка</h3>
    <input class="field" id="sheet-habit-text" placeholder="Например, Читать 20 страниц" autofocus>
    <button class="primary-btn" id="sheet-habit-save">Добавить</button>
  `, root => {
    root.querySelector('#sheet-habit-save').addEventListener('click', () => {
      const val = root.querySelector('#sheet-habit-text').value.trim();
      if (val) { Store.addHabit(val); renderToday(); Sheet.close(); }
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
  const calPct = Math.min(100, (s.nutrition.eaten / s.nutrition.goal) * 100);
  const circumference = 157;
  document.getElementById('ov-cal-ring').style.strokeDashoffset = circumference - (calPct / 100) * circumference;
  const left = Math.max(0, s.nutrition.goal - s.nutrition.eaten);
  document.getElementById('ov-cal-left').textContent = `Осталось ${left} ккал`;

  document.getElementById('ov-workout').textContent = s.workout.minutes;
  document.getElementById('ov-workout-bar').style.width = Math.min(100, (s.workout.minutes / s.workout.goal) * 100) + '%';

  const todaySpend = s.transactions.filter(t => t.date === Store.todayISO() && t.type === 'expense');
  const spendTotal = todaySpend.reduce((sum, t) => sum + t.amount, 0);
  document.getElementById('ov-spend').textContent = fmtMoney(spendTotal);
  document.getElementById('ov-spend-bar').style.width = Math.min(100, (spendTotal / 2000) * 100) + '%';
  document.getElementById('ov-spend-list').innerHTML = todaySpend.slice(0, 3).map(t => `
    <li><span class="item-text">${escapeHtml(t.category)}</span><span class="muted">−${Math.round(t.amount)} ₽</span></li>
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
  if (t.closest('[data-action="open-nutrition-detail"]')) Router.go('nutrition-detail');
  if (t.closest('[data-action="open-workout-detail"]')) Router.go('workout-detail');
  if (t.closest('[data-action="open-finance-detail"]')) Router.go('finance-detail');
  if (t.closest('[data-action="add-task"]')) { e.stopPropagation(); openAddTaskSheet(); }
  if (t.closest('[data-action="add-note"]')) { e.stopPropagation(); openAddNoteSheet(); }
});

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
// FINANCE DETAIL
// ==========================================================
const CAPITAL_LABELS = {
  reserve: ['Резерв / подушка', 'На случай непредвиденного'],
  etf: ['ETF-инвестиции', 'Долгосрочный рост'],
  trading: ['Трейдинг-депозит', 'Рабочий капитал для сделок'],
  personal: ['Личное', 'Траты и хобби'],
};

function renderFinanceDetail() {
  const s = Store.getState();
  document.getElementById('fin-balance').textContent = fmtMoney(Store.getCapitalTotal());

  const recent = Store.getTransactionsSince(7);
  const income7 = recent.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const expense7 = recent.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  document.getElementById('fin-income-7d').textContent = fmtMoney(income7);
  document.getElementById('fin-expense-7d').textContent = fmtMoney(expense7);

  const alloc = document.getElementById('fin-allocation');
  alloc.innerHTML = Object.keys(CAPITAL_LABELS).map(key => `
    <div class="alloc-row" data-alloc="${key}">
      <div>
        <div class="alloc-label">${CAPITAL_LABELS[key][0]}</div>
        <div class="alloc-sub">${CAPITAL_LABELS[key][1]}</div>
      </div>
      <div class="alloc-amount">${fmtMoney(s.capital[key])}</div>
    </div>
  `).join('');

  const hist = document.getElementById('fin-history');
  hist.innerHTML = s.transactions.slice(0, 20).map(t => `
    <li>
      <span class="item-text">${escapeHtml(t.category)}${t.note ? ' · ' + escapeHtml(t.note) : ''}</span>
      <span class="${t.type === 'income' ? 'accent-teal-text' : 'muted'}">${t.type === 'income' ? '+' : '−'}${Math.round(t.amount)} ₽</span>
    </li>
  `).join('') || '<li class="muted">Пока нет операций</li>';
}
Router.register('finance-detail', renderFinanceDetail);

document.getElementById('screen-finance-detail').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-action="add-transaction"]')) openTransactionSheet();
  const allocRow = t.closest('[data-alloc]');
  if (allocRow) openAllocationSheet(allocRow.dataset.alloc);
});

function openTransactionSheet() {
  const cats = { expense: ['Продукты', 'Кофе', 'Транспорт', 'Подписка', 'Другое'], income: ['Работа', 'Агентство', 'Трейдинг', 'Другое'] };
  let type = 'expense';
  let selected = cats.expense[0];
  const render = () => `
    <h3>Новая операция</h3>
    <div class="chip-row">
      <span class="chip ${type === 'expense' ? 'selected' : ''}" data-type="expense">Расход</span>
      <span class="chip ${type === 'income' ? 'selected' : ''}" data-type="income">Доход</span>
    </div>
    <input class="field" id="sheet-amt" type="number" inputmode="numeric" placeholder="Сумма, ₽">
    <div class="chip-row" id="sheet-cats">
      ${cats[type].map((c, i) => `<span class="chip ${c === selected ? 'selected' : ''}" data-cat="${c}">${c}</span>`).join('')}
    </div>
    <button class="primary-btn" id="sheet-tx-save">Добавить</button>
  `;
  const mount = root => {
    root.querySelectorAll('[data-type]').forEach(chip => {
      chip.addEventListener('click', () => {
        type = chip.dataset.type;
        selected = cats[type][0];
        root.innerHTML = render();
        mount(root);
      });
    });
    root.querySelectorAll('[data-cat]').forEach(chip => {
      chip.addEventListener('click', () => {
        root.querySelectorAll('[data-cat]').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        selected = chip.dataset.cat;
      });
    });
    root.querySelector('#sheet-tx-save').addEventListener('click', () => {
      const amt = parseFloat(root.querySelector('#sheet-amt').value);
      if (!isNaN(amt) && amt > 0) {
        Store.addTransaction(amt, type, selected);
        renderFinanceDetail();
        renderOverview();
        Sheet.close();
      }
    });
  };
  Sheet.open(render(), mount);
}

function openAllocationSheet(key) {
  const s = Store.getState();
  Sheet.open(`
    <h3>${CAPITAL_LABELS[key][0]}</h3>
    <input class="field" id="sheet-alloc-val" type="number" inputmode="numeric" value="${s.capital[key]}">
    <button class="primary-btn" id="sheet-alloc-save">Сохранить</button>
  `, root => {
    root.querySelector('#sheet-alloc-save').addEventListener('click', () => {
      const val = parseFloat(root.querySelector('#sheet-alloc-val').value);
      if (!isNaN(val)) { Store.setCapital(key, val); renderFinanceDetail(); Sheet.close(); }
    });
  });
}

// ==========================================================
// WORKOUT DETAIL
// ==========================================================
const WEEK_DAYS = [['mon','Пн'],['tue','Вт'],['wed','Ср'],['thu','Чт'],['fri','Пт'],['sat','Сб'],['sun','Вс']];

function renderWorkoutDetail() {
  const s = Store.getState();
  document.getElementById('wk-minutes').textContent = s.workout.minutes;
  document.getElementById('wk-bar').style.width = Math.min(100, (s.workout.minutes / s.workout.goal) * 100) + '%';

  const plan = document.getElementById('wk-plan');
  plan.innerHTML = WEEK_DAYS.map(([key, label]) => `
    <div class="plan-row">
      <span class="plan-day">${label}</span>
      <input class="field" data-plan-day="${key}" placeholder="День отдыха" value="${escapeHtml(s.workoutPlan[key] || '')}">
    </div>
  `).join('');
}
Router.register('workout-detail', renderWorkoutDetail);

document.getElementById('screen-workout-detail').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.wk) { Store.addWorkoutMinutes(parseInt(t.dataset.wk, 10)); renderWorkoutDetail(); renderOverview(); }
  if (t.closest('[data-action="ai-tip-stub"]')) {
    Sheet.open(`<h3>ИИ-советы</h3><p class="muted small">Эта функция появится, когда бэкенд будет подключён к нейросети. Пока это заглушка.</p>`);
  }
});
document.getElementById('screen-workout-detail').addEventListener('change', e => {
  if (e.target.dataset.planDay) {
    Store.setWorkoutPlanDay(e.target.dataset.planDay, e.target.value);
  }
});

// ==========================================================
// NUTRITION DETAIL
// ==========================================================
const MEALS = [['breakfast','Завтрак'],['lunch','Обед'],['dinner','Ужин'],['snack','Перекус']];

function renderNutritionDetail() {
  const s = Store.getState();
  document.getElementById('nu-goal-label').textContent = `цель ${s.nutrition.goal} ккал`;
  document.getElementById('nu-eaten').textContent = s.nutrition.eaten;
  document.getElementById('nu-bar').style.width = Math.min(100, (s.nutrition.eaten / s.nutrition.goal) * 100) + '%';

  const plan = document.getElementById('nu-plan');
  plan.innerHTML = MEALS.map(([key, label]) => `
    <div class="plan-row">
      <span class="plan-day">${label}</span>
      <input class="field" data-meal="${key}" placeholder="Что съесть" value="${escapeHtml(s.mealPlan[key] || '')}">
    </div>
  `).join('');
}
Router.register('nutrition-detail', renderNutritionDetail);

document.getElementById('screen-nutrition-detail').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.nu) {
    const s = Store.getState();
    Store.setNutrition(Math.max(0, s.nutrition.eaten + parseInt(t.dataset.nu, 10)));
    renderNutritionDetail(); renderToday(); renderOverview();
  }
  if (t.closest('[data-action="edit-cal-goal"]')) {
    const s = Store.getState();
    Sheet.open(`
      <h3>Цель по калориям</h3>
      <input class="field" id="sheet-cal-goal" type="number" inputmode="numeric" value="${s.nutrition.goal}">
      <button class="primary-btn" id="sheet-cal-goal-save">Сохранить</button>
    `, root => {
      root.querySelector('#sheet-cal-goal-save').addEventListener('click', () => {
        const val = parseInt(root.querySelector('#sheet-cal-goal').value, 10);
        if (!isNaN(val) && val > 0) { Store.setNutritionGoal(val); renderNutritionDetail(); renderToday(); Sheet.close(); }
      });
    });
  }
  if (t.closest('[data-action="ai-meal-stub"]')) {
    Sheet.open(`<h3>ИИ-план питания</h3><p class="muted small">Появится, когда бэкенд будет подключён к нейросети. Пока план заполняется вручную.</p>`);
  }
});
document.getElementById('screen-nutrition-detail').addEventListener('change', e => {
  if (e.target.dataset.meal) {
    Store.setMealPlan(e.target.dataset.meal, e.target.value);
  }
});

// --- food photo (camera) stub ---
document.getElementById('food-photo-btn').addEventListener('click', () => {
  document.getElementById('food-photo-input').click();
});
document.getElementById('food-photo-input').addEventListener('change', e => {
  if (!e.target.files || !e.target.files[0]) return;
  Sheet.open(`
    <h3>Фото получено</h3>
    <p class="muted small">Распознавание калорий по фото ещё не подключено — для этого нужен бэкенд с ИИ-моделью, которая умеет анализировать изображения. Пока можно ввести калории вручную.</p>
  `);
  e.target.value = '';
});

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
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
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
  if (!selectedDay) { title.textContent = 'Выберите день'; list.innerHTML = ''; return; }
  const snap = Store.getDaySnapshot(selectedDay);
  const [y, m, d] = selectedDay.split('-');
  title.textContent = `${d} ${MONTHS[parseInt(m, 10) - 1].toLowerCase()}`;
  if (!snap) { list.innerHTML = '<li class="muted">Нет данных за этот день</li>'; return; }
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

document.getElementById('screen-analytics').addEventListener('click', e => {
  const card = e.target.closest('[data-action="chart-detail"]');
  if (card) {
    Sheet.open(`<h3>Подробная аналитика</h3><p class="muted small">Детальный разбор по дням появится здесь в следующей версии. Кнопка уже рабочая — сейчас просто заглушка.</p>`);
  }
});

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
