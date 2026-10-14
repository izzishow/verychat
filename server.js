require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cookieSession = require("cookie-session");

const db = require("./db");
const auth = require("./auth");

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (VeryCloud, Cloudflare, Nginx) for secure cookies & proto detection
app.set("trust proxy", 1);

const UPLOADS_DIR = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 50MB payload limit for video and file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Secure HTTP-only Cookie Session
app.use(
  cookieSession({
    name: "verychat_session",
    keys: [process.env.SESSION_SECRET || "verychat-secret-session-key-2026-production"],
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  })
);

app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// Authentication Routes (Google OAuth 2.0)
// ==========================================
app.get("/auth/google", auth.handleGoogleLogin);
app.get("/auth/google/callback", auth.handleGoogleCallback);
app.get("/api/auth/me", auth.handleGetMe);
app.get("/api/auth/config", auth.handleGetConfig);
app.all("/auth/logout", auth.handleLogout);

// Test/Developer Login endpoint (supports local testing and automated verification)
app.post("/api/auth/test-login", (req, res) => {
  const { email, name, picture } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const testGoogleId = "test_gid_" + crypto.createHash("md5").update(normalizedEmail).digest("hex").slice(0, 16);

  const { user, isNew } = db.upsertGoogleUser({
    google_id: testGoogleId,
    email: normalizedEmail,
    name: name || normalizedEmail.split("@")[0],
    picture: picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(normalizedEmail)}`,
  });

  req.session.userId = user.id;

  res.json({
    success: true,
    message: isNew ? "Test user registered" : "Existing test user logged in",
    user,
    isNew,
  });
});

// ==========================================
// Real-time SSE Stream & Chat Messaging
// ==========================================
let clients = [];

app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = Date.now();
  clients.push({ id: clientId, res });

  req.on("close", () => {
    clients = clients.filter((c) => c.id !== clientId);
  });
});

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach((c) => {
    try {
      c.res.write(payload);
    } catch (e) {
      // client disconnected
    }
  });
}

// Get message history
app.get("/api/messages", (req, res) => {
  res.json({ success: true, messages: db.getMessages() });
});

// File upload API (Supports Images, Videos, Text, Documents, Archives)
app.post("/api/upload", (req, res) => {
  try {
    const { dataUrl, filename } = req.body;
    if (!dataUrl) {
      return res.status(400).json({ error: "No file data provided" });
    }

    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Invalid file format" });
    }

    const mimeType = matches[1].toLowerCase();
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    let ext = "";
    if (filename && filename.includes(".")) {
      ext = path.extname(filename).slice(1).toLowerCase();
    }
    if (!ext) {
      if (mimeType.includes("mp4")) ext = "mp4";
      else if (mimeType.includes("webm")) ext = "webm";
      else if (mimeType.includes("quicktime")) ext = "mov";
      else if (mimeType.includes("png")) ext = "png";
      else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
      else if (mimeType.includes("gif")) ext = "gif";
      else if (mimeType.includes("webp")) ext = "webp";
      else if (mimeType.includes("pdf")) ext = "pdf";
      else if (mimeType.includes("text/plain")) ext = "txt";
      else if (mimeType.includes("json")) ext = "json";
      else ext = "bin";
    }

    const uniqueName = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, uniqueName);

    fs.writeFileSync(filePath, buffer);

    let fileCategory = "file";
    if (mimeType.startsWith("image/")) {
      fileCategory = "image";
    } else if (mimeType.startsWith("video/") || ["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) {
      fileCategory = "video";
    } else if (mimeType.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) {
      fileCategory = "audio";
    } else if (
      mimeType.startsWith("text/") ||
      ["txt", "md", "json", "log", "csv", "xml", "js", "ts", "py", "html", "css"].includes(ext)
    ) {
      fileCategory = "text";
    } else if (["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext)) {
      fileCategory = "document";
    }

    res.json({
      success: true,
      url: `/uploads/${uniqueName}`,
      name: filename || uniqueName,
      size: buffer.length,
      mimeType,
      fileCategory,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

// Post a new message
app.post("/api/messages", (req, res) => {
  const { user, text, imageUrl, fileUrl, fileName, fileSize, fileCategory } = req.body;
  const hasText = text && text.trim().length > 0;
  const hasFile = (imageUrl && imageUrl.trim().length > 0) || (fileUrl && fileUrl.trim().length > 0);

  if (!hasText && !hasFile) {
    return res.status(400).json({ error: "Message or attachment is required" });
  }

  const effectiveCategory = fileCategory || (imageUrl ? "image" : "file");
  const effectiveUrl = fileUrl?.trim() || imageUrl?.trim() || null;

  // Determine sender identity from authenticated session or guest
  let senderName = user?.trim() || "익명 사용자";
  let senderAvatar = "💬";
  let isGoogleUser = false;
  let senderUserId = null;

  if (req.session && req.session.userId) {
    const authUser = db.getUserById(req.session.userId);
    if (authUser) {
      senderName = authUser.name;
      senderAvatar = authUser.picture || "👤";
      isGoogleUser = true;
      senderUserId = authUser.id;
    }
  }

  const newMessage = {
    id: Date.now(),
    user: senderName,
    userId: senderUserId,
    isGoogleUser,
    text: hasText ? text.trim() : "",
    imageUrl: effectiveCategory === "image" ? effectiveUrl : null,
    fileUrl: effectiveUrl,
    fileName: fileName?.trim() || (effectiveUrl ? path.basename(effectiveUrl) : null),
    fileSize: fileSize || null,
    fileCategory: effectiveCategory,
    time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    avatar: senderAvatar,
  };

  db.addMessage(newMessage);
  broadcast("new_message", newMessage);
  res.status(201).json({ success: true, message: newMessage });
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    googleOAuthConfigured: auth.isGoogleOAuthConfigured(),
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`VeryChat server is running on port ${PORT}`);
    console.log(`Google OAuth Configured: ${auth.isGoogleOAuthConfigured()}`);
  });
}

module.exports = app;