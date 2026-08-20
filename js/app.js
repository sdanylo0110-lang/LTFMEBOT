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
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === name));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    if (renderers[name]) renderers[name]();
    window.scrollTo(0, 0);
  }
  return { register, go, current: () => current };
})();

document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => Router.go(btn.dataset.tab)));
document.getElementById('app').addEventListener('click', e => {
  if (e.target.closest('[data-action="back-to-overview"]')) Router.go('overview');
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
  function close() { backdrop.classList.remove('open'); sheet.classList.remove('open'); }
  backdrop.addEventListener('click', close);
  return { open, close };
})();

// ---- Formatting ----
const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
function formatToday() { const d = new Date(); return `${DOW[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}`; }
function formatTime(ts) { const d = new Date(ts); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); }
function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

// ==========================================================
// CURRENCY — client-side conversion only. All amounts are
// stored internally in RUB; display converts on the fly using
// a public, keyless FX API, cached ~12h in localStorage so we
// don't hammer the endpoint on every render.
// ==========================================================
const CUR_SYMBOL = { RUB: '₽', USD: '$', EUR: '€', UAH: '₴' };
const Currency = (() => {
  const FRESH_MS = 12 * 60 * 60 * 1000;

  async function ensureRates() {
    const cached = Store.getFxCache();
    if (cached && Date.now() - cached.fetchedAt < FRESH_MS) return cached;
    try {
      const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/rub.json');
      const data = await r.json();
      const rates = { RUB: 1, USD: data.rub.usd, EUR: data.rub.eur, UAH: data.rub.uah };
      Store.setFxCache({ base: 'RUB', rates });
      return Store.getFxCache();
    } catch (e) {
      try {
        const r2 = await fetch('https://open.er-api.com/v6/latest/RUB');
        const data2 = await r2.json();
        const rates = { RUB: 1, USD: data2.rates.USD, EUR: data2.rates.EUR, UAH: data2.rates.UAH };
        Store.setFxCache({ base: 'RUB', rates });
        return Store.getFxCache();
      } catch (e2) {
        console.warn('FX fetch failed, using stale/fallback rates', e2);
        return cached || { rates: { RUB: 1, USD: 0.0105, EUR: 0.0097, UAH: 0.44 }, fetchedAt: 0 };
      }
    }
  }

  function toDisplay(amountRUB, currency) {
    const cache = Store.getFxCache();
    const rate = cache && cache.rates[currency] != null ? cache.rates[currency] : (currency === 'RUB' ? 1 : null);
    if (rate == null) return amountRUB; // rates not loaded yet — show RUB value as-is
    return amountRUB * rate;
  }

  function toRUB(amountInCurrency, currency) {
    const cache = Store.getFxCache();
    const rate = cache && cache.rates[currency] != null ? cache.rates[currency] : (currency === 'RUB' ? 1 : null);
    if (!rate) return amountInCurrency;
    return amountInCurrency / rate;
  }

  return { ensureRates, toDisplay, toRUB };
})();

function fmtMoney(amountRUB) {
  const cur = Store.getState().settings.currency;
  const val = Currency.toDisplay(amountRUB, cur);
  return Math.round(val).toLocaleString('ru-RU') + ' ' + CUR_SYMBOL[cur];
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
    html += `<div class="cup ${i <= s.water.count ? 'filled' : ''}" data-set-water="${i}"></div>`;
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
  document.getElementById('ov-cal-left').textContent = `Осталось ${Math.max(0, s.nutrition.goal - s.nutrition.eaten)} ккал`;

  document.getElementById('ov-workout').textContent = s.workout.minutes;
  document.getElementById('ov-workout-bar').style.width = Math.min(100, (s.workout.minutes / s.workout.goal) * 100) + '%';

  const todaySpend = s.transactions.filter(t => t.date === Store.todayISO() && t.type === 'expense');
  const spendTotal = todaySpend.reduce((sum, t) => sum + t.amount, 0);
  document.getElementById('ov-spend').textContent = fmtMoney(spendTotal);
  document.getElementById('ov-spend-bar').style.width = Math.min(100, (spendTotal / 2000) * 100) + '%';
  document.getElementById('ov-spend-list').innerHTML = todaySpend.slice(0, 3).map(t => `
    <li><span class="item-text">${escapeHtml(t.category)}</span><span class="muted">−${fmtMoney(t.amount)}</span></li>
  `).join('') || '<li class="muted">Пока нет трат</li>';

  document.getElementById('ov-tasks').textContent = s.tasks.filter(t => !t.done).length;
  document.getElementById('ov-notes-list').innerHTML = s.notes.slice(0, 2).map(n => `
    <li class="item-text">${escapeHtml(n.text.slice(0, 40))}${n.text.length > 40 ? '…' : ''}</li>
  `).join('') || '<li class="muted">Пока нет заметок</li>';
}
Router.register('overview', renderOverview);

