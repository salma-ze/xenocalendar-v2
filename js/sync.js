// Fetches today's items from the deployed Notion proxy (api/notion.js)
// and merges them into local state — replacing only the items that
// came from Notion last time, so anything added locally is untouched.

export async function fetchFromNotion(apiUrl) {
  const response = await fetch(apiUrl, { method: "GET" });
  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json()).error || "";
    } catch (_) {
      // ignore — body wasn't JSON
    }
    throw new Error(detail || `Sync failed (${response.status})`);
  }
  const data = await response.json();
  if (!Array.isArray(data.events) || !Array.isArray(data.tasks)) {
    throw new Error("Unexpected response shape from the sync endpoint.");
  }
  return data;
}

export function mergeNotionData(state, notionData) {
  const localEvents = state.events.filter((e) => e.source !== "notion");
  const localTasks = state.tasks.filter((t) => t.source !== "notion");
  return {
    ...state,
    events: [...localEvents, ...notionData.events],
    tasks: [...localTasks, ...notionData.tasks],
  };
}

export async function fetchPlannerDays(apiUrl) {
  const response = await fetch(apiUrl, { method: "GET" });
  if (!response.ok) throw new Error(`Planner sync failed (${response.status})`);
  const data = await response.json();
  if (!data.days || typeof data.days !== "object") {
    throw new Error("Unexpected response from the planner sync endpoint.");
  }
  return data.days;
}

export async function savePlannerDay(apiUrl, key, data) {
  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, data }),
  });
  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json()).error || "";
    } catch (_) {
      // The response was not JSON.
    }
    throw new Error(detail || `Planner save failed (${response.status})`);
  }
}
