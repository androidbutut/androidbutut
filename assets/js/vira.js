
let auth;
let db;

// === DOM Elements ===
const input = document.getElementById("message-input");
const micBtn = document.getElementById("mic-btn");
const sendBtn = document.getElementById("send-btn");
const chatOutput = document.getElementById("chat-output");

let inputFromVoice = false;

// === Auth UI State ===
function updateAuthUI(user) {
  if (user) {
    logoutBtn?.classList.remove("d-none");
    loginBtn?.classList.add("d-none");
  } else {
    logoutBtn?.classList.add("d-none");
    loginBtn?.classList.remove("d-none");
  }
}

// === Logout Handler ===
function setupLogoutButton() {
  logoutBtn?.addEventListener("click", async () => {
    if (!auth) {
      console.error("Auth object not available for logout.");
      alert("Error: Layanan autentikasi belum siap.");
      return;
    }
    try {
      await auth.signOut(); // Use the global 'auth' instance
      alert("✅ Kamu telah logout.");
      window.location.reload();
    } catch (err) {
      console.error("❌ Gagal logout:", err);
      alert("Terjadi kesalahan saat logout. Silakan coba lagi.");
    }
  });
}

// === Chat History ===
async function loadHistory() {
  if (!auth.currentUser) return;
  try {
    const colRef = collection(db, "chats", auth.currentUser.uid, "messages");
    const q = query(colRef, orderBy("timestamp"));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
      const data = doc.data();
      appendMessage(
        data.role,
        data.content,
        data.timestamp && data.timestamp.toDate ? data.timestamp.toDate().toLocaleTimeString() : ""
      );
    });
    chatOutput.scrollTop = chatOutput.scrollHeight;
  } catch (err) {
    console.error("❌ Error loading history:", err);
  }
}

