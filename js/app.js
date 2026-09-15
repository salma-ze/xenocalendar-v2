import { config } from "./config.js";
import {
  loadToday,
  saveDay,
  mergeDays,
  listHistory,
  getDay,
  exportData,
  importFromFile,
} from "./storage.js";
import {
  fetchFromNotion,
  mergeNotionData,
  fetchPlannerDays,
  savePlannerDay,
} from "./sync.js";

/* ---------------------------------------------------------- */
/* State                                                       */
/* ---------------------------------------------------------- */

let { key: currentDayKey, data: state } = loadToday(config.seedData);

function persist() {
  saveDay(currentDayKey, state);
}

async function syncPlanner() {
  const remoteDays = await fetchPlannerDays(config.plannerApiUrl);
  mergeDays(remoteDays);
  const todayData = remoteDays[currentDayKey];
  if (todayData) {
    state = todayData;
    focusInput.value = state.focus || "";
    renderEvents();
    renderTodos();
    renderNotes();
    renderProtein();
    renderCalories();
  }
  await savePlannerDay(config.plannerApiUrl, currentDayKey, state);
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ---------------------------------------------------------- */
/* Elements                                                     */
/* ---------------------------------------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);

const widgetShell = $("#widgetShell");
const widgetFab = $("#widgetFab");
const widgetDrag = $("#widgetDrag");
const fullscreenBtn = $("#fullscreenBtn");
const pinBtn = $("#pinBtn");
const minimizeBtn = $("#minimizeBtn");
const notionConnectBtn = $("#notionConnectBtn");
const notionConnectMenu = $("#notionConnectMenu");
const widgetGreeting = $("#widgetGreeting");
const progressFill = $("#progressFill");
const progressLabel = $("#progressLabel");
const syncBadge = $("#syncBadge");
const syncBtn = $("#syncBtn");
const exportBtn = $("#exportBtn");
const importInput = $("#importInput");
const widgetViewport = $("#widgetViewport");
const stage = $("#stage");
const eventsList = $("#eventsList");
const todosList = $("#todosList");
const focusInput = $("#focusInput");
const notesList = $("#notesList");
const noteForm = $("#noteForm");
const noteInput = $("#noteInput");
const noteFont = $("#noteFont");
const noteCategory = $("#noteCategory");
const noteColorButtons = noteForm.querySelectorAll(".note-color-option");
const proteinAmount = $("#proteinAmount");
const proteinFill = $("#proteinFill");
const proteinInput = $("#proteinInput");
const proteinAddBtn = $("#proteinAddBtn");
const caloriesAmount = $("#caloriesAmount");
const caloriesFill = $("#caloriesFill");
const caloriesInput = $("#caloriesInput");
const caloriesAddBtn = $("#caloriesAddBtn");
const historyBtn = $("#historyBtn");
const historyOverlay = $("#historyOverlay");
const historyList = $("#historyList");
const historyDetail = $("#historyDetail");
const historyBackBtn = $("#historyBackBtn");
const historyCloseBtn = $("#historyCloseBtn");
const historyReceiptDate = $("#historyReceiptDate");
const historyEventsList = $("#historyEventsList");
const historyTodosList = $("#historyTodosList");
const historyProteinAmount = $("#historyProteinAmount");
const historyProteinFill = $("#historyProteinFill");
const historyCaloriesAmount = $("#historyCaloriesAmount");
const historyNotesText = $("#historyNotesText");
const receipt = $("#receipt");
const receiptDate = $("#receiptDate");
const printBtn = $("#printBtn");
const printerTextEl = $(".printer-text");
const heading = $(".intro h1");
const addPanel = $("#addPanel");
const addTaskForm = $("#addTaskForm");
const addEventForm = $("#addEventForm");

/* ---------------------------------------------------------- */
/* Greeting + date stamp                                       */
/* ---------------------------------------------------------- */

widgetGreeting.textContent = config.greeting;

const today = new Date();
receiptDate.textContent = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
focusInput.value = state.focus;

focusInput.addEventListener("input", () => {
  state.focus = focusInput.value;
  persist();
});

/* ---------------------------------------------------------- */
/* Typewriter heading                                           */
/* ---------------------------------------------------------- */

const TYPE_DELAY = 90;
const DELETE_DELAY = 60;
const HOLD_AFTER_TYPE = 1400;
const HOLD_AFTER_DELETE = 300;

const caret = document.createElement("span");
caret.className = "caret";
caret.textContent = "|";
heading.appendChild(caret);

function typeString(str, i, done) {
  if (i >= str.length) return done();
  caret.before(str[i]);
  setTimeout(() => typeString(str, i + 1, done), TYPE_DELAY);
}

function deleteChars(n, done) {
  if (n <= 0) return done();
  const prev = caret.previousSibling;
  if (prev) {
    if (prev.nodeType === Node.TEXT_NODE && prev.data.length > 1) {
      prev.data = prev.data.slice(0, -1);
    } else {
      prev.remove();
    }
  }
  setTimeout(() => deleteChars(n - 1, done), DELETE_DELAY);
}

function loopWord(idx) {
  const word = config.headingWords[idx % config.headingWords.length];
  typeString(word, 0, () => {
    setTimeout(() => {
      deleteChars(word.length, () => {
        setTimeout(() => loopWord(idx + 1), HOLD_AFTER_DELETE);
      });
    }, HOLD_AFTER_TYPE);
  });
}

setTimeout(() => {
  typeString(config.headingPrefix, 0, () => {
    setTimeout(() => loopWord(0), HOLD_AFTER_DELETE);
  });
}, 600);

/* ---------------------------------------------------------- */
/* Printer screen text: idle vs. actively working              */
/* ---------------------------------------------------------- */

let idleFrame = 0;
let idleInterval = null;

function startIdlePrinterText() {
  clearInterval(idleInterval);
  idleFrame = 0;
  printerTextEl.textContent = config.printerIdleFrames[0];
  idleInterval = setInterval(() => {
    idleFrame = (idleFrame + 1) % config.printerIdleFrames.length;
    printerTextEl.textContent = config.printerIdleFrames[idleFrame];
  }, 700);
}

function runActivePrinterText(durationMs) {
  clearInterval(idleInterval);
  let frame = 0;
  printerTextEl.textContent = config.printerActiveFrames[0];
  const activeInterval = setInterval(() => {
    frame = 1 - frame;
    printerTextEl.textContent = config.printerActiveFrames[frame];
  }, 400);
  setTimeout(() => {
    clearInterval(activeInterval);
    startIdlePrinterText();
  }, durationMs);
}

startIdlePrinterText();

/* ---------------------------------------------------------- */
/* Rendering: events + todos + progress                        */
/* ---------------------------------------------------------- */

function categoryLabel(key) {
  return config.categories[key]?.label || key;
}

function groupByCategory(items) {
  // Groups items by category, in config's category order, then any
  // leftover categories (e.g. from old saved data) at the end.
  const order = Object.keys(config.categories);
  const groups = [];
  order.forEach((cat) => {
    const inCat = items.filter((i) => i.category === cat);
    if (inCat.length > 0) groups.push({ cat, items: inCat });
  });
  const known = new Set(order);
  const orphanCats = [
    ...new Set(
      items.filter((i) => !known.has(i.category)).map((i) => i.category),
    ),
  ];
  orphanCats.forEach((cat) => {
    groups.push({ cat, items: items.filter((i) => i.category === cat) });
  });
  return groups;
}

function buildCategoryDivider(cat) {
  const li = document.createElement("li");
  li.className = `category-divider category-divider-${cat}`;
  li.textContent = categoryLabel(cat);
  return li;
}

function buildEventLi(ev) {
  const li = document.createElement("li");
  li.dataset.id = ev.id;

  const icon = document.createElement("span");
  icon.className = `event-icon event-${ev.category}`;
  icon.title = categoryLabel(ev.category);

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = ev.label;

  li.appendChild(icon);
  li.appendChild(label);

  if (ev.time) {
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = ev.time;
    li.appendChild(time);
  }

  if (ev.link) {
    const a = document.createElement("a");
    a.href = ev.link;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "link";
    li.appendChild(a);
  }

  const remove = document.createElement("button");
  remove.className = "remove-btn";
  remove.type = "button";
  remove.title = "Remove event";
  remove.textContent = "×";
  remove.addEventListener("click", () => {
    state.events = state.events.filter((e) => e.id !== ev.id);
    persist();
    renderEvents();
  });
  li.appendChild(remove);

  return li;
}

function renderEvents() {
  eventsList.innerHTML = "";
  if (state.events.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nothing scheduled — go make something beautiful.";
    eventsList.appendChild(li);
    return;
  }
  groupByCategory(state.events).forEach(({ cat, items }) => {
    eventsList.appendChild(buildCategoryDivider(cat));
    items.forEach((ev) => eventsList.appendChild(buildEventLi(ev)));
  });
}

const STATUSES = ["pending", "progress", "done"];
const STATUS_GLYPH = { pending: "•", progress: "~", done: "✓" };

function buildTodoLi(task) {
  const li = document.createElement("li");
  li.className = `todo status-${task.status}`;
  li.dataset.id = task.id;

  const icon = document.createElement("span");
  icon.className = `todo-icon todo-${task.category}`;
  icon.title = categoryLabel(task.category);
  li.appendChild(icon);

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = task.label;
  li.appendChild(label);

  if (task.link) {
    const a = document.createElement("a");
    a.href = task.link;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "link";
    li.appendChild(a);
  }

  const group = document.createElement("div");
  group.className = "status-group";
  STATUSES.forEach((status) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "status-btn" + (task.status === status ? " active" : "");
    btn.dataset.status = status;
    btn.title = status;
    btn.textContent = STATUS_GLYPH[status];
    btn.addEventListener("click", (e) => {
      const wasDone = task.status === "done";
      task.status = status;
      persist();
      renderTodos();
      if (!wasDone && status === "done") {
        spawnSparkles(e.clientX, e.clientY);
      }
    });
    group.appendChild(btn);
  });
  li.appendChild(group);

  const remove = document.createElement("button");
  remove.className = "remove-btn";
  remove.type = "button";
  remove.title = "Remove task";
  remove.textContent = "×";
  remove.addEventListener("click", () => {
    state.tasks = state.tasks.filter((t) => t.id !== task.id);
    persist();
    renderTodos();
  });
  li.appendChild(remove);

  return li;
}

