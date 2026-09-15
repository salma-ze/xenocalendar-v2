// Serverless function (deploy on Vercel) that fetches today's tasks and
// events from a Notion database and hands them back to the app in the
// {events, tasks} shape it already understands.
//
// Your NOTION_TOKEN and NOTION_DATABASE_ID never reach the browser —
// they only live here, as environment variables on the server.

const NOTION_VERSION = "2022-06-28"; // pinned so this keeps working even
// after Notion's 2025-09-03 "data sources" split — no need to touch this.

function todayISODate() {
  // YYYY-MM-DD in the server's local date.
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function plainText(richTextArray) {
  if (!Array.isArray(richTextArray)) return "";
  return richTextArray.map((t) => t.plain_text || "").join("");
}

function pageToItem(page) {
  const props = page.properties || {};
  const name = plainText(props.Name?.title);
  const type = props.Type?.select?.name || "Task";
  const category = (props.Category?.select?.name || "art").toLowerCase();
  const time = plainText(props.Time?.rich_text);
  const link = props.Link?.url || page.url || "";
  const done = !!props.Done?.checkbox;
  return { name, type, category, time, link, done, id: page.id };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!token || !databaseId) {
    res.status(500).json({
      error:
        "Server is missing NOTION_TOKEN or NOTION_DATABASE_ID environment variables.",
    });
    return;
  }

  try {
    const response = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: {
            property: "Date",
            date: { equals: todayISODate() },
          },
          page_size: 100,
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({
        error: `Notion API error (${response.status})`,
        detail: errText,
      });
      return;
    }

    const data = await response.json();
    const items = (data.results || []).map(pageToItem);

    const events = items
      .filter((i) => i.type === "Event")
      .map((i) => ({
        id: `notion-${i.id}`,
        label: i.name,
        category: i.category,
        time: i.time,
        link: i.link,
        source: "notion",
      }));

    const tasks = items
      .filter((i) => i.type !== "Event")
      .map((i) => ({
        id: `notion-${i.id}`,
        label: i.name,
        category: i.category,
        status: i.done ? "done" : "pending",
        source: "notion",
      }));

    res.status(200).json({ events, tasks });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to reach Notion.", detail: String(err) });
  }
};