async function saveMessage(role, content) {
  if (!auth.currentUser) return;
  try {
    await addDoc(collection(db, "chats", auth.currentUser.uid, "messages"), {
      role, content, timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("❌ Gagal simpan ke Firestore:", err.message);
  }
}

// === Produk Search ===
async function cariProdukDariPrompt(prompt) {
  const produkRef = collection(db, "produk");
  const snapshot = await getDocs(produkRef);
  const hasil = [];
  const teks = prompt.toLowerCase();
  snapshot.forEach(doc => {
    const p = doc.data();
    if (p.tags?.some(tag => teks.includes(tag))) {
      hasil.push({ id: doc.id, ...p });
    }
  });
  return hasil;
}

// === Chat Bubble ===
function appendMessage(role, content, timestamp = null) {
  const msgRow = document.createElement("div");
  msgRow.className = "msg-row" + (role === "assistant" ? "" : " right");
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = `
    ${content}
    <div class="msg-meta">
      ${timestamp || new Date().toLocaleTimeString()}
      ${role === "user" ? '<i class="bi bi-check2-all"></i>' : ""}
    </div>
  `;
  msgRow.appendChild(bubble);
  chatOutput.appendChild(msgRow);
  chatOutput.scrollTop = chatOutput.scrollHeight;
}

function showTypingIndicator() {
  setStatusTyping();
  removeTypingIndicator();
  const typingRow = document.createElement("div");
  typingRow.className = "msg-row";
  typingRow.id = "vira-typing";
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = `<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>`;
  typingRow.appendChild(bubble);
  chatOutput.appendChild(typingRow);
  chatOutput.scrollTop = chatOutput.scrollHeight;
}

function removeTypingIndicator() {
  clearTypingStatus();
  document.getElementById("vira-typing")?.remove();


  clearTypingStatus();
}

function renderProdukBubble(p) {
  const container = document.getElementById("chat-output");
  const msgRow = document.createElement("div");
  msgRow.className = "msg-row";
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = `
    <div class="produk-card">
      <img src="${p.gambar}" alt="${p.nama}" />
      <div class="produk-card-content">
        <strong>${p.nama}</strong>
        <small>Rp${p.harga.toLocaleString()}</small>
        <a href="${p.link}" class="btn-beli" target="_blank">Beli Sekarang</a>
      </div>
    </div>
    <div class="msg-meta">${new Date().toLocaleTimeString()}</div>
  `;
  msgRow.appendChild(bubble);
  container.appendChild(msgRow);
  container.scrollTop = container.scrollHeight;
}

// === Sidebar Produk ===
async function tampilkanProdukSidebar(filterKeyword = "", filterTag = "semua") {
  const sidebarList = document.getElementById("sidebar-produk-list");
  sidebarList.innerHTML = "";
  const produkRef = collection(db, "produk");
  const snapshot = await getDocs(produkRef);
  snapshot.forEach(doc => {
    const p = doc.data();
    const namaMatch = p.nama.toLowerCase().includes(filterKeyword);
    const tagMatch = p.tags?.some(tag => tag.includes(filterKeyword));
    const isFavorit = p.tags?.includes("favorit");
    const isGroup = p.tags?.includes("grup");
    const cocok = (
      (filterTag === "semua") ||
      (filterTag === "favorit" && isFavorit) ||
      (filterTag === "grup" && isGroup)
    );
    if ((namaMatch || tagMatch) && cocok) {
      const div = document.createElement("div");
      div.className = "chat-item d-flex align-items-center p-2 text-white border-bottom";
      div.style.cursor = "pointer";
      div.innerHTML = `
        <div class="chat-avatar me-2">
          <img src="${p.gambar}" alt="${p.nama}" width="48" height="48" class="rounded" />
        </div>
        <div class="flex-grow-1">
          <div class="chat-title fw-bold">${p.nama}</div>
          <div class="chat-snippet text-success">Rp. ${p.harga.toLocaleString()}</div>
        </div>
        <div class="chat-time text-warning"><i class="bi bi-star-fill"></i> 4.7</div>
      `;
      div.addEventListener("click", () => {
        handleSend(`Vira, Ada ${p.tags?.[0] || p.nama}?`);
        document.getElementById("sidebar").classList.remove("open");
      });
      sidebarList.appendChild(div);
    }
  });
}

// === Kirim Pesan ke VIRA ===
async function sendMessageToVIRA(prompt) {
  await saveMessage("user", prompt);
  const res = await fetch("https://vira-ai.daffadev.workers.dev/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, uid: auth.currentUser?.uid || "anon" })
  });
  const data = await res.json();
  if (data.limitReached) {
    alert("🚪 Kamu sudah mencapai batas chat harian. Silakan login untuk lanjut.");
    window.location.href = "/login-user";
    return "🔒 Chat dihentikan. Silakan login untuk lanjut.";
  }
  if (data.reply) {
    await saveMessage("assistant", data.reply);
    return data.reply;
  } else {
    throw new Error(data.error || "Gagal ngobrol sama VIRA");
  }
}

async function handleSend(message = null) {
  const msg = message?.trim() || input.value.trim();
  if (!msg) return;
  appendMessage("user", msg);
  if (!message) input.value = "";
  toggleButtons();
  showTypingIndicator();
  const produkList = await cariProdukDariPrompt(msg);
  if (produkList.length > 0) {
    removeTypingIndicator();
    produkList.forEach(renderProdukBubble);
    return;
  }
  try {
    const reply = await sendMessageToVIRA(msg);
    removeTypingIndicator();
    appendMessage("assistant", reply);
    if (inputFromVoice && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(reply);
      utterance.lang = "id-ID";
      speechSynthesis.speak(utterance);
      inputFromVoice = false;
    }
  } catch (err) {
    removeTypingIndicator();
    appendMessage("assistant", `❌ ${err.message}`);
  }
}

async function clearChat() {
  chatOutput.innerHTML = "";
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const messagesRef = collection(db, "chats", uid, "messages");
  const snapshot = await getDocs(messagesRef);
  const deletePromises = [];
  snapshot.forEach(docSnap => {
    const docRef = doc(db, "chats", uid, "messages", docSnap.id);
    deletePromises.push(deleteDoc(docRef));
  });
  try {
    await Promise.all(deletePromises);
    console.log("✅ Semua chat berhasil dihapus dari Firestore.");
  } catch (err) {
    console.error("❌ Gagal hapus chat dari Firestore:", err);
  }
}

// === Voice Recognition ===
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) recognition.lang = "id-ID";

