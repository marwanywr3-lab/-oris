const STORAGE_KEY = "oris_app_state_v1";

const DEFAULT_STATE = {
  onboarded: false,
  lang: "ar",
  selectedDay: new Date().getDay(),
  activeView: "today",
  preferences: {
    wakeTime: "06:30",
    sleepTime: "23:00",
    focusStart: "16:00",
    focusEnd: "18:00",
    hobbyStart: "19:30",
    hobbyEnd: "21:00"
  },
  settings: {
    apiKey: "",
    model: "gemini-3.5-flash-lite",
    wakeEnabled: false
  },
  tasks: []
};

let state = loadState();
let obStep = 1;
let obSelectedWorkDays = [0, 1, 2, 3, 4]; // Sun-Thu default

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      return {
        ...DEFAULT_STATE,
        ...saved,
        preferences: { ...DEFAULT_STATE.preferences, ...(saved.preferences || {}) },
        settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) }
      };
    }
  } catch (_) {}
  return structuredClone(DEFAULT_STATE);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function generateId() {
  return "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------------- I18N & DIRECTION ---------------- */
function applyLanguage() {
  const dict = I18N[state.lang];
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) el.placeholder = dict[key];
  });

  document.getElementById("lang-toggle-btn").textContent = state.lang === "ar" ? "EN" : "عربي";
  document.getElementById("ob-lang-toggle").textContent = state.lang === "ar" ? "English" : "العربية";

  OrisVoice.setLang(state.lang);
  renderAll();
}

/* ---------------- ONBOARDING ---------------- */
function initOnboarding() {
  const overlay = document.getElementById("onboarding-overlay");
  if (state.onboarded) {
    overlay.classList.add("hidden");
    return;
  }
  overlay.classList.remove("hidden");
  renderOnboardingDays();
  updateOnboardingStep();
}

function renderOnboardingDays() {
  const container = document.getElementById("ob-work-days");
  container.innerHTML = "";
  I18N[state.lang].days_short.forEach((label, idx) => {
    const pill = document.createElement("span");
    pill.className = "day-pill" + (obSelectedWorkDays.includes(idx) ? " selected" : "");
    pill.textContent = label;
    pill.onclick = () => {
      if (obSelectedWorkDays.includes(idx)) {
        obSelectedWorkDays = obSelectedWorkDays.filter((d) => d !== idx);
      } else {
        obSelectedWorkDays.push(idx);
      }
      renderOnboardingDays();
    };
    container.appendChild(pill);
  });
}

function updateOnboardingStep() {
  document.querySelectorAll(".ob-step").forEach((el) => {
    el.classList.toggle("hidden", Number(el.dataset.step) !== obStep);
  });
  document.getElementById("ob-progress").style.width = `${obStep * 25}%`;
  document.getElementById("ob-prev").classList.toggle("hidden", obStep === 1);
  const nextBtn = document.getElementById("ob-next");
  nextBtn.textContent = obStep === 4 ? I18N[state.lang].finish : I18N[state.lang].next;
}

function finishOnboarding() {
  state.settings.apiKey = document.getElementById("ob-api-key").value.trim();
  state.preferences.wakeTime = document.getElementById("ob-wake").value || "06:30";
  state.preferences.sleepTime = document.getElementById("ob-sleep").value || "23:00";
  state.preferences.focusStart = document.getElementById("ob-focus-start").value || "16:00";
  state.preferences.focusEnd = document.getElementById("ob-focus-end").value || "18:00";
  state.preferences.hobbyStart = document.getElementById("ob-hobby-start").value || "19:30";
  state.preferences.hobbyEnd = document.getElementById("ob-hobby-end").value || "21:00";

  const workTitle = document.getElementById("ob-work-title").value.trim() || (state.lang === "ar" ? "المدرسة / العمل" : "School / Work");
  const workStart = document.getElementById("ob-work-start").value || "07:30";
  const workEnd = document.getElementById("ob-work-end").value || "13:30";

  if (obSelectedWorkDays.length > 0) {
    state.tasks.push({
      id: generateId(),
      title: workTitle,
      days: [...obSelectedWorkDays],
      startTime: workStart,
      endTime: workEnd,
      category: "study",
      notes: "",
      completedDates: []
    });
  }

  const hobbyTitle = document.getElementById("ob-hobby-name").value.trim();
  if (hobbyTitle) {
    state.tasks.push({
      id: generateId(),
      title: hobbyTitle,
      days: [0, 1, 2, 3, 4, 5, 6],
      startTime: state.preferences.hobbyStart,
      endTime: state.preferences.hobbyEnd,
      category: "hobby",
      notes: "",
      completedDates: []
    });
  }

  state.onboarded = true;
  saveState();
  document.getElementById("onboarding-overlay").classList.add("hidden");
  renderAll();
}

