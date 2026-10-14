const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, "users.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

// Helper: atomic write to JSON file
function atomicWriteJson(filePath, data) {
  const tmpPath = `${filePath}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

// In-memory caches for maximum performance
let usersCache = [];
let messagesCache = [];

// Initialize users from disk
try {
  if (fs.existsSync(USERS_FILE)) {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    usersCache = JSON.parse(raw);
  } else {
    usersCache = [];
    atomicWriteJson(USERS_FILE, usersCache);
  }
} catch (err) {
  console.error("Failed to load users from file, initializing empty:", err);
  usersCache = [];
}

// Initialize messages from disk
try {
  if (fs.existsSync(MESSAGES_FILE)) {
    const raw = fs.readFileSync(MESSAGES_FILE, "utf8");
    messagesCache = JSON.parse(raw);
  } else {
    messagesCache = [
      {
        id: 1,
        user: "VeryCloud Bot",
        text: "🎉 VeryChat에 오신 것을 환영합니다! Google 계정으로 로그인하여 자유롭게 대화와 파일을 공유해 보세요.",
        imageUrl: null,
        fileUrl: null,
        fileName: null,
        fileSize: null,
        fileCategory: null,
        time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        avatar: "🚀",
      },
    ];
    atomicWriteJson(MESSAGES_FILE, messagesCache);
  }
} catch (err) {
  console.error("Failed to load messages from file, initializing default:", err);
  messagesCache = [];
}

// Database API
const db = {
  // Users
  getUserById(id) {
    if (!id) return null;
    return usersCache.find((u) => u.id === id) || null;
  },

  getUserByEmail(email) {
    if (!email) return null;
    const lower = email.trim().toLowerCase();
    return usersCache.find((u) => u.email.toLowerCase() === lower) || null;
  },

  getUserByGoogleId(googleId) {
    if (!googleId) return null;
    return usersCache.find((u) => u.google_id === googleId) || null;
  },

  getAllUsers() {
    return [...usersCache];
  },

  upsertGoogleUser({ google_id, email, name, picture }) {
    if (!email) throw new Error("Email is required for user registration");

    const normalizedEmail = email.trim().toLowerCase();
    let existingUser = usersCache.find(
      (u) => (u.google_id && u.google_id === google_id) || u.email.toLowerCase() === normalizedEmail
    );

    const now = new Date().toISOString();

    if (existingUser) {
      // Existing user: update info without duplicating
      existingUser.google_id = google_id || existingUser.google_id;
      if (name) existingUser.name = name;
      if (picture) existingUser.picture = picture;
      existingUser.last_login_at = now;
      atomicWriteJson(USERS_FILE, usersCache);
      return { user: existingUser, isNew: false };
    }

    // New user registration
    const newUser = {
      id: "usr_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16),
      google_id: google_id || null,
      email: normalizedEmail,
      name: name || normalizedEmail.split("@")[0],
      picture: picture || null,
      created_at: now,
      last_login_at: now,
    };

    usersCache.push(newUser);
    atomicWriteJson(USERS_FILE, usersCache);
    return { user: newUser, isNew: true };
  },

  // Messages
  getMessages() {
    return [...messagesCache];
  },

  addMessage(msg) {
    messagesCache.push(msg);
    if (messagesCache.length > 200) {
      messagesCache.shift();
    }
    atomicWriteJson(MESSAGES_FILE, messagesCache);
    return msg;
  },
};

module.exports = db;
