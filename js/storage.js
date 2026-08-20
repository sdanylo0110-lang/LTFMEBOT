/**
 * Storage layer.
 * MVP: reads/writes localStorage.
 * Architecture note: functions are isolated so a real backend/bot API can
 * replace this file later without touching app.js.
 */
const Store = (() => {
  const KEY = 'ltfm:v3';
  const todayISO = () => new Date().toISOString().slice(0, 10);
  function uid() { return Math.random().toString(36).slice(2, 9); }

  const defaultCapital = () => ([
    { id: uid(), label: 'Резерв', amount: 0 },
    { id: uid(), label: 'Инвестиции', amount: 0 },
    { id: uid(), label: 'Накопления на цель', amount: 0 },
    { id: uid(), label: 'Личное', amount: 0 },
  ]);

  const defaultState = () => ({
    habits: [
      { id: uid(), text: 'Пить воду (2л)', done: false },
      { id: uid(), text: 'Утренняя тренировка', done: false },
      { id: uid(), text: 'Читать 20 страниц', done: false },
    ],
    tasks: [],
    notes: [],
    noteFolders: ['Общее'],
    water: { count: 0, goal: 8, mlPerGlass: 250 },
    nutrition: { eaten: 0, goal: 2300 },
    nutritionLog: [], // {id, name, calories, date, ts}
    nutritionPrefs: { liked: [], disliked: [] },
    mealPlan: { breakfast: '', lunch: '', dinner: '', snack: '' },
    workout: { minutes: 0, goal: 60 },
    workoutPlan: { mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' },
    profile: { heightCm: null, weightKg: null },
    capital: defaultCapital(),
    transactions: [], // {id, amount(RUB), type:'income'|'expense', category, note, date, ts}
    settings: { currency: 'RUB' },
    fxRates: null, // { base:'RUB', rates:{USD,EUR,UAH}, fetchedAt }
    days: {},
  });

  function migrateCapital(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      const LABELS = { reserve: 'Резерв', etf: 'ETF-инвестиции', trading: 'Трейдинг-депозит', personal: 'Личное' };
      return Object.keys(raw).map(k => ({ id: uid(), label: LABELS[k] || k, amount: raw[k] || 0 }));
    }
    return defaultCapital();
  }

  function loadLegacy() {
    // migrate from older v2 schema (fixed-object capital, no profile/log/prefs)
    try {
      const raw = localStorage.getItem('ltfm:v2');
      if (!raw) return null;
      const old = JSON.parse(raw);
      const base = defaultState();
      return {
        ...base, ...old,
        capital: migrateCapital(old.capital),
        profile: base.profile,
        nutritionLog: [],
        nutritionPrefs: base.nutritionPrefs,
        noteFolders: base.noteFolders,
        settings: base.settings,
        fxRates: null,
      };
    } catch (e) { return null; }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return loadLegacy() || defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return {
        ...base, ...parsed,
        water: { ...base.water, ...(parsed.water || {}) },
        nutrition: { ...base.nutrition, ...(parsed.nutrition || {}) },
        nutritionPrefs: { ...base.nutritionPrefs, ...(parsed.nutritionPrefs || {}) },
        workout: { ...base.workout, ...(parsed.workout || {}) },
        profile: { ...base.profile, ...(parsed.profile || {}) },
        mealPlan: { ...base.mealPlan, ...(parsed.mealPlan || {}) },
        workoutPlan: { ...base.workoutPlan, ...(parsed.workoutPlan || {}) },
        settings: { ...base.settings, ...(parsed.settings || {}) },
        capital: migrateCapital(parsed.capital),
        noteFolders: (parsed.noteFolders && parsed.noteFolders.length) ? parsed.noteFolders : base.noteFolders,
      };
    } catch (e) {
      console.error('Store load failed', e);
      return defaultState();
    }
  }

  let state = load();

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(state));
    snapshotToday();
  }

  function snapshotToday() {
    const key = todayISO();
    const total = state.habits.length || 1;
    const doneCount = state.habits.filter(h => h.done).length;
    const pct = Math.round((doneCount / total) * 100);
    const todayTx = state.transactions.filter(t => t.date === key);
    const spendTotal = todayTx.filter(t => t.type === 'expense').reduce((s, x) => s + x.amount, 0);
    const incomeTotal = todayTx.filter(t => t.type === 'income').reduce((s, x) => s + x.amount, 0);
    state.days[key] = { pct, calories: state.nutrition.eaten, spending: spendTotal, income: incomeTotal };
  }

  return {
    uid,
    todayISO,
    getState() { return state; },

    // habits
    addHabit(text) { state.habits.push({ id: uid(), text, done: false }); persist(); },
    toggleHabit(id) { const h = state.habits.find(x => x.id === id); if (h) h.done = !h.done; persist(); },
    removeHabit(id) { state.habits = state.habits.filter(x => x.id !== id); persist(); },

    // tasks
    addTask(text) { state.tasks.push({ id: uid(), text, done: false }); persist(); },
    toggleTask(id) { const t = state.tasks.find(x => x.id === id); if (t) t.done = !t.done; persist(); },
    removeTask(id) { state.tasks = state.tasks.filter(x => x.id !== id); persist(); },

    // notes
    addNoteFolder(name) { if (name && !state.noteFolders.includes(name)) { state.noteFolders.push(name); persist(); } },
    addNote(text, folder) { state.notes.unshift({ id: uid(), text, folder: folder || state.noteFolders[0], ts: Date.now() }); persist(); },
    editNote(id, text) { const n = state.notes.find(x => x.id === id); if (n) { n.text = text; n.ts = Date.now(); } persist(); },
    removeNote(id) { state.notes = state.notes.filter(x => x.id !== id); persist(); },

    // water
    setWater(count) { state.water.count = Math.max(0, count); persist(); },
    addWater(delta) { state.water.count = Math.max(0, state.water.count + delta); persist(); },
    setWaterGoal(goal) { state.water.goal = Math.max(1, goal); persist(); },

    // nutrition
    setNutritionGoal(goal) { state.nutrition.goal = Math.max(0, goal); persist(); },
    addFoodLogEntry(name, calories) {
      state.nutritionLog.unshift({ id: uid(), name, calories, date: todayISO(), ts: Date.now() });
      state.nutrition.eaten = Math.max(0, state.nutrition.eaten + calories);
      persist();
    },
    removeFoodLogEntry(id) {
      const e = state.nutritionLog.find(x => x.id === id);
      if (e) {
        state.nutrition.eaten = Math.max(0, state.nutrition.eaten - e.calories);
        state.nutritionLog = state.nutritionLog.filter(x => x.id !== id);
      }
      persist();
    },
    getTodayFoodLog() { return state.nutritionLog.filter(x => x.date === todayISO()); },
    addPrefItem(kind, text) { // kind: 'liked' | 'disliked'
      if (!state.nutritionPrefs[kind].includes(text)) { state.nutritionPrefs[kind].push(text); persist(); }
    },
    removePrefItem(kind, text) {
      state.nutritionPrefs[kind] = state.nutritionPrefs[kind].filter(x => x !== text);
      persist();
    },
    setMealPlan(key, val) { if (key in state.mealPlan) { state.mealPlan[key] = val; persist(); } },

    // workout
    addWorkoutMinutes(delta) { state.workout.minutes = Math.max(0, state.workout.minutes + delta); persist(); },
    setWorkoutPlanDay(key, val) { if (key in state.workoutPlan) { state.workoutPlan[key] = val; persist(); } },

    // body profile (shared by nutrition/workout)
    setProfile(heightCm, weightKg) {
      if (heightCm !== undefined) state.profile.heightCm = heightCm;
      if (weightKg !== undefined) state.profile.weightKg = weightKg;
      persist();
    },

    // finance
    addTransaction(amountRUB, type, category, note) {
      state.transactions.unshift({ id: uid(), amount: amountRUB, type, category, note: note || '', date: todayISO(), ts: Date.now() });
      persist();
    },
    removeTransaction(id) { state.transactions = state.transactions.filter(x => x.id !== id); persist(); },
    getTransactionsSince(days) {
      const cutoff = Date.now() - days * 86400000;
      return state.transactions.filter(x => x.ts >= cutoff).sort((a, b) => b.ts - a.ts);
    },
    addCapitalCategory(label) {
      state.capital.push({ id: uid(), label, amount: 0 });
      persist();
    },
    removeCapitalCategory(id) {
      if (state.capital.length <= 1) return;
      state.capital = state.capital.filter(x => x.id !== id);
      persist();
    },
    setCapitalAmount(id, amount) {
      const c = state.capital.find(x => x.id === id);
      if (c) { c.amount = Math.max(0, amount); persist(); }
    },
    getCapitalTotal() { return state.capital.reduce((a, c) => a + c.amount, 0); },

    // currency
    setCurrency(code) { state.settings.currency = code; persist(); },
    getFxCache() { return state.fxRates; },
    setFxCache(rates) { state.fxRates = { ...rates, fetchedAt: Date.now() }; persist(); },

    // derived / history
    getDaySnapshot(dateISO) {
      if (dateISO === todayISO()) snapshotToday();
      return state.days[dateISO] || null;
    },
    getMonthSnapshots(year, month) {
      const out = {};
      Object.keys(state.days).forEach(key => {
        const d = new Date(key);
        if (d.getFullYear() === year && d.getMonth() === month) out[key] = state.days[key];
      });
      const key = todayISO();
      const t = new Date(key);
      if (t.getFullYear() === year && t.getMonth() === month) { snapshotToday(); out[key] = state.days[key]; }
      return out;
    },
    getRecentDays(n) {
      const out = [];
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        if (key === todayISO()) snapshotToday();
        out.push({ date: key, ...(state.days[key] || { pct: null, calories: null, spending: null, income: null }) });
      }
      return out;
    },
  };
})();
