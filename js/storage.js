/**
 * Storage layer.
 * MVP: reads/writes localStorage.
 * Architecture note: every function here is async-shaped (returns the value
 * directly, but callers should treat it as if it could be a Promise) so that
 * swapping this file for a real backend/Telegram-bot API later doesn't
 * require touching app.js — only the bodies of these functions change.
 */
const Store = (() => {
  const KEY = 'ltfm:v1';

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const defaultState = () => ({
    habits: [
      { id: uid(), text: 'Пить воду (2л)', done: false },
      { id: uid(), text: 'Утренняя тренировка', done: false },
      { id: uid(), text: 'Читать 20 страниц', done: false },
    ],
    tasks: [],
    notes: [],
    water: { count: 0, goal: 8 },
    nutrition: { eaten: 0, goal: 2300 },
    workout: { minutes: 0, goal: 60 },
    spending: [],
    days: {}, // { 'YYYY-MM-DD': { pct, calories, spending } } — daily snapshots for history/analytics
  });

  function uid() {
    return Math.random().toString(36).slice(2, 9);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed };
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

  // Roll today's live numbers into the day snapshot used by History/Analytics.
  function snapshotToday() {
    const key = todayISO();
    const total = state.habits.length || 1;
    const doneCount = state.habits.filter(h => h.done).length;
    const pct = Math.round((doneCount / total) * 100);
    const spendTotal = state.spending
      .filter(s => s.date === key)
      .reduce((sum, s) => sum + s.amount, 0);
    state.days[key] = {
      pct,
      calories: state.nutrition.eaten,
      spending: spendTotal,
    };
  }

  return {
    uid,
    todayISO,

    getState() { return state; },

    // --- habits / tasks ---
    addHabit(text) {
      state.habits.push({ id: uid(), text, done: false });
      persist();
    },
    toggleHabit(id) {
      const h = state.habits.find(x => x.id === id);
      if (h) h.done = !h.done;
      persist();
    },
    removeHabit(id) {
      state.habits = state.habits.filter(x => x.id !== id);
      persist();
    },
    addTask(text) {
      state.tasks.push({ id: uid(), text, done: false });
      persist();
    },
    toggleTask(id) {
      const t = state.tasks.find(x => x.id === id);
      if (t) t.done = !t.done;
      persist();
    },
    removeTask(id) {
      state.tasks = state.tasks.filter(x => x.id !== id);
      persist();
    },

    // --- notes ---
    addNote(text) {
      state.notes.unshift({ id: uid(), text, ts: Date.now() });
      persist();
    },
    removeNote(id) {
      state.notes = state.notes.filter(x => x.id !== id);
      persist();
    },

    // --- water / nutrition / workout ---
    addWater(delta) {
      state.water.count = Math.max(0, state.water.count + delta);
      persist();
    },
    setNutrition(eaten) {
      state.nutrition.eaten = Math.max(0, eaten);
      persist();
    },
    addWorkoutMinutes(delta) {
      state.workout.minutes = Math.max(0, state.workout.minutes + delta);
      persist();
    },

    // --- spending ---
    addSpend(amount, category, note) {
      state.spending.unshift({
        id: uid(),
        amount,
        category,
        note: note || '',
        date: todayISO(),
        ts: Date.now(),
      });
      persist();
    },
    removeSpend(id) {
      state.spending = state.spending.filter(x => x.id !== id);
      persist();
    },

    // --- derived / history ---
    getDaySnapshot(dateISO) {
      if (dateISO === todayISO()) {
        snapshotToday();
      }
      return state.days[dateISO] || null;
    },
    getMonthSnapshots(year, month) {
      // month: 0-11
      const out = {};
      Object.keys(state.days).forEach(key => {
        const d = new Date(key);
        if (d.getFullYear() === year && d.getMonth() === month) {
          out[key] = state.days[key];
        }
      });
      const key = todayISO();
      const t = new Date(key);
      if (t.getFullYear() === year && t.getMonth() === month) {
        snapshotToday();
        out[key] = state.days[key];
      }
      return out;
    },
    getRecentDays(n) {
      const out = [];
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        if (key === todayISO()) snapshotToday();
        out.push({ date: key, ...(state.days[key] || { pct: null, calories: null, spending: null }) });
      }
      return out;
    },
  };
})();
