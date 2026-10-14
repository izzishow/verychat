const messagesContainer = document.getElementById("messages-container");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const usernameInput = document.getElementById("username-input");
const attachBtn = document.getElementById("attach-btn");
const fileInput = document.getElementById("file-input");
const filePreviewBar = document.getElementById("file-preview-bar");
const previewImg = document.getElementById("preview-img");
const previewVideo = document.getElementById("preview-video");
const previewFileIcon = document.getElementById("preview-file-icon");
const previewFilename = document.getElementById("preview-filename");
const previewFilesize = document.getElementById("preview-filesize");
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
const dropBackBtn = document.getElementById("drop-back-btn");
const headerBackBtn = document.getElementById("header-back-btn");

// Google Auth Elements
const googleLoginBtn = document.getElementById("google-login-btn");
const userProfileBar = document.getElementById("user-profile-bar");
const userAvatarImg = document.getElementById("user-avatar-img");
const userNameDisplay = document.getElementById("user-name-display");
const logoutBtn = document.getElementById("logout-btn");
const oauthModal = document.getElementById("oauth-modal");
const oauthCloseBtn = document.getElementById("oauth-close-btn");
const redirectUriDisplay = document.getElementById("redirect-uri-display");
const redirectUriLocal = document.getElementById("redirect-uri-local");
const copyUriBtn = document.getElementById("copy-uri-btn");
const copyUriLocalBtn = document.getElementById("copy-uri-local-btn");
const testLoginBtn1 = document.getElementById("test-login-btn-1");
const testLoginBtn2 = document.getElementById("test-login-btn-2");

let currentUser = null;
let isOAuthConfigured = false;

let currentFileDataUrl = null;
let currentFileName = null;
let currentFileSize = null;
let currentFileType = null;

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

// ---------- File / Video / Image Attachment Logic ----------
attachBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileName, category) {
  if (!fileName) return "📎";
  const ext = fileName.split(".").pop().toLowerCase();
  if (["txt", "md", "log", "json", "csv", "xml", "js", "ts", "py", "html", "css"].includes(ext)) return "📝";
  if (["pdf"].includes(ext)) return "📕";
  if (["doc", "docx"].includes(ext)) return "📄";
  if (["xls", "xlsx"].includes(ext)) return "📊";
  if (["ppt", "pptx"].includes(ext)) return "📑";
  if (["zip", "tar", "gz", "rar", "7z"].includes(ext)) return "📦";
  if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) return "🎵";
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return "🎬";
  if (category === "video") return "🎬";
  if (category === "text") return "📝";
  return "📎";
}

