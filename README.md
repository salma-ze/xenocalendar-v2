# XenoCalendar

An interactive **daily planner printer** — inspired by [digital-typewriter](https://github.com/nasha-wanich/digital-typewriter). Press print, watch your day roll out on a cute receipt, check off tasks with sparkles, and optionally sync from Notion.

Built as a gift for someone who loves organization ✦

## What it does

- **Print my day** — animated receipt printer with typewriter heading
- **Tasks** — click to complete (sparkle burst), add/remove inline
- **Events** — schedule with times and optional links
- **Local save** — everything persists in the browser automatically
- **Backup** — export/import JSON from the toolbar
- **Notion sync** (optional) — pull today’s tasks & events from a Notion database
- **Auto-refresh** — re-sync every N minutes when connected

## Widget mode (keep it on her screen)

XenoCalendar opens as a **floating desktop widget**:

- **Drag** the top bar to move it anywhere
- **◢** snaps it to a screen corner (click to cycle corners)
- **−** minimizes to a small ♡ pill — click to bring it back
- **Resize** by dragging the bottom-right corner of the widget

### Install as a desktop app (recommended)

1. Open in **Chrome** or **Edge**
2. Click the install icon in the address bar (or menu → *Install XenoCalendar*)
3. Pin the small window to a corner — it stays on her desktop like a widget

On Windows, she can also right-click the taskbar app → *Always on top* if using a tool like PowerToys, or keep the installed PWA window small in a corner.

```bash
npm run dev
```

Open http://localhost:3000 — works immediately with sample data.

## Personalize for her

Edit `js/config.js`:

```js
greeting: 'Hi Love, Ready to start your day',
headingWords: ['Daily', 'Tasks', 'Plan ✦'],
```

Change colors in `theme` if you want a different vibe.

## Notion sync (automation)

The original project uses Notion + an AI agent to populate data daily. XenoCalendar supports the Notion API directly.

### 1. Create a Notion database

| Property | Type | Notes |
|----------|------|-------|
| Name | Title | Task or event name |
| Type | Select | `Task` or `Event` |
| Category | Select | `personal` or `work` |
| Date | Date | Filter — only today’s rows show |
| Time | Text | Events only, e.g. `10:00–11:00` |
| Link | URL | Optional meeting link |
| Done | Checkbox | Tasks only |

Share the database with your [Notion integration](https://www.notion.so/my-integrations).

### 2. Deploy the API

Deploy to Vercel (drop this folder in) and set env vars from `.env.example`:

- `NOTION_TOKEN` — integration secret
- `NOTION_DATABASE_ID` — from the database URL

The endpoint lives at `/api/notion`.

### 3. Enable sync in the app

In `js/config.js`:

```js
syncMode: 'notion',
notionApiUrl: 'https://your-app.vercel.app/api/notion',
```

### Daily automation ideas

- **Notion recurring templates** — duplicate a “Daily planner” template each morning
- **Zapier / Make** — on schedule, create rows in the database from Google Calendar
- **Cursor agent / cron** — script that calls Notion API to seed the day (like the original tutorial)

## Google Calendar (future)

The reference project also syncs calendars. You can extend `api/notion.js` or add `api/calendar.js` using Google Calendar API + the same `{ events, tasks }` JSON shape.

## Project structure

```
index.html      — page shell
styles.css      — printer + receipt styling
js/
  config.js     — personalization & sync settings
  storage.js    — localStorage persistence
  sync.js       — fetch from Notion API
  app.js        — UI, animations, interactions
api/
  notion.js     — serverless Notion handler (Vercel)
```

## License

MIT — customize freely for your person ♡
