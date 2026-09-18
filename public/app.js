const messagesContainer = document.getElementById("messages-container");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const usernameInput = document.getElementById("username-input");

// Load saved username
const savedUser = localStorage.getItem("verychat_user");
if (savedUser) usernameInput.value = savedUser;

usernameInput.addEventListener("change", () => {
  const val = usernameInput.value.trim() || "사용자1";
  usernameInput.value = val;
  localStorage.setItem("verychat_user", val);
});

// Render a single message
function appendMessage(msg) {
  const isSelf = msg.user === usernameInput.value.trim();
  const div = document.createElement("div");
  div.className = `message-item ${isSelf ? "self" : ""}`;

  div.innerHTML = `
    <div class="avatar">${msg.avatar || "👤"}</div>
    <div class="message-bubble">
      <div class="sender-name">${escapeHtml(msg.user)}</div>
      <div class="message-text">${escapeHtml(msg.text)}</div>
      <div class="message-time">${msg.time}</div>
    </div>
  `;

  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

// Fetch initial messages
async function loadHistory() {
  try {
    const res = await fetch("/api/messages");
    const data = await res.json();
    if (data.success && Array.isArray(data.messages)) {
      messagesContainer.innerHTML = "";
      data.messages.forEach(appendMessage);
    }
  } catch (err) {
    console.error("Failed to load message history:", err);
  }
}

// Connect SSE stream for real-time messages
function connectStream() {
  const stream = new EventSource("/api/stream");

  stream.addEventListener("new_message", (e) => {
    try {
      const msg = JSON.parse(e.data);
      appendMessage(msg);
    } catch (err) {
      console.error("Error parsing message:", err);
    }
  });

  stream.onerror = () => {
    stream.close();
    setTimeout(connectStream, 3000); // Reconnect
  };
}

// Send message
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  const user = usernameInput.value.trim() || "사용자1";
  messageInput.value = "";
  messageInput.focus();

  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, text }),
    });
    if (!res.ok) {
      alert("메시지 전송에 실패했습니다.");
    }
  } catch (err) {
    console.error("Error sending message:", err);
  }
});

// Initialize
loadHistory();
connectStream();