function setupVoiceRecognition() {
  if (!recognition) return;
  micBtn.addEventListener("click", () => {
    micBtn.innerHTML = '<i class="bi bi-mic-mute-fill"></i>';
    recognition.start();
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript?.trim();
      if (transcript && transcript.length > 0) {
        inputFromVoice = true;
        handleSend(transcript);
      }
    };
    recognition.onend = () => {
      micBtn.innerHTML = '<i class="bi bi-mic-fill"></i>';
    };
    recognition.onerror = () => {
      micBtn.innerHTML = '<i class="bi bi-mic-fill"></i>';
      console.error("🎤 Error dari speech recognition");
    };
  });
}

// === UI Button Toggle ===
function toggleButtons() {
  const val = input.value.trim();
  const isFocused = document.activeElement === input;
  micBtn.style.display = (!isFocused && val === "") ? '' : 'none';
  sendBtn.style.display = (val !== "" || isFocused) ? '' : 'none';
}

function clearTypingStatus() {
  setStatusOnline(); // kembali ke status online
  statusEl.classList.remove("typing-indicator");
}

// === Event Listeners & Init ===
function setupEventListeners() {
  sendBtn.addEventListener("click", () => handleSend());
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSend(); });
  input.addEventListener("input", toggleButtons);
  input.addEventListener("focus", toggleButtons);
  input.addEventListener("blur", () => setTimeout(toggleButtons, 100));
  document.getElementById("toggleSidebar")?.addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
  });
  document.getElementById("togglexSidebar")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });
  document.getElementById("chat-search")?.addEventListener("input", (e) => {
    const keyword = e.target.value.toLowerCase();
    tampilkanProdukSidebar(keyword);
  });
  document.querySelectorAll(".sidebar-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".sidebar-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const label = tab.textContent.trim().toLowerCase();
      tampilkanProdukSidebar(document.getElementById("chat-search").value.toLowerCase(), label);
    });
  });
  const menuBtn = document.getElementById("menuDropdown");
  const menuList = document.getElementById("menuDropdownList");
  menuBtn?.addEventListener("click", () => {
    menuList.classList.toggle("d-none");
  });
  document.addEventListener("click", (e) => {
    if (!menuBtn.contains(e.target) && !menuList.contains(e.target)) {
      menuList.classList.add("d-none");
    }
  });
  document.getElementById("loginUserBtn")?.addEventListener("click", () => {
    window.location.href = "/login-user";
  });
  document.getElementById("loginAdminBtn")?.addEventListener("click", () => {
    window.location.href = "/login-admin";
  });
}

function setupTrashButtons() {
  // Desktop
  const desktopTrash = document.getElementById("tongSampah");
  if (desktopTrash) desktopTrash.addEventListener("click", clearChat);
  // Mobile
  if (window.innerWidth <= 540) {
    const mobileTrash = document.createElement("button");
    mobileTrash.id = "mobile-trash";
    mobileTrash.title = "Hapus Chat";
    mobileTrash.innerHTML = '<i class="bi bi-trash3-fill"></i>';
    mobileTrash.onclick = clearChat;
    document.getElementById("chat-header-tools")?.appendChild(mobileTrash);
  }
}

// === Init ===
document.addEventListener("DOMContentLoaded", () => {
  toggleButtons();
  loadHistory();
  tampilkanProdukSidebar();
  setupLogoutBtn();
  setupVoiceRecognition();
  setupEventListeners();
  setupTrashButtons();
});

let afkTimeout;
const statusEl = document.getElementById("chatStatus");

function getJamMenit() {
  const now = new Date();
  const jam = now.getHours().toString().padStart(2, '0');
  const menit = now.getMinutes().toString().padStart(2, '0');
  return `${jam}:${menit}`;}

function setStatusOnline() {
  statusEl.innerText = `Online - ${getJamMenit()}`;
}

function setStatusAFK() {
  statusEl.innerText = `Terakhir dilihat pukul ${getJamMenit()}`;
}

function resetAFKTimer() {
  setStatusOnline();
  clearTimeout(afkTimeout);
  afkTimeout = setTimeout(setStatusAFK, 1 * 30 * 500); // 2 menit
}

// ▶️ Trigger aktif saat user gerak
["keydown", "click", "scroll", "touchstart"].forEach(evt =>
  window.addEventListener(evt, resetAFKTimer)
);

function setStatusTyping() {
  statusEl.innerText = "VIRA sedang mengetik...";
}

// ⏱️ Jalankan saat halaman siap
setStatusOnline();
resetAFKTimer();