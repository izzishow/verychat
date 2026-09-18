const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// In-memory message store
const messages = [
  {
    id: 1,
    user: "VeryCloud Bot",
    text: "🎉 VeryChat에 오신 것을 환영합니다! VeryCloud에 성공적으로 배포되었습니다.",
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

// Post a new message
app.post("/api/messages", (req, res) => {
  const { user, text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Message cannot be empty" });
  }

  const newMessage = {
    id: Date.now(),
    user: user?.trim() || "Anonymous",
    text: text.trim(),
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