function renderTodos() {
  todosList.innerHTML = "";
  if (state.tasks.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No rituals queued yet.";
    todosList.appendChild(li);
    updateProgress();
    return;
  }
  groupByCategory(state.tasks).forEach(({ cat, items }) => {
    todosList.appendChild(buildCategoryDivider(cat));
    items.forEach((task) => todosList.appendChild(buildTodoLi(task)));
  });
  updateProgress();
}

function updateProgress() {
  const total = state.tasks.length;
  const done = state.tasks.filter((t) => t.status === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  progressFill.style.width = `${pct}%`;
  progressLabel.textContent = total === 0 ? "0%" : `${done}/${total} done`;
}

renderEvents();
renderTodos();

/* ---------------------------------------------------------- */
/* Gym & Food notes — saved as individually editable entries    */
/* ---------------------------------------------------------- */

const NOTE_FONTS = [
  ["dream", "Dreams"],
  ["angel", "Angel"],
  ["chewy", "Chewy"],
  ["gothic", "Gothic"],
];
const NOTE_COLORS = ["pink", "rose", "lilac", "mint"];
const NOTE_CATEGORIES = ["creative", "gym", "studies", "careers", "routine"];

function setNoteAppearance(element, font, color) {
  element.classList.remove(
    ...NOTE_FONTS.map(([key]) => `note-font-${key}`),
    ...NOTE_COLORS.map((key) => `note-color-${key}`),
  );
  element.classList.add(`note-font-${font}`, `note-color-${color}`);
}

function buildNoteSelect(options, value, onChange) {
  const select = document.createElement("select");
  options.forEach(([key, label]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    select.appendChild(option);
  });
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function buildNoteOptions(note, row) {
  const options = document.createElement("div");
  options.className = "note-options";
  const fontSelect = buildNoteSelect(NOTE_FONTS, note.font, (value) => {
    note.font = value;
    setNoteAppearance(row, note.font, note.color);
    persist();
  });
  const categorySelect = buildNoteSelect(
    NOTE_CATEGORIES.map((key) => [key, categoryLabel(key)]),
    note.category,
    (value) => {
      note.category = value;
      persist();
    },
  );
  const colors = document.createElement("div");
  colors.className = "note-colors";
  NOTE_COLORS.forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "note-color-option";
    button.dataset.color = color;
    button.title = color;
    button.classList.toggle("is-selected", note.color === color);
    button.addEventListener("click", () => {
      note.color = color;
      setNoteAppearance(row, note.font, note.color);
      colors.querySelectorAll(".note-color-option").forEach((item) => {
        item.classList.toggle("is-selected", item === button);
      });
      persist();
    });
    colors.appendChild(button);
  });
  options.append(fontSelect, categorySelect, colors);
  return options;
}