function handleFile(file) {
  // 50MB size limit
  if (file.size > 50 * 1024 * 1024) {
    alert("파일 크기는 50MB 이하만 첨부할 수 있습니다.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    currentFileDataUrl = e.target.result;
    currentFileName = file.name;
    currentFileSize = file.size;

    const mime = (file.type || "").toLowerCase();
    const ext = file.name.split(".").pop().toLowerCase();

    // Determine category
    let category = "file";
    if (mime.startsWith("image/")) category = "image";
    else if (mime.startsWith("video/") || ["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) category = "video";
    else if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a"].includes(ext)) category = "audio";
    else if (mime.startsWith("text/") || ["txt", "md", "log", "json", "csv"].includes(ext)) category = "text";
    else if (["pdf", "doc", "docx"].includes(ext)) category = "document";

    currentFileType = category;

    // Reset preview elements
    previewImg.style.display = "none";
    previewVideo.style.display = "none";
    previewFileIcon.style.display = "none";

    if (category === "image") {
      previewImg.src = currentFileDataUrl;
      previewImg.style.display = "block";
    } else if (category === "video") {
      previewVideo.src = currentFileDataUrl;
      previewVideo.style.display = "block";
    } else {
      previewFileIcon.textContent = getFileIcon(file.name, category);
      previewFileIcon.style.display = "block";
    }

    previewFilename.textContent = file.name;
    previewFilesize.textContent = formatBytes(file.size);
    filePreviewBar.style.display = "flex";
    if (headerBackBtn) {
      headerBackBtn.style.display = "inline-flex";
    }
    if (!history.state || history.state.screen !== "file_attached") {
      history.pushState({ screen: "file_attached" }, "");
    }
    messageInput.focus();
  };
  reader.readAsDataURL(file);
}

function clearFilePreview() {
  currentFileDataUrl = null;
  currentFileName = null;
  currentFileSize = null;
  currentFileType = null;
  fileInput.value = "";
  previewImg.src = "";
  previewVideo.src = "";
  previewImg.style.display = "none";
  previewVideo.style.display = "none";
  previewFileIcon.style.display = "none";
  previewFilename.textContent = "";
  previewFilesize.textContent = "";
  filePreviewBar.style.display = "none";
  if (headerBackBtn) {
    headerBackBtn.style.display = "none";
  }
}

function cancelAttachmentAndReturnToChat(fromPopState = false) {
  clearFilePreview();
  if (dropOverlay) {
    dismissDropOverlay();
  }
  if (!fromPopState && history.state && history.state.screen === "file_attached") {
    history.back();
  }
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  messageInput.focus();
}

if (headerBackBtn) {
  headerBackBtn.addEventListener("click", () => {
    cancelAttachmentAndReturnToChat();
  });
}

removePreviewBtn.addEventListener("click", () => {
  cancelAttachmentAndReturnToChat();
});

window.addEventListener("popstate", () => {
  if (currentFileDataUrl || (filePreviewBar && filePreviewBar.style.display !== "none")) {
    cancelAttachmentAndReturnToChat(true);
  }
});

// Prevent browser default file open behavior when dragging
window.addEventListener("dragover", (e) => e.preventDefault(), false);
window.addEventListener("drop", (e) => e.preventDefault(), false);

// Drag & Drop
let dragCounter = 0;

function dismissDropOverlay() {
  dragCounter = 0;
  if (dropOverlay) {
    dropOverlay.classList.remove("active");
  }
}

if (dropBackBtn) {
  dropBackBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissDropOverlay();
  });
}

if (dropOverlay) {
  dropOverlay.addEventListener("click", (e) => {
    if (e.target === dropOverlay) {
      dismissDropOverlay();
    }
  });
}

// ESC key to dismiss overlay or cancel preview
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (dropOverlay && dropOverlay.classList.contains("active")) {
      dismissDropOverlay();
    } else if (currentFileDataUrl || (filePreviewBar && filePreviewBar.style.display !== "none")) {
      cancelAttachmentAndReturnToChat();
    }
  }
});

dropZone.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  dropOverlay.classList.add("active");
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "copy";
  }
});

dropZone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dismissDropOverlay();
  }
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dismissDropOverlay();

  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    handleFile(files[0]);
  }
});

// Paste from clipboard
document.addEventListener("paste", (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
  if (!items) return;
  for (let item of items) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) {
        handleFile(file);
        break;
      }
    }
  }
});

