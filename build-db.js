// build-db.js - run once to seed the demo DB
const Database = require('better-sqlite3');
const db = new Database('db/faq.db');

db.exec(`
CREATE TABLE IF NOT EXISTS faqs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT UNIQUE,
  answer   TEXT
);
`);

const rows = [
  ["How many vacation days do I have left?", "You have 20 days left. Would you like to schedule some PTO?"],
  ["What is the Wi-Fi password?", "The guest Wi-Fi password is Guest2025!"],
  ["How do I reset my password?", "Open a ticket in ServiceNow or type 'IT Help' for a quick-reply menu."]
];

const stmt = db.prepare("INSERT OR IGNORE INTO faqs (question, answer) VALUES (?, ?)");
rows.forEach(r => stmt.run(r));

console.log("Seeded faqs table with", rows.length, "rows");
db.close();