const messagesContainer = document.getElementById("messages-container");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const usernameInput = document.getElementById("username-input");
const attachBtn = document.getElementById("attach-btn");
const imageFileInput = document.getElementById("image-file-input");
const imagePreviewBar = document.getElementById("image-preview-bar");
const previewImg = document.getElementById("preview-img");
const previewFilename = document.getElementById("preview-filename");
const removePreviewBtn = document.getElementById("remove-preview-btn");
const dropZone = document.getElementById("drop-zone");
const dropOverlay = document.getElementById("drop-overlay");
const lightboxModal = document.getElementById("lightbox-modal");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxClose = document.getElementById("lightbox-close");

// Theme Modal Elements
const themeBtn = document.getElementById("theme-btn");
const themeModal = document.getElementById("theme-modal");
const themeCloseBtn = document.getElementById("theme-close-btn");
const themeOptions = document.querySelectorAll(".theme-option");
const customBgInput = document.getElementById("custom-bg-input");
const uploadBgBtn = document.getElementById("upload-bg-btn");
const resetBgBtn = document.getElementById("reset-bg-btn");

let currentImageDataUrl = null;
let currentImageName = null;

// Username persistence
const savedUser = localStorage.getItem("verychat_user");
if (savedUser) usernameInput.value = savedUser;

usernameInput.addEventListener("change", () => {
  const val = usernameInput.value.trim() || "사용자1";
  usernameInput.value = val;
  localStorage.setItem("verychat_user", val);
});

// ---------- Theme & Background Wallpaper Logic ----------
function applySavedTheme() {
  try {
    const raw = localStorage.getItem("verychat_bg");
    if (!raw) return;
    const bgConfig = JSON.parse(raw);
    if (bgConfig.type === "preset") {
      setPresetTheme(bgConfig.value, false);
    } else if (bgConfig.type === "custom" && bgConfig.value) {
      setCustomBackground(bgConfig.value, false);
    }
  } catch (e) {
    console.error("Error loading saved theme:", e);
  }
}

function setPresetTheme(themeName, save = true) {
  document.body.style.backgroundImage = "";
  document.body.className = `theme-${themeName}`;
  themeOptions.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === themeName);
  });
  if (save) {
    localStorage.setItem("verychat_bg", JSON.stringify({ type: "preset", value: themeName }));
  }
}

function setCustomBackground(dataUrl, save = true) {
  document.body.className = "";
  document.body.style.backgroundImage = `url('${dataUrl}')`;
  themeOptions.forEach((btn) => btn.classList.remove("active"));
  if (save) {
    localStorage.setItem("verychat_bg", JSON.stringify({ type: "custom", value: dataUrl }));
  }
}

themeBtn.addEventListener("click", () => {
  themeModal.style.display = "flex";
});

themeCloseBtn.addEventListener("click", () => {
  themeModal.style.display = "none";
});

themeModal.addEventListener("click", (e) => {
  if (e.target === themeModal) {
    themeModal.style.display = "none";
  }
});

themeOptions.forEach((btn) => {
  btn.addEventListener("click", () => {
    const theme = btn.dataset.theme;
    setPresetTheme(theme);
    themeModal.style.display = "none";
  });
});

uploadBgBtn.addEventListener("click", () => {
  customBgInput.click();
});

customBgInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("이미지 파일만 설정할 수 있습니다.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    setCustomBackground(ev.target.result);
    themeModal.style.display = "none";
  };
  reader.readAsDataURL(file);
});

resetBgBtn.addEventListener("click", () => {
  localStorage.removeItem("verychat_bg");
  setPresetTheme("default", false);
  themeModal.style.display = "none";
});

// ---------- Image Attachment Logic ----------
attachBtn.addEventListener("click", () => {
  imageFileInput.click();
});

imageFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) handleImageFile(file);
});

function handleImageFile(file) {
  if (!file.type.startsWith("image/")) {
    alert("이미지 파일만 업로드할 수 있습니다.");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert("이미지 크기는 10MB 이하만 가능합니다.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    currentImageDataUrl = e.target.result;
    currentImageName = file.name;
    previewImg.src = currentImageDataUrl;
    previewFilename.textContent = file.name;
    imagePreviewBar.style.display = "flex";
    messageInput.focus();
  };
  reader.readAsDataURL(file);
}

removePreviewBtn.addEventListener("click", () => {
  clearImagePreview();
});

function clearImagePreview() {
  currentImageDataUrl = null;
  currentImageName = null;
  imageFileInput.value = "";
  previewImg.src = "";
  previewFilename.textContent = "";
  imagePreviewBar.style.display = "none";
}

// Drag & Drop
let dragCounter = 0;
["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dragCounter++;
    dropOverlay.classList.add("active");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropOverlay.classList.remove("active");
    }
  });
});

dropZone.addEventListener("drop", (e) => {
  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].type.startsWith("image/")) {
    handleImageFile(files[0]);
  }
});

// Paste screenshot from clipboard
document.addEventListener("paste", (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      handleImageFile(file);
      break;
    }
  }
});

// Render message
function appendMessage(msg) {
  const isSelf = msg.user === usernameInput.value.trim();
  const div = document.createElement("div");
  div.className = `message-item ${isSelf ? "self" : ""}`;

  let imageHtml = "";
  if (msg.imageUrl) {
    imageHtml = `
      <div class="message-image-wrap" onclick="openLightbox('${escapeHtml(msg.imageUrl)}')">
        <img src="${escapeHtml(msg.imageUrl)}" alt="첨부 이미지" class="message-image" loading="lazy" />
      </div>
    `;
  }

  let textHtml = "";
  if (msg.text) {
    textHtml = `<div class="message-text">${escapeHtml(msg.text)}</div>`;
  }

  div.innerHTML = `
    <div class="avatar">${msg.avatar || "👤"}</div>
    <div class="message-bubble">
      <div class="sender-name">${escapeHtml(msg.user)}</div>
      ${imageHtml}
      ${textHtml}
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

// Lightbox
window.openLightbox = function(url) {
  lightboxImg.src = url;
  lightboxModal.style.display = "flex";
};

lightboxClose.addEventListener("click", () => {
  lightboxModal.style.display = "none";
});

lightboxModal.addEventListener("click", (e) => {
  if (e.target === lightboxModal) {
    lightboxModal.style.display = "none";
  }
});

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

// SSE live stream
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
    setTimeout(connectStream, 3000);
  };
}

// Submit message & upload image
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text && !currentImageDataUrl) return;

  const user = usernameInput.value.trim() || "사용자1";
  let uploadedImageUrl = null;

  const sendBtn = document.getElementById("send-btn");
  sendBtn.disabled = true;

  try {
    if (currentImageDataUrl) {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl: currentImageDataUrl,
          filename: currentImageName,
        }),
      });
      const uploadData = await uploadRes.json();
      if (uploadData.success) {
        uploadedImageUrl = uploadData.url;
      } else {
        alert("이미지 업로드에 실패했습니다.");
        sendBtn.disabled = false;
        return;
      }
    }

    const msgRes = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user,
        text,
        imageUrl: uploadedImageUrl,
      }),
    });

    if (msgRes.ok) {
      messageInput.value = "";
      clearImagePreview();
      messageInput.focus();
    } else {
      alert("메시지 전송에 실패했습니다.");
    }
  } catch (err) {
    console.error("Error sending:", err);
    alert("오류가 발생했습니다.");
  } finally {
    sendBtn.disabled = false;
  }
});

// Initialize
applySavedTheme();
loadHistory();
connectStream();