document.getElementById('screen-overview').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-action="open-nutrition-detail"]')) Router.go('nutrition-detail');
  if (t.closest('[data-action="open-workout-detail"]')) Router.go('workout-detail');
  if (t.closest('[data-action="open-finance-detail"]')) Router.go('finance-detail');
  if (t.closest('[data-action="open-tasks-detail"]')) Router.go('tasks-detail');
  if (t.closest('[data-action="open-notes-detail"]')) Router.go('notes-detail');
  if (t.closest('[data-action="add-task"]')) { e.stopPropagation(); openAddTaskSheet(); }
  if (t.closest('[data-action="add-note"]')) { e.stopPropagation(); openAddNoteSheet(); }
});

function openAddTaskSheet() {
  Sheet.open(`
    <h3>Новая задача</h3>
    <input class="field" id="sheet-task-text" placeholder="Что нужно сделать" autofocus>
    <button class="primary-btn" id="sheet-task-save">Добавить</button>
  `, root => {
    root.querySelector('#sheet-task-save').addEventListener('click', () => {
      const val = root.querySelector('#sheet-task-text').value.trim();
      if (val) { Store.addTask(val); renderOverview(); if (Router.current() === 'tasks-detail') renderTasksDetail(); Sheet.close(); }
    });
  });
}

function openAddNoteSheet() {
  const s = Store.getState();
  let folder = (Router.current() === 'notes-detail' && window.__notesSelectedFolder) || s.noteFolders[0];
  Sheet.open(`
    <h3>Новая заметка</h3>
    <div class="chip-row" id="sheet-note-folders">
      ${s.noteFolders.map(f => `<span class="chip ${f === folder ? 'selected' : ''}" data-folder="${escapeHtml(f)}">${escapeHtml(f)}</span>`).join('')}
    </div>
    <textarea class="field" id="sheet-note-text" placeholder="Мысль или запись" rows="5" style="resize:vertical" autofocus></textarea>
    <button class="primary-btn" id="sheet-note-save">Сохранить</button>
  `, root => {
    root.querySelectorAll('[data-folder]').forEach(chip => {
      chip.addEventListener('click', () => {
        folder = chip.dataset.folder;
        root.querySelectorAll('[data-folder]').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
      });
    });
    root.querySelector('#sheet-note-save').addEventListener('click', () => {
      const val = root.querySelector('#sheet-note-text').value.trim();
      if (val) {
        Store.addNote(val, folder);
        renderOverview();
        if (Router.current() === 'notes-detail') renderNotesDetail();
        Sheet.close();
      }
    });
  });
}

// ==========================================================
// TASKS DETAIL
// ==========================================================
function renderTasksDetail() {
  const s = Store.getState();
  const active = s.tasks.filter(t => !t.done);
  const done = s.tasks.filter(t => t.done);
  document.getElementById('tasks-active-list').innerHTML = active.map(t => `
    <li>
      <span class="check" data-toggle-task="${t.id}"></span>
      <span class="item-text">${escapeHtml(t.text)}</span>
      <span class="item-del" data-del-task="${t.id}">✕</span>
    </li>
  `).join('') || '<li class="muted">Нет активных задач</li>';
  document.getElementById('tasks-done-label').style.display = done.length ? 'block' : 'none';
  document.getElementById('tasks-done-list').innerHTML = done.map(t => `
    <li>
      <span class="check done" data-toggle-task="${t.id}"></span>
      <span class="item-text done">${escapeHtml(t.text)}</span>
      <span class="item-del" data-del-task="${t.id}">✕</span>
    </li>
  `).join('');
}
Router.register('tasks-detail', renderTasksDetail);

