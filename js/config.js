// Personalize XenoCalendar here — this is the only file you should
// need to touch to change what she sees.

export const config = {
  name: "Maroua",
  username: "xenorphia",

  // Shown under the title bar.
  greeting: "Rise, Maroua — the night is yours.",

  // The big animated heading types out `headingPrefix + word`,
  // then deletes just the word and cycles to the next one.
  headingPrefix: "Maroua's Daily ",
  headingWords: ["Rituals", "Canvas", "Gains", "Grimoire"],

  // Printer screen text while idle / while "printing".
  printerIdleFrames: ["♡ print me ♡", "✦ print me ✦"],
  printerActiveFrames: ["♡ printing ♡", "✦ printing ✦"],

  // Category system — replaces generic "work / personal" with
  // things that actually make up her days.
  categories: {
    art: { label: "Art" },
    training: { label: "Gym" },
    school: { label: "School" },
    job: { label: "Job" },
  },

  // Daily protein target for the progress bar in Gym & Food.
  proteinGoalGrams: 150,
  caloriesGoal: 3000,

  // Sample data shown the very first time the widget opens
  // (before anything is saved to this browser).
  seedData: {
    events: [
      {
        label: "Studio session",
        category: "art",
        time: "14:00–16:00",
        link: "",
      },
      { label: "Leg day", category: "training", time: "18:00–19:30", link: "" },
    ],
    tasks: [
      {
        label: "Sketch new character concept",
        category: "art",
        status: "pending",
      },
      {
        label: "Render lighting pass on latest piece",
        category: "art",
        status: "pending",
      },
      { label: "Protein + snack run", category: "training", status: "pending" },
    ],
    notes: "",
    proteinGrams: 0,
    calories: 0,
  },

  // NOTION SETUP - follow these steps to connect the sync button:
  // 1. In Notion, create a database with these properties:
  //    Name (Title), Type (Select: Task or Event), Category (Select),
  //    Date (Date), Time (Text), Link (URL), and Done (Checkbox).
  // 2. Create an integration at notion.so/my-integrations and copy its
  //    secret. Share your database with that integration from Notion's
  //    database Share menu.
  // 3. Deploy this project to Vercel. Keep the existing api/notion.js file.
  // 4. In Vercel Project Settings > Environment Variables, add:
  //    NOTION_TOKEN = your integration secret
  //    NOTION_DATABASE_ID = the ID from your Notion database URL
  // 5. Redeploy after adding the variables. Never paste either secret here
  //    or into browser code.
  // 6. If the app and API use the same Vercel domain, keep notionApiUrl
  //    as "/api/notion". Otherwise, use your deployed API URL.
  // 7. Change syncMode to "notion-cloud" after adding the Data property
  //    described in README. This enables shared days and history.
  // 8. If sync fails, check the database was shared with the integration,
  //    the property names match step 1, and both Vercel variables are set.
  syncMode: "local", // "local" | "notion" | "notion-cloud"
  notionApiUrl: "/api/notion",
  plannerApiUrl: "/api/planner",
};