function renderNotes() {
  notesList.innerHTML = "";
  if (state.notes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "notes-empty";
    empty.textContent = "No notes yet.";
    notesList.appendChild(empty);
    return;
  }
  state.notes.forEach((note) => {
    const row = document.createElement("div");
    row.className = `note-entry note-font-${note.font} note-color-${note.color}`;

    row.appendChild(buildNoteOptions(note, row));

    const area = document.createElement("textarea");
    area.className = "notes-area";
    area.rows = 2;
    area.value = note.text;
    area.addEventListener("input", () => {
      note.text = area.value;
      clearTimeout(row.saveTimer);
      row.saveTimer = setTimeout(persist, 400);
    });

    const remove = document.createElement("button");
    remove.className = "note-remove";
    remove.type = "button";
    remove.title = "Delete note";
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      state.notes = state.notes.filter((item) => item.id !== note.id);
      persist();
      renderNotes();
    });

    setNoteAppearance(area, note.font, note.color);
    row.append(area, remove);
    notesList.appendChild(row);
  });
}

const noteDraft = {
  font: noteFont.value,
  category: noteCategory.value,
  color: "pink",
};

function updateDraftColor(color) {
  noteDraft.color = color;
  setNoteAppearance(noteInput, noteDraft.font, noteDraft.color);
  noteColorButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.color === color);
  });
}