document.getElementById('screen-tasks-detail').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.toggleTask) { Store.toggleTask(t.dataset.toggleTask); renderTasksDetail(); renderOverview(); }
  if (t.dataset.delTask) { Store.removeTask(t.dataset.delTask); renderTasksDetail(); renderOverview(); }
  if (t.closest('[data-action="add-task"]')) openAddTaskSheet();
});

// ==========================================================
// NOTES DETAIL
// ==========================================================
window.__notesSelectedFolder = null;
function renderNotesDetail() {
  const s = Store.getState();
  if (!window.__notesSelectedFolder || !s.noteFolders.includes(window.__notesSelectedFolder)) {
    window.__notesSelectedFolder = s.noteFolders[0];
  }
  const tabs = document.getElementById('notes-folder-tabs');
  tabs.innerHTML = s.noteFolders.map(f => `
    <div class="folder-tab ${f === window.__notesSelectedFolder ? 'selected' : ''}" data-select-folder="${escapeHtml(f)}">${escapeHtml(f)}</div>
  `).join('') + `<div class="folder-tab add-tab" data-add-folder>+ Папка</div>`;

  const notes = s.notes.filter(n => n.folder === window.__notesSelectedFolder).sort((a, b) => b.ts - a.ts);
  const list = document.getElementById('notes-list');
  list.innerHTML = notes.map(n => `
    <div class="note-card" data-edit-note="${n.id}">
      <div class="note-card-text">${escapeHtml(n.text)}</div>
      <div class="note-card-time">${new Date(n.ts).toLocaleDateString('ru-RU')} · ${formatTime(n.ts)}</div>
    </div>
  `).join('') || '<div class="note-empty">В этой папке пока пусто</div>';
}
Router.register('notes-detail', renderNotesDetail);

document.getElementById('screen-notes-detail').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-action="add-note"]')) openAddNoteSheet();
  const folderTab = t.closest('[data-select-folder]');
  if (folderTab) { window.__notesSelectedFolder = folderTab.dataset.selectFolder; renderNotesDetail(); }
  if (t.closest('[data-add-folder]')) openAddFolderSheet();
  const noteCard = t.closest('[data-edit-note]');
  if (noteCard) openEditNoteSheet(noteCard.dataset.editNote);
});

function openAddFolderSheet() {
  Sheet.open(`
    <h3>Новая папка</h3>
    <input class="field" id="sheet-folder-name" placeholder="Название папки" autofocus>
    <button class="primary-btn" id="sheet-folder-save">Создать</button>
  `, root => {
    root.querySelector('#sheet-folder-save').addEventListener('click', () => {
      const val = root.querySelector('#sheet-folder-name').value.trim();
      if (val) { Store.addNoteFolder(val); window.__notesSelectedFolder = val; renderNotesDetail(); Sheet.close(); }
    });
  });
}

function openEditNoteSheet(id) {
  const s = Store.getState();
  const note = s.notes.find(n => n.id === id);
  if (!note) return;
  Sheet.open(`
    <h3>Заметка</h3>
    <textarea class="field" id="sheet-edit-note-text" rows="6" style="resize:vertical">${escapeHtml(note.text)}</textarea>
    <button class="primary-btn" id="sheet-edit-note-save">Сохранить</button>
    <button class="ghost-btn" id="sheet-edit-note-del">Удалить заметку</button>
  `, root => {
    root.querySelector('#sheet-edit-note-save').addEventListener('click', () => {
      const val = root.querySelector('#sheet-edit-note-text').value.trim();
      if (val) { Store.editNote(id, val); renderNotesDetail(); Sheet.close(); }
    });
    root.querySelector('#sheet-edit-note-del').addEventListener('click', () => {
      Store.removeNote(id); renderNotesDetail(); renderOverview(); Sheet.close();
    });
  });
}

