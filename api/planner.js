const NOTION_VERSION = "2022-06-28";
const DATA_PROPERTY = "Data";

function notionHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function plainText(richText) {
  return Array.isArray(richText)
    ? richText.map((part) => part.plain_text || "").join("")
    : "";
}

function chunks(text, size = 1900) {
  const result = [];
  for (let i = 0; i < text.length; i += size) result.push(text.slice(i, i + size));
  return result;
}

function pageToDay(page) {
  const props = page.properties || {};
  const key = props.Date?.date?.start;
  const raw = plainText(props[DATA_PROPERTY]?.rich_text);
  if (!key || !raw) return null;
  try {
    return { key: key.slice(0, 10), data: JSON.parse(raw), id: page.id };
  } catch (_) {
    return null;
  }
}

async function notionRequest(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Notion API error (${response.status}): ${detail}`);
  }
  return response.json();
}

async function findPages(token, databaseId) {
  const pages = [];
  let cursor;
  do {
    const data = await notionRequest(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: notionHeaders(token),
        body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
      },
    );
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return pages;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!token || !databaseId) {
    return res.status(500).json({ error: "Missing Notion environment variables." });
  }

  try {
    const pages = await findPages(token, databaseId);
    const saved = pages.map((page) => pageToDay(page)).filter(Boolean);

    if (req.method === "GET") {
      return res.status(200).json({
        days: Object.fromEntries(saved.map(({ key, data }) => [key, data])),
      });
    }

    if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed." });
    const { key, data } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !data) {
      return res.status(400).json({ error: "A valid day key and data are required." });
    }

    const existing = saved.find((day) => day.key === key);
    const properties = {
      Name: { title: [{ text: { content: `XenoCalendar ${key}` } }] },
      Date: { date: { start: key } },
      [DATA_PROPERTY]: {
        rich_text: chunks(JSON.stringify(data)).map((content) => ({
          type: "text",
          text: { content },
        })),
      },
    };

    const url = existing
      ? `https://api.notion.com/v1/pages/${existing.id}`
      : "https://api.notion.com/v1/pages";
    await notionRequest(url, {
      method: existing ? "PATCH" : "POST",
      headers: notionHeaders(token),
      body: JSON.stringify(
        existing ? { properties } : { parent: { database_id: databaseId }, properties },
      ),
    });
    return res.status(200).json({ ok: true, key });
  } catch (error) {
    return res.status(500).json({ error: "Planner sync failed.", detail: String(error) });
  }
};