// Render message
function appendMessage(msg) {
  const isSelf = msg.user === usernameInput.value.trim();
  const div = document.createElement("div");
  div.className = `message-item ${isSelf ? "self" : ""}`;

  let attachmentHtml = "";

  // 1. Image
  if (msg.fileCategory === "image" || (msg.imageUrl && !msg.fileCategory)) {
    const url = msg.imageUrl || msg.fileUrl;
    attachmentHtml = `
      <div class="message-image-wrap" onclick="openLightbox('${escapeHtml(url)}')">
        <img src="${escapeHtml(url)}" alt="첨부 이미지" class="message-image" loading="lazy" />
      </div>
    `;
  }
  // 2. Video
  else if (msg.fileCategory === "video" && msg.fileUrl) {
    attachmentHtml = `
      <div class="message-video-wrap">
        <video src="${escapeHtml(msg.fileUrl)}" class="message-video" controls playsinline preload="metadata"></video>
      </div>
    `;
  }
  // 3. Document, Text file, Archive, or other files
  else if (msg.fileUrl) {
    const icon = getFileIcon(msg.fileName, msg.fileCategory);
    const sizeStr = formatBytes(msg.fileSize);
    attachmentHtml = `
      <a href="${escapeHtml(msg.fileUrl)}" download="${escapeHtml(msg.fileName || 'file')}" class="message-file-card" target="_blank" rel="noopener">
        <div class="file-card-icon">${icon}</div>
        <div class="file-card-details">
          <div class="file-card-name" title="${escapeHtml(msg.fileName || '첨부파일')}">${escapeHtml(msg.fileName || '첨부파일')}</div>
          ${sizeStr ? `<div class="file-card-size">${sizeStr}</div>` : ""}
        </div>
        <div class="file-card-action" title="다운로드">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </div>
      </a>
    `;
  }

  let textHtml = "";
  if (msg.text) {
    textHtml = `<div class="message-text">${escapeHtml(msg.text)}</div>`;
  }

  const isGoogle = Boolean(msg.isGoogleUser || (msg.avatar && msg.avatar.startsWith("http")));
  let avatarHtml = `<div class="avatar">${escapeHtml(msg.avatar || "👤")}</div>`;
  if (msg.avatar && msg.avatar.startsWith("http")) {
    avatarHtml = `<img src="${escapeHtml(msg.avatar)}" class="message-user-avatar" alt="${escapeHtml(msg.user)}" />`;
  }

  const verifiedBadge = isGoogle ? `<span class="verified-dot" title="Google 인증 계정">✓</span>` : "";

  div.innerHTML = `
    ${avatarHtml}
    <div class="message-bubble">
      <div class="sender-name">${escapeHtml(msg.user)}${verifiedBadge}</div>
      ${attachmentHtml}
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

// Submit message & upload file
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text && !currentFileDataUrl) return;

  const user = currentUser ? currentUser.name : (usernameInput.value.trim() || "사용자1");
  let uploadedFileUrl = null;
  let uploadedFileName = currentFileName;
  let uploadedFileSize = currentFileSize;
  let uploadedFileCategory = currentFileType;

  const sendBtn = document.getElementById("send-btn");
  sendBtn.disabled = true;

  try {
    if (currentFileDataUrl) {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl: currentFileDataUrl,
          filename: currentFileName,
          size: currentFileSize,
        }),
      });
      const uploadData = await uploadRes.json();
      if (uploadData.success) {
        uploadedFileUrl = uploadData.url;
        uploadedFileName = uploadData.name || currentFileName;
        uploadedFileSize = uploadData.size || currentFileSize;
        uploadedFileCategory = uploadData.fileCategory || currentFileType;
      } else {
        alert("파일 업로드에 실패했습니다.");
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
        fileUrl: uploadedFileUrl,
        fileName: uploadedFileName,
        fileSize: uploadedFileSize,
        fileCategory: uploadedFileCategory,
        imageUrl: uploadedFileCategory === "image" ? uploadedFileUrl : null,
      }),
    });

    if (msgRes.ok) {
      messageInput.value = "";
      if (history.state && history.state.screen === "file_attached") {
        history.replaceState(null, "");
      }
      clearFilePreview();
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

// ==========================================
// Google Authentication & User Session Logic
// ==========================================
async function checkAuthStatus() {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    isOAuthConfigured = Boolean(data.configured);

    if (data.authenticated && data.user) {
      currentUser = data.user;
      if (googleLoginBtn) googleLoginBtn.style.display = "none";
      if (usernameInput) usernameInput.style.display = "none";
      if (userProfileBar) userProfileBar.style.display = "inline-flex";
      if (userNameDisplay) {
        userNameDisplay.textContent = currentUser.name;
        userNameDisplay.title = `${currentUser.email} (${new Date(currentUser.created_at).toLocaleDateString()} 가입)`;
      }
      if (userAvatarImg) {
        userAvatarImg.src =
          currentUser.picture ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.email)}`;
      }
    } else {
      currentUser = null;
      if (googleLoginBtn) googleLoginBtn.style.display = "inline-flex";
      if (usernameInput) usernameInput.style.display = "inline-block";
      if (userProfileBar) userProfileBar.style.display = "none";
    }

    // Update redirect URI display if modal elements exist
    const configRes = await fetch("/api/auth/config");
    const configData = await configRes.json();
    if (configData && configData.redirectUri && redirectUriDisplay) {
      redirectUriDisplay.value = configData.redirectUri;
    }
  } catch (err) {
    console.error("Failed to check auth status:", err);
  }
}

