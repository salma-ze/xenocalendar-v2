// Local persistence for XenoCalendar — now keyed by day, so every
// day gets its own saved record and nothing gets overwritten when a
// new day starts. Everything still lives only in this browser's
// localStorage.

const STORAGE_KEY = "xenocalendar:days:v1";

export function dateKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function withIds(data) {
  const stamp = (item) => ({
    id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ...item,
  });
  const rawNotes = Array.isArray(data.notes)
    ? data.notes
    : typeof data.notes === "string" && data.notes.trim()
      ? [data.notes]
      : [];
  return {
    events: (data.events || []).map(stamp),
    tasks: (data.tasks || []).map((t) => ({ status: "pending", ...stamp(t) })),
    notes: rawNotes
      .map((note) => ({
        id:
          note && typeof note === "object" && note.id
            ? note.id
            : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        text: typeof note === "string" ? note : String(note?.text || ""),
        font: ["dream", "angel", "chewy", "gothic"].includes(note?.font)
          ? note.font
          : "dream",
        category: ["creative", "gym", "studies", "careers", "routine"].includes(
          note?.category,
        )
          ? note.category
          : "routine",
        color: ["pink", "rose", "lilac", "mint"].includes(note?.color)
          ? note.color
          : "pink",
      }))
      .filter((note) => note.text.trim()),
    focus: typeof data.focus === "string" ? data.focus : "",
    proteinGrams: typeof data.proteinGrams === "number" ? data.proteinGrams : 0,
    calories: typeof data.calories === "number" ? data.calories : 0,
  };
}

function readAllDays() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.warn(
      "XenoCalendar: couldn't read saved history, starting fresh.",
      err,
    );
    return {};
  }
}

function writeAllDays(days) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
    return true;
  } catch (err) {
    console.warn("XenoCalendar: couldn't save.", err);
    return false;
  }
}

// Loads (or creates) today's record. If this is the very first time
// XenoCalendar has ever run here, today is seeded with sample data;
// otherwise a new day just starts blank — like tearing off a fresh
// sheet — while every previous day stays intact in history.
export function loadToday(seed) {
  const days = readAllDays();
  const key = dateKey();
  const isVeryFirstRun = Object.keys(days).length === 0;
  if (!days[key]) {
    days[key] = withIds(
      isVeryFirstRun
        ? seed
        : { events: [], tasks: [], notes: "", proteinGrams: 0, calories: 0 },
    );
    writeAllDays(days);
  } else {
    days[key] = withIds(days[key]);
  }
  return { key, data: days[key] };
}

export function saveDay(key, dayData) {
  const days = readAllDays();
  days[key] = dayData;
  return writeAllDays(days);
}

// Returns past days (not including today), most recent first, each
// with a quick summary for the history list.
export function listHistory(excludeKey) {
  const days = readAllDays();
  return Object.keys(days)
    .filter((k) => k !== excludeKey)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((k) => {
      const d = withIds(days[k]);
      const doneCount = d.tasks.filter((t) => t.status === "done").length;
      return {
        key: k,
        eventCount: d.events.length,
        taskCount: d.tasks.length,
        doneCount,
        proteinGrams: d.proteinGrams,
      };
    });
}

export function getDay(key) {
  const days = readAllDays();
  return days[key] ? withIds(days[key]) : null;
}

export function exportData() {
  const days = readAllDays();
  const blob = new Blob([JSON.stringify(days, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const stamp = dateKey();
  const a = document.createElement("a");
  a.href = url;
  a.download = `xenocalendar-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("That file doesn't look like a XenoCalendar backup.");
        }
        const isOldShape =
          Array.isArray(parsed.events) && Array.isArray(parsed.tasks);
        const days = isOldShape ? { [dateKey()]: parsed } : parsed;
        writeAllDays(days);
        resolve(loadToday({ events: [], tasks: [] }));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () =>
      reject(reader.error || new Error("Couldn't read that file."));
    reader.readAsText(file);
  });
}
