/**
 * Storage layer.
 * MVP: reads/writes localStorage.
 * Architecture note: functions are isolated so a real backend/bot API can
 * replace this file later without touching app.js.
 */
const Store = (() => {
  const KEY = 'ltfm:v2';

  const todayISO = () => new Date().toISOString().slice(0, 10);
  function uid() { return Math.random().toString(36).slice(2, 9); }

  const defaultState = () => ({
    habits: [
      { id: uid(), text: 'Пить воду (2л)', done: false },
      { id: uid(), text: 'Утренняя тренировка', done: false },
      { id: uid(), text: 'Читать 20 страниц', done: false },
    ],
    tasks: [],
    notes: [],
    water: { count: 0, goal: 8, mlPerGlass: 250 },
    nutrition: { eaten: 0, goal: 2300 },
    workout: { minutes: 0, goal: 60 },
    capital: { reserve: 0, etf: 0, trading: 0, personal: 0 },
    transactions: [], // {id, amount, type:'income'|'expense', category, note, date, ts}
    mealPlan: { breakfast: '', lunch: '', dinner: '', snack: '' },
    workoutPlan: { mon: '', tue: '', wed: '', thu: '', fri: '', sat: '', sun: '' },
    days: {}, // { 'YYYY-MM-DD': { pct, calories, spending, income } }
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return {
        ...base, ...parsed,
        water: { ...base.water, ...(parsed.water || {}) },
        nutrition: { ...base.nutrition, ...(parsed.nutrition || {}) },
        workout: { ...base.workout, ...(parsed.workout || {}) },
        capital: { ...base.capital, ...(parsed.capital || {}) },
        mealPlan: { ...base.mealPlan, ...(parsed.mealPlan || {}) },
        workoutPlan: { ...base.workoutPlan, ...(parsed.workoutPlan || {}) },
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

    // habits / tasks
    addHabit(text) { state.habits.push({ id: uid(), text, done: false }); persist(); },
    toggleHabit(id) { const h = state.habits.find(x => x.id === id); if (h) h.done = !h.done; persist(); },
    removeHabit(id) { state.habits = state.habits.filter(x => x.id !== id); persist(); },
    addTask(text) { state.tasks.push({ id: uid(), text, done: false }); persist(); },
    toggleTask(id) { const t = state.tasks.find(x => x.id === id); if (t) t.done = !t.done; persist(); },
    removeTask(id) { state.tasks = state.tasks.filter(x => x.id !== id); persist(); },

    // notes
    addNote(text) { state.notes.unshift({ id: uid(), text, ts: Date.now() }); persist(); },
    removeNote(id) { state.notes = state.notes.filter(x => x.id !== id); persist(); },

    // water / nutrition / workout
    setWater(count) { state.water.count = Math.max(0, count); persist(); },
    addWater(delta) { state.water.count = Math.max(0, state.water.count + delta); persist(); },
    setWaterGoal(goal) { state.water.goal = Math.max(1, goal); persist(); },
    setNutrition(eaten) { state.nutrition.eaten = Math.max(0, eaten); persist(); },
    setNutritionGoal(goal) { state.nutrition.goal = Math.max(0, goal); persist(); },
    addWorkoutMinutes(delta) { state.workout.minutes = Math.max(0, state.workout.minutes + delta); persist(); },
    setWorkoutPlanDay(key, val) { if (key in state.workoutPlan) { state.workoutPlan[key] = val; persist(); } },
    setMealPlan(key, val) { if (key in state.mealPlan) { state.mealPlan[key] = val; persist(); } },

    // transactions (unified income/expense) + capital allocation
    addTransaction(amount, type, category, note) {
      state.transactions.unshift({ id: uid(), amount, type, category, note: note || '', date: todayISO(), ts: Date.now() });
      persist();
    },
    removeTransaction(id) { state.transactions = state.transactions.filter(x => x.id !== id); persist(); },
    getTransactionsSince(days) {
      const cutoff = Date.now() - days * 86400000;
      return state.transactions.filter(x => x.ts >= cutoff).sort((a, b) => b.ts - a.ts);
    },
    setCapital(key, amount) { if (key in state.capital) { state.capital[key] = Math.max(0, amount); persist(); } },
    getCapitalTotal() { return Object.values(state.capital).reduce((a, b) => a + b, 0); },

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
