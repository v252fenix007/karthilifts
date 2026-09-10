import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'kaarthi_lifts.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    goal TEXT NOT NULL,
    plan TEXT NOT NULL,
    experience TEXT,
    message TEXT,
    macro_profile TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    sender TEXT NOT NULL, -- 'visitor' | 'coach'
    sender_name TEXT,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS live_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Seed settings if empty
const getSetting = (key) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
};

const setSetting = (key, value) => {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
};

if (!getSetting('batch_name')) {
  setSetting('batch_name', 'March 2026 Elite Cohort');
  setSetting('total_slots', '15');
  setSetting('slots_remaining', '3');
  setSetting('coach_status', 'Online & Reviewing Applications');
  setSetting('admin_pin', 'kaarthi2026');
  setSetting('direct_phone', '+91 98765 43210');
  setSetting('direct_email', 'kaarthilifts@gmail.com');
}

// Seed sample leads if empty
const leadCount = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
if (leadCount === 0) {
  const seedLeads = [
    {
      ref_code: 'KL-9021',
      name: 'Rahul Sharma',
      phone: '+91 98412 87361',
      email: 'rahul.sharma@gmail.com',
      goal: 'Lean Muscle Bulk',
      plan: 'Elite Transformation — 12 Weeks (₹11,999)',
      experience: 'Intermediate (6 months - 2 years)',
      message: 'Looking to pack on 5-6kg of clean mass without excessive fat gain. Current bench is 75kg, squat 100kg.',
      macro_profile: JSON.stringify({ calories: 2950, protein: 175, carbs: 360, fats: 72 }),
      status: 'new',
      notes: 'High intent lifter. Needs form check on deadlifts.',
      created_at: new Date(Date.now() - 32 * 60 * 1000).toISOString() // 32 mins ago
    },
    {
      ref_code: 'KL-8743',
      name: 'Aditi Nair',
      phone: '+91 99014 55219',
      email: 'aditi.fit@outlook.com',
      goal: 'Fat Loss & Shred',
      plan: 'Momentum — 8 Weeks (₹8,999)',
      experience: 'Beginner (0 - 6 months)',
      message: 'Desk job 9 hours a day, want to cut down 8kg safely with sustainable nutrition.',
      macro_profile: JSON.stringify({ calories: 1750, protein: 125, carbs: 160, fats: 48 }),
      status: 'contacted',
      notes: 'WhatsApp intro sent. Requested diet recall.',
      created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString() // 3 hrs ago
    },
    {
      ref_code: 'KL-7619',
      name: 'Karthik Raja',
      phone: '+91 97890 23145',
      email: 'karthik.raja@yahoo.com',
      goal: 'Strength & Biomechanics',
      plan: 'Elite Transformation — 12 Weeks (₹11,999)',
      experience: 'Advanced (2+ years)',
      message: 'Had past lower back tweak from squats. Need coach with solid anatomy & biomechanics knowledge.',
      macro_profile: JSON.stringify({ calories: 2600, protein: 165, carbs: 280, fats: 65 }),
      status: 'enrolled',
      notes: 'Onboarded! Biomechanics screening booked for Saturday.',
      created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() // 1 day ago
    }
  ];

  const insertLead = db.prepare(`
    INSERT INTO leads (ref_code, name, phone, email, goal, plan, experience, message, macro_profile, status, notes, created_at)
    VALUES (@ref_code, @name, @phone, @email, @goal, @plan, @experience, @message, @macro_profile, @status, @notes, @created_at)
  `);

  const insertMany = db.transaction((leads) => {
    for (const lead of leads) insertLead.run(lead);
  });
  insertMany(seedLeads);
}

// Helper methods for queries
export const dbOps = {
  // Settings
  getSetting,
  setSetting,
  getAllSettings() {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const map = {};
    rows.forEach(r => map[r.key] = r.value);
    return map;
  },

  // Leads
  createLead(data) {
    const ref_code = 'KL-' + Math.floor(1000 + Math.random() * 9000);
    const created_at = new Date().toISOString();
    const info = db.prepare(`
      INSERT INTO leads (ref_code, name, phone, email, goal, plan, experience, message, macro_profile, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', '', ?)
    `).run(
      ref_code,
      data.name,
      data.phone,
      data.email,
      data.goal,
      data.plan,
      data.experience || 'Beginner (0 - 6 months)',
      data.message || '',
      data.macro_profile ? JSON.stringify(data.macro_profile) : null,
      created_at
    );

    return db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid);
  },

  getAllLeads() {
    return db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
  },

  getLeadById(id) {
    return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  },

  getLeadByRef(ref) {
    return db.prepare('SELECT * FROM leads WHERE ref_code = ?').get(ref);
  },

  updateLeadStatus(id, status, notes) {
    if (notes !== undefined) {
      db.prepare('UPDATE leads SET status = ?, notes = ? WHERE id = ?').run(status, notes, id);
    } else {
      db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, id);
    }
    return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  },

  deleteLead(id) {
    return db.prepare('DELETE FROM leads WHERE id = ?').run(id);
  },

  // Chat
  saveChatMessage(sessionId, sender, text, senderName = '') {
    const created_at = new Date().toISOString();
    const info = db.prepare(`
      INSERT INTO chat_messages (session_id, sender, sender_name, text, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, sender, senderName, text, created_at);
    return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
  },

  getChatHistory(sessionId) {
    return db.prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY id ASC').all(sessionId);
  },

  getRecentChatSessions() {
    return db.prepare(`
      SELECT session_id, sender_name, MAX(created_at) as last_activity, COUNT(*) as total_messages,
             (SELECT text FROM chat_messages cm2 WHERE cm2.session_id = cm.session_id ORDER BY id DESC LIMIT 1) as last_message,
             (SELECT sender FROM chat_messages cm2 WHERE cm2.session_id = cm.session_id ORDER BY id DESC LIMIT 1) as last_sender
      FROM chat_messages cm
      GROUP BY session_id
      ORDER BY last_activity DESC
      LIMIT 30
    `).all();
  },

  // Real-time Stats
  getStats() {
    const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
    const newLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'new'").get().count;
    const enrolledLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'enrolled'").get().count;
    const slotsRemaining = parseInt(getSetting('slots_remaining') || '3', 10);
    const totalSlots = parseInt(getSetting('total_slots') || '15', 10);
    const batchName = getSetting('batch_name') || 'March 2026 Cohort';
    const coachStatus = getSetting('coach_status') || 'Online';

    return {
      totalLeads,
      newLeads,
      enrolledLeads,
      slotsRemaining,
      totalSlots,
      batchName,
      coachStatus
    };
  }
};

export default db;
