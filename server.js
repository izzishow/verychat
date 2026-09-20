const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 15MB limit for image uploads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(express.static(path.join(__dirname, "public")));

// In-memory message store
const messages = [
  {
    id: 1,
    user: "VeryCloud Bot",
    text: "🎉 VeryChat에 오신 것을 환영합니다! 사진과 이미지를 첨부하여 대화해 보세요.",
    imageUrl: null,
    time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    avatar: "🚀",
  },
];

// SSE clients
let clients = [];

// SSE endpoint for real-time streaming
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
  clients.forEach((c) => c.res.write(payload));
}

// Get message history
app.get("/api/messages", (req, res) => {
  res.json({ success: true, messages });
});

// Image upload API (Data URL / Base64)
app.post("/api/upload", (req, res) => {
  try {
    const { dataUrl, filename } = req.body;
    if (!dataUrl) {
      return res.status(400).json({ error: "No image data provided" });
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Invalid image format" });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    // Determine extension
    let ext = "png";
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) ext = "jpg";
    else if (mimeType.includes("gif")) ext = "gif";
    else if (mimeType.includes("webp")) ext = "webp";
    else if (mimeType.includes("svg")) ext = "svg";

    const uniqueName = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, uniqueName);

    fs.writeFileSync(filePath, buffer);

    res.json({
      success: true,
      url: `/uploads/${uniqueName}`,
      name: filename || uniqueName,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// Post a new message
app.post("/api/messages", (req, res) => {
  const { user, text, imageUrl } = req.body;
  const hasText = text && text.trim().length > 0;
  const hasImage = imageUrl && imageUrl.trim().length > 0;

  if (!hasText && !hasImage) {
    return res.status(400).json({ error: "Message or image is required" });
  }

  const newMessage = {
    id: Date.now(),
    user: user?.trim() || "Anonymous",
    text: hasText ? text.trim() : "",
    imageUrl: hasImage ? imageUrl.trim() : null,
    time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    avatar: "💬",
  };

  messages.push(newMessage);
  if (messages.length > 100) messages.shift();

  broadcast("new_message", newMessage);
  res.status(201).json({ success: true, message: newMessage });
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`VeryChat server is running on port ${PORT}`);
});