noteFont.addEventListener("change", () => {
  noteDraft.font = noteFont.value;
  setNoteAppearance(noteInput, noteDraft.font, noteDraft.color);
});

noteCategory.addEventListener("change", () => {
  noteDraft.category = noteCategory.value;
});

noteColorButtons.forEach((button) => {
  button.addEventListener("click", () =>
    updateDraftColor(button.dataset.color),
  );
});

noteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = noteInput.value.trim();
  if (!text) return;
  state.notes.push({ id: makeId(), text, ...noteDraft });
  persist();
  noteInput.value = "";
  renderNotes();
});

renderNotes();

/* ---------------------------------------------------------- */
/* Protein tracker                                              */
/* ---------------------------------------------------------- */

function renderProtein() {
  const goal = config.proteinGoalGrams;
  const pct =
    goal > 0 ? Math.min(100, Math.round((state.proteinGrams / goal) * 100)) : 0;
  proteinAmount.textContent = `${state.proteinGrams}g / ${goal}g`;
  proteinFill.style.width = `${pct}%`;
  proteinFill.classList.toggle("has-protein", state.proteinGrams > 0);
}

renderProtein();

function renderCalories() {
  const goal = config.caloriesGoal;
  const pct =
    goal > 0 ? Math.min(100, Math.round((state.calories / goal) * 100)) : 0;
  caloriesAmount.textContent = `${state.calories} / ${goal} kcal`;
  caloriesFill.style.width = `${pct}%`;
  caloriesFill.classList.toggle("has-protein", state.calories > 0);
}

renderCalories();

proteinAddBtn.addEventListener("click", () => {
  const grams = parseFloat(proteinInput.value);
  if (!Number.isFinite(grams) || grams <= 0) return;
  state.proteinGrams += Math.round(grams);
  persist();
  renderProtein();
  proteinInput.value = "";
});

proteinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    proteinAddBtn.click();
  }
});

caloriesAddBtn.addEventListener("click", () => {
  const amount = parseFloat(caloriesInput.value);
  if (!Number.isFinite(amount) || amount <= 0) return;
  state.calories += Math.round(amount);
  persist();
  renderCalories();
  caloriesInput.value = "";
});

caloriesInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    caloriesAddBtn.click();
  }
});

/* ---------------------------------------------------------- */
/* Add panel: tabs + forms                                     */
/* ---------------------------------------------------------- */

document.querySelectorAll(".add-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".add-tab")
      .forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    const target = tab.dataset.tab;
    addTaskForm.classList.toggle("is-hidden", target !== "task");
    addEventForm.classList.toggle("is-hidden", target !== "event");
  });
});

addTaskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(addTaskForm);
  const label = String(data.get("label") || "").trim();
  if (!label) return;
  state.tasks.push({
    id: makeId(),
    label,
    link: String(data.get("link") || "").trim(),
    category: String(data.get("category") || "art"),
    status: "pending",
  });
  persist();
  renderTodos();
  addTaskForm.reset();
});

addEventForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(addEventForm);
  const label = String(data.get("label") || "").trim();
  if (!label) return;
  state.events.push({
    id: makeId(),
    label,
    time: String(data.get("time") || "").trim(),
    link: String(data.get("link") || "").trim(),
    category: String(data.get("category") || "art"),
  });
  persist();
  renderEvents();
  addEventForm.reset();
});

/* ---------------------------------------------------------- */
/* Todo sparkle burst                                           */
/* ---------------------------------------------------------- */

const SPARKLE_GLYPHS = ["✦", "✧", "⋆", "💗", "✶"];
const SPARKLES_PER_BURST = 8;