// ==========================================================
// FINANCE DETAIL
// ==========================================================
function renderFinanceDetail() {
  const s = Store.getState();
  renderCurrencyRow();
  document.getElementById('fin-balance').textContent = fmtMoney(Store.getCapitalTotal());

  const recent = Store.getTransactionsSince(7);
  const income7 = recent.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const expense7 = recent.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  document.getElementById('fin-income-7d').textContent = fmtMoney(income7);
  document.getElementById('fin-expense-7d').textContent = fmtMoney(expense7);

  const alloc = document.getElementById('fin-allocation');
  alloc.innerHTML = s.capital.map(c => `
    <div class="alloc-row-wrap">
      <div class="alloc-row" data-alloc="${c.id}">
        <div><div class="alloc-label">${escapeHtml(c.label)}</div></div>
        <div class="alloc-amount">${fmtMoney(c.amount)}</div>
      </div>
      <span class="alloc-del" data-del-capital="${c.id}">✕</span>
    </div>
  `).join('');

  const tipBox = document.getElementById('fin-tip-box');
  if (recent.length) {
    if (expense7 > income7 && income7 > 0) {
      tipBox.textContent = `За 7 дней расходы (${fmtMoney(expense7)}) превысили доходы (${fmtMoney(income7)}). Стоит присмотреться, на что уходит больше всего.`;
    } else if (income7 > 0) {
      tipBox.textContent = `За 7 дней доход превышает расход на ${fmtMoney(income7 - expense7)} — хорошая динамика, часть можно отправить в резерв или инвестиции.`;
    } else {
      tipBox.textContent = 'Пока в основном расходы без дохода за 7 дней — добавьте операции, чтобы видеть баланс.';
    }
  }

  const hist = document.getElementById('fin-history');
  hist.innerHTML = s.transactions.slice(0, 20).map(t => `
    <li>
      <span class="item-text">${escapeHtml(t.category)}${t.note ? ' · ' + escapeHtml(t.note) : ''}</span>
      <span class="${t.type === 'income' ? 'accent-teal-text' : 'muted'}">${t.type === 'income' ? '+' : '−'}${fmtMoney(t.amount)}</span>
    </li>
  `).join('') || '<li class="muted">Пока нет операций</li>';
}
Router.register('finance-detail', renderFinanceDetail);