// Google Login Button Click
if (googleLoginBtn) {
  googleLoginBtn.addEventListener("click", (e) => {
    if (!isOAuthConfigured) {
      e.preventDefault();
      if (oauthModal) oauthModal.style.display = "flex";
    }
  });
}

// Logout Button Click
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", { headers: { Accept: "application/json" } });
      currentUser = null;
      await checkAuthStatus();
      alert("로그아웃되었습니다.");
    } catch (err) {
      window.location.href = "/auth/logout";
    }
  });
}

// OAuth Modal Close
if (oauthCloseBtn && oauthModal) {
  oauthCloseBtn.addEventListener("click", () => {
    oauthModal.style.display = "none";
  });
  oauthModal.addEventListener("click", (e) => {
    if (e.target === oauthModal) {
      oauthModal.style.display = "none";
    }
  });
}

// Copy Redirect URI Buttons
if (copyUriBtn && redirectUriDisplay) {
  copyUriBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(redirectUriDisplay.value);
      copyUriBtn.textContent = "복사 완료! ✓";
      setTimeout(() => (copyUriBtn.textContent = "복사"), 2000);
    } catch (e) {
      redirectUriDisplay.select();
      document.execCommand("copy");
      copyUriBtn.textContent = "복사 완료! ✓";
      setTimeout(() => (copyUriBtn.textContent = "복사"), 2000);
    }
  });
}

if (copyUriLocalBtn && redirectUriLocal) {
  copyUriLocalBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(redirectUriLocal.value);
      copyUriLocalBtn.textContent = "복사 완료! ✓";
      setTimeout(() => (copyUriLocalBtn.textContent = "로컬용 복사"), 2000);
    } catch (e) {
      redirectUriLocal.select();
      document.execCommand("copy");
      copyUriLocalBtn.textContent = "복사 완료! ✓";
      setTimeout(() => (copyUriLocalBtn.textContent = "로컬용 복사"), 2000);
    }
  });
}

// Test Login Actions
async function performTestLogin(email, name) {
  try {
    const res = await fetch("/api/auth/test-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    const data = await res.json();
    if (data.success) {
      if (oauthModal) oauthModal.style.display = "none";
      await checkAuthStatus();
      alert(`🎉 환영합니다! ${data.user.name} (${data.user.email}) 계정으로 ${data.isNew ? "신규 회원가입" : "로그인"}되었습니다.`);
    } else {
      alert("테스트 로그인 실패: " + (data.error || "오류"));
    }
  } catch (err) {
    alert("테스트 로그인 요청 실패: " + err.message);
  }
}

if (testLoginBtn1) {
  testLoginBtn1.addEventListener("click", () => performTestLogin("hong@gmail.com", "홍길동"));
}
if (testLoginBtn2) {
  testLoginBtn2.addEventListener("click", () => performTestLogin("chulsoo@gmail.com", "김철수"));
}

// URL Query Notifications
function handleUrlQueryParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("login_success")) {
    const isNew = params.get("new_user");
    setTimeout(() => {
      alert(isNew ? "🎉 Google 계정으로 회원가입이 완료되었습니다!" : "🎉 Google 계정으로 로그인되었습니다!");
    }, 300);
    history.replaceState(null, "", window.location.pathname);
  } else if (params.get("auth_error")) {
    const err = params.get("auth_error");
    if (err === "setup_required") {
      if (oauthModal) oauthModal.style.display = "flex";
    } else {
      alert("Google 인증 처리 중 오류가 발생했습니다: " + err);
    }
    history.replaceState(null, "", window.location.pathname);
  } else if (params.get("logout")) {
    setTimeout(() => {
      alert("로그아웃되었습니다.");
    }, 300);
    history.replaceState(null, "", window.location.pathname);
  }
}

// Initialize
applySavedTheme();
loadHistory();
connectStream();
checkAuthStatus();
handleUrlQueryParams();