function spawnSparkles(clientX, clientY) {
  const rect = widgetViewport.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  for (let i = 0; i < SPARKLES_PER_BURST; i++) {
    const sparkle = document.createElement("span");
    sparkle.className = "sparkle";
    sparkle.textContent =
      SPARKLE_GLYPHS[Math.floor(Math.random() * SPARKLE_GLYPHS.length)];
    sparkle.style.left = `${x}px`;
    sparkle.style.top = `${y}px`;
    sparkle.style.fontSize = `${12 + Math.random() * 10}px`;

    const angle = (i / SPARKLES_PER_BURST) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 28 + Math.random() * 24;
    sparkle.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    sparkle.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);

    widgetViewport.appendChild(sparkle);
    sparkle.addEventListener("animationend", () => sparkle.remove());
  }
}

/* ---------------------------------------------------------- */
/* Receipt wiggle on click                                      */
/* ---------------------------------------------------------- */

function wiggleReceipt() {
  receipt.classList.remove("is-wiggle");
  void receipt.offsetWidth;
  receipt.classList.add("is-wiggle");
}

receipt.addEventListener("click", (e) => {
  if (
    e.target.closest(".todo") ||
    e.target.closest("a") ||
    e.target.closest("button") ||
    e.target.closest("textarea")
  )
    return;
  wiggleReceipt();
});

receipt.addEventListener("animationend", (e) => {
  if (e.animationName === "receipt-wiggle")
    receipt.classList.remove("is-wiggle");
});

/* ---------------------------------------------------------- */
/* Print / retract flow                                         */
/* ---------------------------------------------------------- */
/* The printer docks near the top the first time you print, and */
/* stays there — the paper just extends and retracts below it,  */
/* like an actual receipt printer, instead of the whole thing   */
/* sliding back to center once "done".                          */

function cssMs(varName, fallback) {
  const raw = getComputedStyle(stage).getPropertyValue(varName).trim();
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return fallback;
  return raw.endsWith("ms") ? n : n * 1000;
}

const MOVE_MS = cssMs("--move-duration", 500);
const PRINT_MS = cssMs("--print-duration", 1800);

let isExtended = false;
let isAnimating = false;

function setPrintBtnLabel() {
  printBtn.textContent = isExtended ? "Retract scroll" : "Summon scroll";
}
setPrintBtnLabel();

function extendScroll() {
  if (isAnimating || isExtended) return;
  isAnimating = true;
  addPanel.hidden = false;
  widgetShell.classList.add("is-working");

  const alreadyDocked = widgetShell.classList.contains("is-docked");
  widgetShell.classList.add("is-docked");
  const delay = alreadyDocked ? 0 : MOVE_MS;

  runActivePrinterText(delay + PRINT_MS);

  setTimeout(() => {
    widgetShell.classList.add("is-extended");
    isExtended = true;
    setPrintBtnLabel();
    setTimeout(() => {
      isAnimating = false;
      widgetShell.classList.remove("is-working");
      wiggleReceipt();
    }, PRINT_MS);
  }, delay);
}

function retractScroll() {
  if (isAnimating || !isExtended) return;
  isAnimating = true;
  widgetShell.classList.add("is-working");
  runActivePrinterText(PRINT_MS);
  widgetShell.classList.remove("is-extended");
  isExtended = false;
  setPrintBtnLabel();
  setTimeout(() => {
    isAnimating = false;
    widgetShell.classList.remove("is-working");
  }, PRINT_MS);
}

printBtn.addEventListener("click", () => {
  if (isExtended) retractScroll();
  else extendScroll();
});

/* ---------------------------------------------------------- */
/* History — browse any past day, read-only                    */
/* ---------------------------------------------------------- */