function renderCurrencyRow() {
  const s = Store.getState();
  const row = document.getElementById('fin-currency-row');
  row.innerHTML = ['RUB', 'USD', 'EUR', 'UAH'].map(c => `
    <div class="currency-chip ${s.settings.currency === c ? 'selected' : ''}" data-currency="${c}">${CUR_SYMBOL[c]} ${c}</div>
  `).join('');
  const hint = document.getElementById('fin-fx-hint');
  const cache = Store.getFxCache();
  hint.textContent = cache ? `Курс обновлён ${new Date(cache.fetchedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Курс загружается…';
}

document.getElementById('screen-finance-detail').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-action="add-transaction"]')) openTransactionSheet();
  const allocRow = t.closest('[data-alloc]');
  if (allocRow) openAllocationSheet(allocRow.dataset.alloc);
  if (t.dataset.delCapital) { Store.removeCapitalCategory(t.dataset.delCapital); renderFinanceDetail(); }
  if (t.closest('[data-action="add-capital-category"]')) openAddCapitalCategorySheet();
  if (t.closest('[data-action="fin-tip-stub"]')) {
    Sheet.open(`<h3>ИИ-советы по финансам</h3><p class="muted small">Персональные рекомендации появятся, когда бэкенд будет подключён к нейросети. Пока показываются базовые наблюдения по вашим операциям.</p>`);
  }
  const curChip = t.closest('[data-currency]');
  if (curChip) {
    Store.setCurrency(curChip.dataset.currency);
    renderFinanceDetail();
    Currency.ensureRates().then(() => renderFinanceDetail());
  }
});

function openTransactionSheet() {
  const cats = { expense: ['Продукты', 'Кофе', 'Транспорт', 'Подписка', 'Другое'], income: ['Работа', 'Агентство', 'Трейдинг', 'Другое'] };
  let type = 'expense';
  let selected = cats.expense[0];
  const cur = Store.getState().settings.currency;
  const render = () => `
    <h3>Новая операция</h3>
    <div class="chip-row">
      <span class="chip ${type === 'expense' ? 'selected' : ''}" data-type="expense">Расход</span>
      <span class="chip ${type === 'income' ? 'selected' : ''}" data-type="income">Доход</span>
    </div>
    <input class="field" id="sheet-amt" type="number" inputmode="numeric" placeholder="Сумма, ${CUR_SYMBOL[cur]}">
    <div class="chip-row" id="sheet-cats">
      ${cats[type].map(c => `<span class="chip ${c === selected ? 'selected' : ''}" data-cat="${c}">${c}</span>`).join('')}
    </div>
    <button class="primary-btn" id="sheet-tx-save">Добавить</button>
  `;
  const mount = root => {
    root.querySelectorAll('[data-type]').forEach(chip => chip.addEventListener('click', () => {
      type = chip.dataset.type; selected = cats[type][0]; root.innerHTML = render(); mount(root);
    }));
    root.querySelectorAll('[data-cat]').forEach(chip => chip.addEventListener('click', () => {
      root.querySelectorAll('[data-cat]').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected'); selected = chip.dataset.cat;
    }));
    root.querySelector('#sheet-tx-save').addEventListener('click', () => {
      const amt = parseFloat(root.querySelector('#sheet-amt').value);
      if (!isNaN(amt) && amt > 0) {
        const amtRUB = Currency.toRUB(amt, cur);
        Store.addTransaction(amtRUB, type, selected);
        renderFinanceDetail(); renderOverview(); Sheet.close();
      }
    });
  };
  Sheet.open(render(), mount);
}

function openAllocationSheet(id) {
  const s = Store.getState();
  const cat = s.capital.find(c => c.id === id);
  if (!cat) return;
  const cur = s.settings.currency;
  const displayVal = Math.round(Currency.toDisplay(cat.amount, cur));
  Sheet.open(`
    <h3>${escapeHtml(cat.label)}</h3>
    <input class="field" id="sheet-alloc-val" type="number" inputmode="numeric" value="${displayVal}">
    <button class="primary-btn" id="sheet-alloc-save">Сохранить</button>
  `, root => {
    root.querySelector('#sheet-alloc-save').addEventListener('click', () => {
      const val = parseFloat(root.querySelector('#sheet-alloc-val').value);
      if (!isNaN(val)) { Store.setCapitalAmount(id, Currency.toRUB(val, cur)); renderFinanceDetail(); Sheet.close(); }
    });
  });
}

function openAddCapitalCategorySheet() {
  Sheet.open(`
    <h3>Новая категория</h3>
    <input class="field" id="sheet-cap-name" placeholder="Например, Путешествия" autofocus>
    <button class="primary-btn" id="sheet-cap-save">Добавить</button>
  `, root => {
    root.querySelector('#sheet-cap-save').addEventListener('click', () => {
      const val = root.querySelector('#sheet-cap-name').value.trim();
      if (val) { Store.addCapitalCategory(val); renderFinanceDetail(); Sheet.close(); }
    });
  });
}

// ==========================================================
// WORKOUT DETAIL
// ==========================================================
const WEEK_DAYS = [['mon', 'Пн'], ['tue', 'Вт'], ['wed', 'Ср'], ['thu', 'Чт'], ['fri', 'Пт'], ['sat', 'Сб'], ['sun', 'Вс']];

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
  document.getElementById('wk-height').value = s.profile.heightCm || '';
  document.getElementById('wk-weight').value = s.profile.weightKg || '';
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
  if (e.target.dataset.planDay) Store.setWorkoutPlanDay(e.target.dataset.planDay, e.target.value);
  if (e.target.id === 'wk-height') { Store.setProfile(parseFloat(e.target.value) || null, undefined); }
  if (e.target.id === 'wk-weight') { Store.setProfile(undefined, parseFloat(e.target.value) || null); }
});

// ==========================================================
// NUTRITION DETAIL
// ==========================================================
const MEALS = [['breakfast', 'Завтрак'], ['lunch', 'Обед'], ['dinner', 'Ужин'], ['snack', 'Перекус']];
const FOOD_DB = {
  'Мучное': [['Белый хлеб, 100г', 265], ['Батон, 100г', 260], ['Паста отварная, 100г', 131], ['Пицца, 1 кусок', 285], ['Блины, 1 шт', 90], ['Пельмени, 100г', 275]],
  'Фрукты и овощи': [['Яблоко', 52], ['Банан', 89], ['Апельсин', 47], ['Огурец', 15], ['Помидор', 18], ['Авокадо', 160]],
  'Белковое': [['Куриная грудка, 100г', 165], ['Яйцо, 1 шт', 78], ['Творог 5%, 100г', 121], ['Лосось, 100г', 208], ['Говядина, 100г', 250]],
  'Молочное': [['Молоко 2.5%, стакан', 130], ['Йогурт натур., 100г', 66], ['Сыр твёрдый, 30г', 110]],
  'Десерты': [['Тёмный шоколад, 30г', 170], ['Мороженое, 1 шар', 137], ['Печенье, 2 шт', 95], ['Пирожное', 250]],
  'Напитки': [['Кофе с молоком', 60], ['Апельсиновый сок, стакан', 110], ['Газировка, стакан', 140], ['Смузи фруктовый', 180]],
  'Орехи и снеки': [['Миндаль, 30г', 173], ['Арахис, 30г', 170], ['Чипсы, 30г', 152]],
};

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

  const log = Store.getTodayFoodLog();
  document.getElementById('nu-log-list').innerHTML = log.map(e => `
    <div class="log-row">
      <div><div class="log-name">${escapeHtml(e.name)}</div><div class="log-time">${formatTime(e.ts)}</div></div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="log-cal">${e.calories} ккал</span>
        <span class="item-del" data-del-log="${e.id}">✕</span>
      </div>
    </div>
  `).join('') || '<p class="muted small">Пока ничего не добавлено сегодня</p>';

  renderPrefChips('liked', 'nu-liked-row');
  renderPrefChips('disliked', 'nu-disliked-row');

  document.getElementById('nu-height').value = s.profile.heightCm || '';
  document.getElementById('nu-weight').value = s.profile.weightKg || '';
}
Router.register('nutrition-detail', renderNutritionDetail);

function renderPrefChips(kind, elId) {
  const s = Store.getState();
  const el = document.getElementById(elId);
  el.innerHTML = s.nutritionPrefs[kind].map(item => `
    <span class="pref-chip ${kind}">${escapeHtml(item)}<span class="x" data-del-pref="${kind}" data-pref-val="${escapeHtml(item)}">✕</span></span>
  `).join('') || `<span class="muted small">пока пусто</span>`;
}

document.getElementById('screen-nutrition-detail').addEventListener('click', e => {
  const t = e.target;
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
  if (t.closest('[data-action="open-food-picker"]')) openFoodPickerSheet();
  if (t.closest('[data-action="add-food-custom"]')) openCustomFoodSheet();
  if (t.dataset.delLog) { Store.removeFoodLogEntry(t.dataset.delLog); renderNutritionDetail(); renderToday(); renderOverview(); }
  if (t.dataset.delPref) { Store.removePrefItem(t.dataset.delPref, t.dataset.prefVal); renderNutritionDetail(); }
});
document.getElementById('screen-nutrition-detail').addEventListener('change', e => {
  if (e.target.dataset.meal) Store.setMealPlan(e.target.dataset.meal, e.target.value);
  if (e.target.id === 'nu-height') { Store.setProfile(parseFloat(e.target.value) || null, undefined); renderWorkoutDetail(); }
  if (e.target.id === 'nu-weight') { Store.setProfile(undefined, parseFloat(e.target.value) || null); renderWorkoutDetail(); }
});

document.getElementById('nu-liked-add').addEventListener('click', () => {
  const input = document.getElementById('nu-liked-input');
  const val = input.value.trim();
  if (val) { Store.addPrefItem('liked', val); input.value = ''; renderPrefChips('liked', 'nu-liked-row'); }
});
document.getElementById('nu-disliked-add').addEventListener('click', () => {
  const input = document.getElementById('nu-disliked-input');
  const val = input.value.trim();
  if (val) { Store.addPrefItem('disliked', val); input.value = ''; renderPrefChips('disliked', 'nu-disliked-row'); }
});

function openFoodPickerSheet() {
  const cats = Object.keys(FOOD_DB);
  let active = cats[0];
  const render = () => `
    <h3>Выбрать блюдо</h3>
    <div class="food-cat-row" id="fp-cats">
      ${cats.map(c => `<span class="food-cat-chip ${c === active ? 'selected' : ''}" data-fp-cat="${escapeHtml(c)}">${escapeHtml(c)}</span>`).join('')}
    </div>
    <div id="fp-items">
      ${FOOD_DB[active].map(([name, kcal]) => `
        <div class="food-item-row" data-fp-item="${escapeHtml(name)}" data-fp-kcal="${kcal}">
          <span class="food-item-name">${escapeHtml(name)}</span>
          <span class="food-item-kcal">${kcal} ккал</span>
        </div>
      `).join('')}
    </div>
    <button class="ghost-btn" id="fp-done">Готово</button>
  `;
  const mount = root => {
    root.querySelectorAll('[data-fp-cat]').forEach(chip => chip.addEventListener('click', () => {
      active = chip.dataset.fpCat; root.innerHTML = render(); mount(root);
    }));
    root.querySelectorAll('[data-fp-item]').forEach(row => row.addEventListener('click', () => {
      Store.addFoodLogEntry(row.dataset.fpItem, parseInt(row.dataset.fpKcal, 10));
      renderNutritionDetail(); renderToday(); renderOverview();
      row.style.opacity = '.4';
    }));
    root.querySelector('#fp-done').addEventListener('click', Sheet.close);
  };
  Sheet.open(render(), mount);
}

function openCustomFoodSheet() {
  Sheet.open(`
    <h3>Добавить в дневник</h3>
    <input class="field" id="sheet-food-name" placeholder="Название">
    <input class="field" id="sheet-food-kcal" type="number" inputmode="numeric" placeholder="Калории">
    <button class="primary-btn" id="sheet-food-save">Добавить</button>
  `, root => {
    root.querySelector('#sheet-food-save').addEventListener('click', () => {
      const name = root.querySelector('#sheet-food-name').value.trim();
      const kcal = parseInt(root.querySelector('#sheet-food-kcal').value, 10);
      if (name && !isNaN(kcal)) {
        Store.addFoodLogEntry(name, kcal);
        renderNutritionDetail(); renderToday(); renderOverview(); Sheet.close();
      }
    });
  });
}

// --- food photo (camera) stub ---
document.getElementById('food-photo-btn').addEventListener('click', () => document.getElementById('food-photo-input').click());
document.getElementById('food-photo-input').addEventListener('change', e => {
  if (!e.target.files || !e.target.files[0]) return;
  Sheet.open(`
    <h3>Фото получено</h3>
    <p class="muted small">Распознавание калорий по фото ещё не подключено — для этого нужен бэкенд с ИИ-моделью, которая умеет анализировать изображения. Пока можно добавить блюдо вручную или через «Выбрать блюдо».</p>
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
    if (pct !== null) { level = pct >= 90 ? 'l4' : pct >= 70 ? 'l3' : pct >= 40 ? 'l2' : 'l1'; }
    const isToday = dateISO === Store.todayISO();
    const isSelected = dateISO === selectedDay;
    html += `<div class="cal-day ${level} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-day="${dateISO}">
      ${day}${pct !== null ? `<span class="pct">${pct}%</span>` : ''}
    </div>`;
  }
  grid.innerHTML = html;
  if (!selectedDay || snapshots[selectedDay] === undefined) selectedDay = snapshots[Store.todayISO()] ? Store.todayISO() : null;
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
    <li><span class="item-text">Траты</span><span class="muted">${fmtMoney(snap.spending)}</span></li>
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
  document.getElementById('an-spend-avg').textContent = fmtMoney(avgSpend);
  const cur = Store.getState().settings.currency;
  Charts.bars(document.getElementById('chart-spending'), spends.map(v => Currency.toDisplay(v, cur)), { color: '#A9803D' });
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

// ---- boot ----
Router.go('today');
Currency.ensureRates().then(() => { if (Router.current() === 'finance-detail') renderFinanceDetail(); });