/* ---------------- NAVIGATION ---------------- */
function switchView(viewName, dayIndex = null) {
  state.activeView = viewName;
  if (dayIndex !== null && dayIndex >= 0 && dayIndex <= 6) {
    state.selectedDay = dayIndex;
  }
  saveState();

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  document.querySelectorAll(".view-section").forEach((sec) => {
    sec.classList.toggle("hidden", sec.id !== `view-${viewName}`);
  });

  renderAll();
}

/* ---------------- TIMELINE RENDERING ---------------- */
function isSleepHour(hour) {
  const wakeH = parseInt(state.preferences.wakeTime.split(":")[0], 10);
  const sleepH = parseInt(state.preferences.sleepTime.split(":")[0], 10);
  if (sleepH > wakeH) {
    return hour >= sleepH || hour < wakeH;
  } else {
    return hour >= sleepH && hour < wakeH;
  }
}

function formatHourLabel(h) {
  const suffix = h >= 12 ? (state.lang === "ar" ? "م" : "PM") : (state.lang === "ar" ? "ص" : "AM");
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${suffix}`;
}

function renderTimeline() {
  const dict = I18N[state.lang];
  const dayTitle = document.getElementById("selected-day-title");
  const daySub = document.getElementById("selected-day-subtitle");
  dayTitle.textContent = dict.days[state.selectedDay];

  const todayIdx = new Date().getDay();
  daySub.textContent = state.selectedDay === todayIdx
    ? (state.lang === "ar" ? "اليوم الحالي" : "Today")
    : (state.lang === "ar" ? "عرض اليوم المحدد" : "Selected Day");

  const container = document.getElementById("timeline-container");
  container.innerHTML = "";

  const dayTasks = state.tasks
    .filter((t) => t.days.includes(state.selectedDay))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const todayKey = now.toISOString().slice(0, 10);

  for (let h = 0; h < 24; h++) {
    const row = document.createElement("div");
    row.className = "hour-row";

    const label = document.createElement("div");
    label.className = "hour-label";
    label.textContent = formatHourLabel(h);

    const slot = document.createElement("div");
    slot.className = "hour-slot";
    slot.onclick = (e) => {
      if (e.target === slot) {
        const startStr = `${String(h).padStart(2, "0")}:00`;
        const endStr = `${String((h + 1) % 24).padStart(2, "0")}:00`;
        openTaskModal(null, startStr, endStr);
      }
    };

    if (state.selectedDay === todayIdx && h === currentHour) {
      const line = document.createElement("div");
      line.className = "now-line";
      line.style.top = `${(currentMinute / 60) * 100}%`;
      row.appendChild(line);
    }

    const tasksAtHour = dayTasks.filter((t) => parseInt(t.startTime.split(":")[0], 10) === h);

    if (tasksAtHour.length > 0) {
      tasksAtHour.forEach((task) => {
        const isDone = (task.completedDates || []).includes(`${todayKey}_${state.selectedDay}`);
        const block = document.createElement("div");
        block.className = `task-block cat-${task.category || "study"} ${isDone ? "completed" : ""}`;

        const info = document.createElement("div");
        info.innerHTML = `
          <div class="task-title"><strong>${escapeHtml(task.title)}</strong></div>
          <div class="task-meta" dir="ltr">${task.startTime} - ${task.endTime} ${task.notes ? "• " + escapeHtml(task.notes) : ""}</div>
        `;

        const check = document.createElement("input");
        check.type = "checkbox";
        check.className = "task-check";
        check.checked = isDone;
        check.onclick = (ev) => {
          ev.stopPropagation();
          toggleTaskComplete(task.id, `${todayKey}_${state.selectedDay}`);
        };

        block.onclick = () => openTaskModal(task);
        block.appendChild(info);
        block.appendChild(check);
        slot.appendChild(block);
      });
    } else if (isSleepHour(h)) {
      const sleepDiv = document.createElement("div");
      sleepDiv.className = "task-block cat-sleep";
      sleepDiv.innerHTML = `<span class="task-meta">🌙 ${dict.sleep_block}</span>`;
      slot.appendChild(sleepDiv);
    }

    row.appendChild(label);
    row.appendChild(slot);
    container.appendChild(row);
  }
}

function renderWeekGrid() {
  const grid = document.getElementById("week-grid");
  grid.innerHTML = "";
  const dict = I18N[state.lang];
  const todayIdx = new Date().getDay();

  dict.days.forEach((dayName, idx) => {
    const card = document.createElement("div");
    card.className = "week-day-card" + (idx === todayIdx ? " is-today" : "");
    card.onclick = () => switchView("today", idx);

    const tasks = state.tasks
      .filter((t) => t.days.includes(idx))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    let listHtml = "";
    if (tasks.length === 0) {
      listHtml = `<p class="muted">${state.lang === "ar" ? "لا توجد مهام مجدولة" : "No scheduled tasks"}</p>`;
    } else {
      listHtml = tasks
        .slice(0, 5)
        .map((t) => `<div class="mini-task"><span>${escapeHtml(t.title)}</span><span dir="ltr" class="muted">${t.startTime}</span></div>`)
        .join("");
    }

    card.innerHTML = `
      <div class="week-day-header">
        <strong>${dayName}</strong>
        <span class="muted">${tasks.length}</span>
      </div>
      ${listHtml}
    `;
    grid.appendChild(card);
  });
}

function populateForms() {
  document.getElementById("pref-wake").value = state.preferences.wakeTime;
  document.getElementById("pref-sleep").value = state.preferences.sleepTime;
  document.getElementById("pref-focus-start").value = state.preferences.focusStart;
  document.getElementById("pref-focus-end").value = state.preferences.focusEnd;
  document.getElementById("pref-hobby-start").value = state.preferences.hobbyStart;
  document.getElementById("pref-hobby-end").value = state.preferences.hobbyEnd;

  document.getElementById("set-api-key").value = state.settings.apiKey;
  document.getElementById("set-model").value = state.settings.model;
  document.getElementById("set-wake-enabled").checked = state.settings.wakeEnabled;
}

function renderAll() {
  renderTimeline();
  renderWeekGrid();
  populateForms();
}

/* ---------------- MANUAL TASK MODAL ---------------- */
let modalSelectedDays = [];

function openTaskModal(task = null, defaultStart = "16:00", defaultEnd = "17:00") {
  const dict = I18N[state.lang];
  const modal = document.getElementById("task-modal");
  modal.classList.remove("hidden");

  document.getElementById("modal-title").textContent = task ? dict.edit_task_title : dict.add_task_title;
  document.getElementById("task-id").value = task ? task.id : "";
  document.getElementById("task-title-input").value = task ? task.title : "";
  document.getElementById("task-start-input").value = task ? task.startTime : defaultStart;
  document.getElementById("task-end-input").value = task ? task.endTime : defaultEnd;
  document.getElementById("task-category-input").value = task ? task.category : "study";
  document.getElementById("task-notes-input").value = task ? (task.notes || "") : "";

  const delBtn = document.getElementById("delete-task-btn");
  delBtn.classList.toggle("hidden", !task);

  modalSelectedDays = task ? [...task.days] : [state.selectedDay];
  renderModalDayPills();
}

function renderModalDayPills() {
  const container = document.getElementById("task-days-selector");
  container.innerHTML = "";
  I18N[state.lang].days_short.forEach((label, idx) => {
    const pill = document.createElement("span");
    pill.className = "day-pill" + (modalSelectedDays.includes(idx) ? " selected" : "");
    pill.textContent = label;
    pill.onclick = () => {
      if (modalSelectedDays.includes(idx)) {
        if (modalSelectedDays.length > 1) {
          modalSelectedDays = modalSelectedDays.filter((d) => d !== idx);
        }
      } else {
        modalSelectedDays.push(idx);
      }
      renderModalDayPills();
    };
    container.appendChild(pill);
  });
}

function toggleTaskComplete(taskId, key) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.completedDates = task.completedDates || [];
  if (task.completedDates.includes(key)) {
    task.completedDates = task.completedDates.filter((k) => k !== key);
  } else {
    task.completedDates.push(key);
  }
  saveState();
  renderAll();
}

/* ---------------- ORIS AI EXECUTION ---------------- */
function showToast(msg, duration = 4500) {
  const toast = document.getElementById("oris-feedback");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add("hidden"), duration);
}

async function handleOrisPrompt(text) {
  const prompt = text.trim();
  if (!prompt) return;

  showToast(I18N[state.lang].thinking, 15000);
  try {
    const result = await OrisAI.processCommand(prompt, state);
    if (Array.isArray(result.actions)) {
      result.actions.forEach((act) => {
        if (act.type === "ADD_TASK" && act.task) {
          state.tasks.push({
            id: generateId(),
            title: act.task.title || "Task",
            days: Array.isArray(act.task.days) && act.task.days.length ? act.task.days : [state.selectedDay],
            startTime: act.task.startTime || "16:00",
            endTime: act.task.endTime || "17:00",
            category: act.task.category || "study",
            notes: act.task.notes || "",
            completedDates: []
          });
          if (act.task.days?.length) {
            state.selectedDay = act.task.days[0];
          }
        } else if (act.type === "DELETE_TASK" && act.task) {
          state.tasks = state.tasks.filter(
            (t) => t.id !== act.task.id && !t.title.toLowerCase().includes((act.task.title || "").toLowerCase())
          );
        } else if (act.type === "UPDATE_TASK" && act.task) {
          const target = state.tasks.find(
            (t) => t.id === act.task.id || t.title.toLowerCase().includes((act.task.title || "").toLowerCase())
          );
          if (target) {
            if (act.task.title) target.title = act.task.title;
            if (act.task.startTime) target.startTime = act.task.startTime;
            if (act.task.endTime) target.endTime = act.task.endTime;
            if (act.task.days) target.days = act.task.days;
          }
        } else if (act.type === "NAVIGATE") {
          switchView(act.targetView || "today", typeof act.targetDay === "number" ? act.targetDay : null);
        }
      });
    }

    saveState();
    renderAll();
    showToast(result.reply || I18N[state.lang].saved_msg, 5000);
  } catch (err) {
    showToast(err.message, 6000);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------------- EVENT BINDINGS ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Register Service Worker for PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  // Voice Service Setup
  OrisVoice.init(
    (spokenText) => {
      document.getElementById("oris-prompt-input").value = spokenText;
      handleOrisPrompt(spokenText);
    },
    (status) => {
      const micBtn = document.getElementById("oris-mic-btn");
      const wakePill = document.getElementById("wake-badge");
      const wakeHeaderBtn = document.getElementById("wake-toggle-btn");

      micBtn.classList.toggle("recording", status === "listening");
      wakePill.classList.toggle("hidden", !OrisVoice.wakeMode);
      wakeHeaderBtn.classList.toggle("active-wake", OrisVoice.wakeMode);

      if (status === "listening") {
        showToast(I18N[state.lang].listening_now, 6000);
      }
    }
  );

  applyLanguage();
  initOnboarding();

  if (state.settings.wakeEnabled) {
    OrisVoice.setWakeMode(true, state.lang);
  }

  // Onboarding controls
  document.getElementById("ob-lang-toggle").onclick = () => {
    state.lang = state.lang === "ar" ? "en" : "ar";
    saveState();
    applyLanguage();
    renderOnboardingDays();
    updateOnboardingStep();
  };

  document.getElementById("ob-next").onclick = () => {
    if (obStep < 4) {
      obStep++;
      updateOnboardingStep();
    } else {
      finishOnboarding();
    }
  };

  document.getElementById("ob-prev").onclick = () => {
    if (obStep > 1) {
      obStep--;
      updateOnboardingStep();
    }
  };

  // Header & Navigation
  document.getElementById("lang-toggle-btn").onclick = () => {
    state.lang = state.lang === "ar" ? "en" : "ar";
    saveState();
    applyLanguage();
  };

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.onclick = () => switchView(btn.dataset.view);
  });

  document.getElementById("wake-toggle-btn").onclick = () => {
    state.settings.wakeEnabled = !state.settings.wakeEnabled;
    saveState();
    OrisVoice.setWakeMode(state.settings.wakeEnabled, state.lang);
    populateForms();
  };

  // Day switcher
  document.getElementById("prev-day-btn").onclick = () => {
    state.selectedDay = (state.selectedDay + 6) % 7;
    saveState();
    renderTimeline();
  };

  document.getElementById("next-day-btn").onclick = () => {
    state.selectedDay = (state.selectedDay + 1) % 7;
    saveState();
    renderTimeline();
  };

  document.getElementById("jump-today-btn").onclick = () => {
    state.selectedDay = new Date().getDay();
    saveState();
    renderTimeline();
  };

  document.getElementById("open-add-modal-btn").onclick = () => openTaskModal();

  // Task Modal Form
  document.getElementById("close-modal-btn").onclick = () => document.getElementById("task-modal").classList.add("hidden");
  document.getElementById("cancel-modal-btn").onclick = () => document.getElementById("task-modal").classList.add("hidden");

  document.getElementById("task-form").onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById("task-id").value;
    const payload = {
      id: id || generateId(),
      title: document.getElementById("task-title-input").value.trim(),
      days: [...modalSelectedDays],
      startTime: document.getElementById("task-start-input").value,
      endTime: document.getElementById("task-end-input").value,
      category: document.getElementById("task-category-input").value,
      notes: document.getElementById("task-notes-input").value.trim(),
      completedDates: []
    };

    if (id) {
      const idx = state.tasks.findIndex((t) => t.id === id);
      if (idx !== -1) {
        payload.completedDates = state.tasks[idx].completedDates || [];
        state.tasks[idx] = payload;
      }
    } else {
      state.tasks.push(payload);
    }

    saveState();
    document.getElementById("task-modal").classList.add("hidden");
    renderAll();
  };

  document.getElementById("delete-task-btn").onclick = () => {
    const id = document.getElementById("task-id").value;
    state.tasks = state.tasks.filter((t) => t.id !== id);
    saveState();
    document.getElementById("task-modal").classList.add("hidden");
    renderAll();
  };

  // Routine Preferences Save
  document.getElementById("save-prefs-btn").onclick = () => {
    state.preferences.wakeTime = document.getElementById("pref-wake").value;
    state.preferences.sleepTime = document.getElementById("pref-sleep").value;
    state.preferences.focusStart = document.getElementById("pref-focus-start").value;
    state.preferences.focusEnd = document.getElementById("pref-focus-end").value;
    state.preferences.hobbyStart = document.getElementById("pref-hobby-start").value;
    state.preferences.hobbyEnd = document.getElementById("pref-hobby-end").value;
    saveState();
    renderAll();
    showToast(I18N[state.lang].saved_msg);
  };

  // Settings Save & Backup
  document.getElementById("save-settings-btn").onclick = () => {
    state.settings.apiKey = document.getElementById("set-api-key").value.trim();
    state.settings.model = document.getElementById("set-model").value;
    state.settings.wakeEnabled = document.getElementById("set-wake-enabled").checked;
    saveState();
    OrisVoice.setWakeMode(state.settings.wakeEnabled, state.lang);
    showToast(I18N[state.lang].saved_msg);
  };

  document.getElementById("export-data-btn").onclick = () => {
    const exportCopy = structuredClone(state);
    exportCopy.settings.apiKey = ""; // Do not leak API key in backup file
    const blob = new Blob([JSON.stringify(exportCopy, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oris-schedule-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  document.getElementById("import-data-input").onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        const keepKey = state.settings.apiKey;
        state = { ...DEFAULT_STATE, ...imported };
        if (!state.settings.apiKey) state.settings.apiKey = keepKey;
        saveState();
        applyLanguage();
        showToast(I18N[state.lang].saved_msg);
      } catch (_) {}
    };
    reader.readAsText(file);
  };

  document.getElementById("reset-all-btn").onclick = () => {
    if (confirm(I18N[state.lang].confirm_reset)) {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  };

  // Oris AI Bar
  const promptInput = document.getElementById("oris-prompt-input");
  document.getElementById("oris-send-btn").onclick = () => {
    const val = promptInput.value;
    promptInput.value = "";
    handleOrisPrompt(val);
  };

  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const val = promptInput.value;
      promptInput.value = "";
      handleOrisPrompt(val);
    }
  });

  document.getElementById("oris-mic-btn").onclick = () => {
    OrisVoice.listenOnce(state.lang);
  };
});