function formatDateKey(key) {
  // "2026-08-30" -> "8/30/2026", matching the main receipt's date style.
  const [y, m, d] = key.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`;
}

function openHistory() {
  const days = listHistory(currentDayKey);
  historyList.innerHTML = "";
  if (days.length === 0) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent =
      "No past days yet — they'll show up here once a new day starts.";
    historyList.appendChild(empty);
  } else {
    days.forEach((day) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "history-day-btn";

      const dateSpan = document.createElement("span");
      dateSpan.className = "history-day-date";
      dateSpan.textContent = formatDateKey(day.key);

      const summarySpan = document.createElement("span");
      summarySpan.className = "history-day-summary";
      summarySpan.textContent = `${day.doneCount}/${day.taskCount} done · ${day.proteinGrams}g protein`;

      btn.appendChild(dateSpan);
      btn.appendChild(summarySpan);
      btn.addEventListener("click", () => showHistoryDay(day.key));
      historyList.appendChild(btn);
    });
  }
  historyDetail.style.display = "none";
  historyList.style.display = "flex";
  historyOverlay.style.display = "flex";
}

function closeHistory() {
  historyOverlay.style.display = "none";
}

function buildReadOnlyEventLi(ev) {
  const li = document.createElement("li");
  const icon = document.createElement("span");
  icon.className = `event-icon event-${ev.category}`;
  icon.title = categoryLabel(ev.category);
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = ev.label;
  li.appendChild(icon);
  li.appendChild(label);
  if (ev.time) {
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = ev.time;
    li.appendChild(time);
  }
  return li;
}

function buildReadOnlyTodoLi(task) {
  const li = document.createElement("li");
  li.className = `todo status-${task.status}`;
  const icon = document.createElement("span");
  icon.className = `todo-icon todo-${task.category}`;
  icon.title = categoryLabel(task.category);
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = `${STATUS_GLYPH[task.status]} ${task.label}`;
  li.appendChild(icon);
  li.appendChild(label);
  if (task.link) {
    const a = document.createElement("a");
    a.href = task.link;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "link";
    li.appendChild(a);
  }
  return li;
}

function showHistoryDay(key) {
  const day = getDay(key);
  if (!day) return;

  historyReceiptDate.textContent = formatDateKey(key);

  historyEventsList.innerHTML = "";
  if (day.events.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nothing was scheduled.";
    historyEventsList.appendChild(li);
  } else {
    groupByCategory(day.events).forEach(({ cat, items }) => {
      historyEventsList.appendChild(buildCategoryDivider(cat));
      items.forEach((ev) =>
        historyEventsList.appendChild(buildReadOnlyEventLi(ev)),
      );
    });
  }

  historyTodosList.innerHTML = "";
  if (day.tasks.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No tasks that day.";
    historyTodosList.appendChild(li);
  } else {
    groupByCategory(day.tasks).forEach(({ cat, items }) => {
      historyTodosList.appendChild(buildCategoryDivider(cat));
      items.forEach((t) =>
        historyTodosList.appendChild(buildReadOnlyTodoLi(t)),
      );
    });
  }

  const goal = config.proteinGoalGrams;
  const pct =
    goal > 0 ? Math.min(100, Math.round((day.proteinGrams / goal) * 100)) : 0;
  historyProteinAmount.textContent = `${day.proteinGrams}g / ${goal}g`;
  historyProteinFill.style.width = `${pct}%`;
  historyProteinFill.classList.toggle("has-protein", day.proteinGrams > 0);
  historyCaloriesAmount.textContent = `${day.calories} / ${config.caloriesGoal} kcal`;
  historyNotesText.innerHTML = "";
  if (day.notes.length === 0) {
    historyNotesText.textContent = "(nothing written)";
  } else {
    day.notes.forEach((note) => {
      const entry = document.createElement("p");
      entry.className = `note-font-${note.font} note-color-${note.color}`;
      entry.textContent = note.text;
      historyNotesText.appendChild(entry);
    });
  }

  historyList.style.display = "none";
  historyDetail.style.display = "block";
}

historyBtn.addEventListener("click", openHistory);
historyCloseBtn.addEventListener("click", closeHistory);
historyBackBtn.addEventListener("click", () => {
  historyDetail.style.display = "none";
  historyList.style.display = "flex";
});

function closeNotionMenu() {
  notionConnectMenu.hidden = true;
  notionConnectBtn.setAttribute("aria-expanded", "false");
}

notionConnectBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = !notionConnectMenu.hidden;
  notionConnectMenu.hidden = isOpen;
  notionConnectBtn.setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".notion-connect-wrap")) closeNotionMenu();
});

notionConnectMenu.addEventListener("click", (event) => {
  event.stopPropagation();
});

/* ---------------------------------------------------------- */
/* Export / import                                              */
/* ---------------------------------------------------------- */

exportBtn.addEventListener("click", () => exportData());

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;
  try {
    const result = await importFromFile(file);
    currentDayKey = result.key;
    state = result.data;
    focusInput.value = state.focus;
    persist();
    renderEvents();
    renderTodos();
    renderNotes();
    renderProtein();
    renderCalories();
    flashSyncBadge("● backup restored", "sync-synced");
  } catch (err) {
    console.warn(err);
    flashSyncBadge("● import failed", "sync-error");
  } finally {
    importInput.value = "";
  }
});

/* ---------------------------------------------------------- */
/* "Sync" button — local save or Notion sync                   */
/* ---------------------------------------------------------- */

function flashSyncBadge(text, cls) {
  const original = syncBadge.textContent;
  const originalClass = syncBadge.className;
  syncBadge.textContent = text;
  syncBadge.className = `sync-badge ${cls}`;
  setTimeout(() => {
    syncBadge.textContent = original;
    syncBadge.className = originalClass;
  }, 1600);
}

syncBtn.addEventListener("click", async () => {
  if (config.syncMode === "notion-cloud") {
    flashSyncBadge("● syncing…", "sync-local");
    try {
      persist();
      await syncPlanner();
      flashSyncBadge("● synced everywhere", "sync-synced");
    } catch (err) {
      console.warn("Cloud planner sync failed:", err);
      flashSyncBadge("● sync failed", "sync-error");
    }
    return;
  }

  if (config.syncMode !== "notion") {
    persist();
    flashSyncBadge("● saved ✓", "sync-synced");
    return;
  }

  flashSyncBadge("● syncing…", "sync-local");
  try {
    const notionData = await fetchFromNotion(config.notionApiUrl);
    state = mergeNotionData(state, notionData);
    persist();
    renderEvents();
    renderTodos();
    flashSyncBadge("● synced with Notion", "sync-synced");
  } catch (err) {
    console.warn("Notion sync failed:", err);
    flashSyncBadge("● sync failed", "sync-error");
  }
});

if (config.syncMode === "notion-cloud") {
  syncPlanner()
    .then(() => flashSyncBadge("● synced everywhere", "sync-synced"))
    .catch((err) => console.warn("Initial cloud planner sync failed:", err));
}

/* ---------------------------------------------------------- */
/* Widget chrome: drag, minimize, pin to corner, fullscreen     */
/* ---------------------------------------------------------- */

let dragOffset = null;

function startDrag(clientX, clientY) {
  const rect = widgetShell.getBoundingClientRect();
  widgetShell.style.left = `${rect.left}px`;
  widgetShell.style.top = `${rect.top}px`;
  widgetShell.style.right = "auto";
  widgetShell.style.bottom = "auto";
  dragOffset = { x: clientX - rect.left, y: clientY - rect.top };
  widgetShell.classList.add("is-dragging");
}

function moveDrag(clientX, clientY) {
  if (!dragOffset) return;
  const maxX = window.innerWidth - widgetShell.offsetWidth;
  const maxY = window.innerHeight - widgetShell.offsetHeight;
  const x = Math.min(Math.max(0, clientX - dragOffset.x), Math.max(0, maxX));
  const y = Math.min(Math.max(0, clientY - dragOffset.y), Math.max(0, maxY));
  widgetShell.style.left = `${x}px`;
  widgetShell.style.top = `${y}px`;
}

function endDrag() {
  dragOffset = null;
  widgetShell.classList.remove("is-dragging");
}

widgetDrag.addEventListener("mousedown", (e) => {
  if (e.target.closest("button, a, .notion-connect-menu")) return;
  startDrag(e.clientX, e.clientY);
});
window.addEventListener("mousemove", (e) => moveDrag(e.clientX, e.clientY));
window.addEventListener("mouseup", endDrag);

widgetDrag.addEventListener("touchstart", (e) => {
  if (e.target.closest("button, a, .notion-connect-menu")) return;
  const t = e.touches[0];
  startDrag(t.clientX, t.clientY);
});
window.addEventListener("touchmove", (e) => {
  if (!dragOffset) return;
  const t = e.touches[0];
  moveDrag(t.clientX, t.clientY);
});
window.addEventListener("touchend", endDrag);

// Minimize to a small pill / restore
// Start hidden — their own CSS sets `display: flex`, which overrides
// the HTML `hidden` attribute (same cascade quirk bit us before), so
// this has to be set explicitly instead.
widgetFab.style.display = "none";
historyOverlay.style.display = "none";

minimizeBtn.addEventListener("click", () => {
  widgetShell.style.display = "none";
  widgetFab.style.display = "flex";
});

widgetFab.addEventListener("click", () => {
  widgetFab.style.display = "none";
  widgetShell.style.display = "flex";
});

// Pin: cycle through screen corners
const CORNERS = ["top-right", "bottom-right", "bottom-left", "top-left"];
let cornerIndex = 0;

function applyCorner(name) {
  const margin = 16;
  widgetShell.style.left = "auto";
  widgetShell.style.top = "auto";
  widgetShell.style.right = "auto";
  widgetShell.style.bottom = "auto";
  if (name === "top-right") {
    widgetShell.style.top = `${margin}px`;
    widgetShell.style.right = `${margin}px`;
  } else if (name === "bottom-right") {
    widgetShell.style.bottom = `${margin}px`;
    widgetShell.style.right = `${margin}px`;
  } else if (name === "bottom-left") {
    widgetShell.style.bottom = `${margin}px`;
    widgetShell.style.left = `${margin}px`;
  } else if (name === "top-left") {
    widgetShell.style.top = `${margin}px`;
    widgetShell.style.left = `${margin}px`;
  }
}

pinBtn.addEventListener("click", () => {
  applyCorner(CORNERS[cornerIndex]);
  cornerIndex = (cornerIndex + 1) % CORNERS.length;
  pinBtn.classList.add("is-active");
  setTimeout(() => pinBtn.classList.remove("is-active"), 250);
});

// Default position: top-right corner on first load
applyCorner("top-right");

// Fullscreen toggle
fullscreenBtn.addEventListener("click", () => {
  const isFull = widgetShell.classList.toggle("is-fullscreen");
  document.body.classList.toggle("widget-fullscreen", isFull);
  fullscreenBtn.classList.toggle("is-active", isFull);
  if (isFull) {
    widgetShell.style.left = "50%";
    widgetShell.style.top = "50%";
    widgetShell.style.right = "auto";
    widgetShell.style.bottom = "auto";
    widgetShell.style.width = "min(560px, 92vw)";
    widgetShell.style.height = "min(760px, 92vh)";
    widgetShell.style.transform = "translate(-50%, -50%)";
  } else {
    widgetShell.style.transform = "none";
    widgetShell.style.width = "";
    widgetShell.style.height = "";
    applyCorner(CORNERS[(cornerIndex - 1 + CORNERS.length) % CORNERS.length]);
  }
});

/* ---------------------------------------------------------- */
/* Background ambience: twinkles + drifting goth glyphs         */
/* ---------------------------------------------------------- */

const BG_SPARKLE_COUNT = 40;
const bgSparkleContainer = document.querySelector(".bg-sparkles");

for (let i = 0; i < BG_SPARKLE_COUNT; i++) {
  const sparkle = document.createElement("span");
  sparkle.className = "bg-sparkle";
  const size = 2 + Math.floor(Math.random() * 3);
  sparkle.style.width = `${size}px`;
  sparkle.style.height = `${size}px`;
  sparkle.style.borderRadius = "50%";
  sparkle.style.left = `${Math.random() * 100}%`;
  sparkle.style.top = `${Math.random() * 100}%`;
  sparkle.style.setProperty("--dur", `${2 + Math.random() * 3}s`);
  sparkle.style.setProperty("--delay", `${Math.random() * 4}s`);
  bgSparkleContainer.appendChild(sparkle);
}

const BUBBLE_GLYPHS = ["🦇", "🖤"];
const bgDecorContainer = document.querySelector(".bg-decors");
const bubbles = [];

function spawnBubbles() {
  bgDecorContainer.innerHTML = "";
  bubbles.length = 0;
  const w = widgetViewport.clientWidth;
  const h = widgetViewport.clientHeight;
  const count = 6;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "bg-bubble";
    el.textContent = BUBBLE_GLYPHS[i % BUBBLE_GLYPHS.length];
    el.style.fontSize = `${16 + Math.random() * 14}px`;
    bgDecorContainer.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 6;
    bubbles.push({
      el,
      x: Math.random() * Math.max(0, w - 20),
      y: Math.random() * Math.max(0, h - 20),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
    });

    el.addEventListener("click", (e) => {
      const b = bubbles.find((bub) => bub.el === el);
      if (!b) return;
      const angleKick = Math.random() * Math.PI * 2;
      b.vx = Math.cos(angleKick) * 40;
      b.vy = Math.sin(angleKick) * 40;
      spawnSparkles(e.clientX, e.clientY);
    });
  }
}

let bgLastTime = performance.now();
function tickBubbles(now) {
  const dt = Math.min(0.05, (now - bgLastTime) / 1000);
  bgLastTime = now;
  const w = widgetViewport.clientWidth;
  const h = widgetViewport.clientHeight;

  bubbles.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // gentle drag so kicks settle back to a drift
    b.vx *= 0.985;
    b.vy *= 0.985;
    if (b.x < 0) {
      b.x = 0;
      b.vx *= -1;
    } else if (b.x > w - 20) {
      b.x = w - 20;
      b.vx *= -1;
    }
    if (b.y < 0) {
      b.y = 0;
      b.vy *= -1;
    } else if (b.y > h - 20) {
      b.y = h - 20;
      b.vy *= -1;
    }
    b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
  });

  requestAnimationFrame(tickBubbles);
}

spawnBubbles();
requestAnimationFrame((t) => {
  bgLastTime = t;
  tickBubbles(t);
});

window.addEventListener("resize", () => {
  spawnBubbles();
});
