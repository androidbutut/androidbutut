// vira.js (Revised to address the Firebase App not created error)

// REMOVE these lines from the very top of vira.js as they might execute too early:
// const {
//   getDocs,
//   collection,
//   query,
//   orderBy,
//   addDoc,
//   serverTimestamp,
//   doc,
//   deleteDoc,
//   onAuthStateChanged,
//   signOut
// } = firebase.firestore;
// const auth = firebase.auth();

// Instead, ensure we are using the globally provided instances after Firebase initialization.
// We will get 'auth' and 'db' from the window object later in the DOMContentLoaded block,
// or assume they are passed into a module pattern.
// For now, let's declare them as mutable variables to be assigned later.
let auth;
let db;

// === DOM Elements ===
const input = document.getElementById("message-input");
const micBtn = document.getElementById("mic-btn");
const sendBtn = document.getElementById("send-btn");
const chatOutput = document.getElementById("chat-output");
const logoutBtn = document.getElementById("logoutUserBtn");
const loginBtn = document.getElementById("loginUserBtn");
const sidebar = document.getElementById("sidebar");
const sidebarList = document.getElementById("sidebar-produk-list");
const chatSearchInput = document.getElementById("chat-search");
const toggleSidebarBtn = document.getElementById("toggleSidebar");
const togglexSidebarBtn = document.getElementById("togglexSidebar");
const menuDropdownBtn = document.getElementById("menuDropdown");
const menuDropdownList = document.getElementById("menuDropdownList");
const desktopTrashBtn = document.getElementById("tongSampah");
const chatHeaderTools = document.getElementById("chat-header-tools");
const chatStatusEl = document.getElementById("chatStatus");

let inputFromVoice = false;
let afkTimeout;

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
async function loadChatHistory() {
  if (!auth || !auth.currentUser || !db) return; // Ensure auth and db are available
  try {
    // Access Firestore methods directly from 'db' instance
    const colRef = db.collection("chats").doc(auth.currentUser.uid).collection("messages");
    const q = colRef.orderBy("timestamp");
    const snapshot = await q.get(); // Use .get() for a single fetch
    snapshot.forEach(doc => {
      const data = doc.data();
      const timestamp = data.timestamp && data.timestamp.toDate ? data.timestamp.toDate().toLocaleTimeString() : "";
      appendMessage(data.role, data.content, timestamp);
    });
    chatOutput.scrollTop = chatOutput.scrollHeight;
  } catch (err) {
    console.error("❌ Error loading history:", err);
    // Optionally, display an error message to the user
  }
}

async function saveMessage(role, content) {
  if (!auth || !auth.currentUser || !db) return; // Ensure auth and db are available
  try {
    await db.collection("chats").doc(auth.currentUser.uid).collection("messages").add({
      role,
      content,
      timestamp: firebase.firestore.FieldValue.serverTimestamp() // Access serverTimestamp via firebase global if needed
    });
  } catch (err) {
    console.error("❌ Gagal simpan ke Firestore:", err.message);
    // Optionally, display an error message to the user
  }
}

// === Produk Search ===
async function searchProductsFromPrompt(prompt) {
  if (!db) return []; // Ensure db is available
  const produkRef = db.collection("produk");
  const snapshot = await produkRef.get();
  const results = [];
  const lowerCasePrompt = prompt.toLowerCase();
  snapshot.forEach(doc => {
    const product = doc.data();
    if (product.tags?.some(tag => lowerCasePrompt.includes(tag))) {
      results.push({
        id: doc.id,
        ...product
      });
    }
  });
  return results;
}

// === Chat Bubble UI ===
function appendMessage(role, content, timestamp = null) {
  const msgRow = document.createElement("div");
  msgRow.className = `msg-row ${role === "user" ? "right" : ""}`;
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
  removeTypingIndicator(); // Ensure only one typing indicator exists
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
}

function renderProductBubble(product) {
  const msgRow = document.createElement("div");
  msgRow.className = "msg-row"; // Product bubbles are from assistant
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = `
    <div class="produk-card">
      <img src="${product.gambar}" alt="${product.nama}" />
      <div class="produk-card-content">
        <strong>${product.nama}</strong>
        <small>Rp${product.harga.toLocaleString()}</small>
        <a href="${product.link}" class="btn-beli" target="_blank">Beli Sekarang</a>
      </div>
    </div>
    <div class="msg-meta">${new Date().toLocaleTimeString()}</div>
  `;
  msgRow.appendChild(bubble);
  chatOutput.appendChild(msgRow);
  chatOutput.scrollTop = chatOutput.scrollHeight;
}

// === Sidebar Produk ===
async function displayProductsSidebar(filterKeyword = "", filterTag = "semua") {
  if (!db) return; // Ensure db is available
  sidebarList.innerHTML = "";
  const produkRef = db.collection("produk");
  const snapshot = await produkRef.get();
  const lowerCaseKeyword = filterKeyword.toLowerCase();

  snapshot.forEach(doc => {
    const p = doc.data();
    const nameMatch = p.nama.toLowerCase().includes(lowerCaseKeyword);
    const tagMatch = p.tags?.some(tag => tag.toLowerCase().includes(lowerCaseKeyword));
    const isFavorit = p.tags?.includes("favorit");
    const isGroup = p.tags?.includes("grup");

    const tagFilterMatches = (
      (filterTag === "semua") ||
      (filterTag === "favorit" && isFavorit) ||
      (filterTag === "grup" && isGroup)
    );

    if ((nameMatch || tagMatch) && tagFilterMatches) {
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
        handleSendMessage(`Vira, Ada ${p.tags?.[0] || p.nama}?`);
        sidebar.classList.remove("open");
      });
      sidebarList.appendChild(div);
    }
  });
}

// === Send Message to VIRA ===
async function sendMessageToVIRA(prompt) {
  await saveMessage("user", prompt);
  try {
    const res = await fetch("https://vira-ai.daffadev.workers.dev/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        uid: auth?.currentUser?.uid || "anon" // Use optional chaining for safety
      })
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
  } catch (err) {
    console.error("❌ Error sending message to VIRA:", err);
    throw new Error(`Koneksi ke VIRA gagal: ${err.message}`);
  }
}

async function handleSendMessage(message = null) {
  const msg = message?.trim() || input.value.trim();
  if (!msg) return;

  appendMessage("user", msg);
  if (!message) input.value = "";
  toggleInputButtons();
  showTypingIndicator();

  const productList = await searchProductsFromPrompt(msg);
  if (productList.length > 0) {
    removeTypingIndicator();
    productList.forEach(renderProductBubble);
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

async function clearAllChats() {
  chatOutput.innerHTML = "";
  if (!auth || !auth.currentUser || !db) return; // Ensure auth and db are available
  const uid = auth.currentUser.uid;
  if (!uid) return;

  const messagesRef = db.collection("chats").doc(uid).collection("messages");
  const snapshot = await messagesRef.get();
  const deletePromises = [];
  snapshot.forEach(docSnap => {
    deletePromises.push(docSnap.ref.delete()); // Use docSnap.ref.delete()
  });

  try {
    await Promise.all(deletePromises);
    console.log("✅ Semua chat berhasil dihapus dari Firestore.");
    alert("Semua chat berhasil dihapus!");
  } catch (err) {
    console.error("❌ Gagal hapus chat dari Firestore:", err);
    alert("Gagal menghapus chat. Silakan coba lagi.");
  }
}

// === Voice Recognition ===
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) recognition.lang = "id-ID";

function setupVoiceRecognition() {
  if (!recognition) {
    micBtn.style.display = 'none'; // Hide mic button if not supported
    console.warn("Speech Recognition API not supported in this browser.");
    return;
  }

  micBtn.addEventListener("click", () => {
    micBtn.innerHTML = '<i class="bi bi-mic-mute-fill"></i>';
    recognition.start();
  });

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript?.trim();
    if (transcript && transcript.length > 0) {
      inputFromVoice = true;
      handleSendMessage(transcript);
    }
  };

  recognition.onend = () => {
    micBtn.innerHTML = '<i class="bi bi-mic-fill"></i>';
  };

recognition.onerror = (e) => {
    micBtn.innerHTML = '<i class="bi bi-mic-fill"></i>';
    console.error("🎤 Error from speech recognition:", e);
    let errorMessage = "Terjadi kesalahan pada pengenalan suara. Silakan coba lagi.";
    if (e.error === 'not-allowed') {
      errorMessage = "Akses mikrofon ditolak. Silakan izinkan akses mikrofon di pengaturan browser Anda.";
    }
    alert(errorMessage);
  };
}

// === UI Button Toggle ===
function toggleInputButtons() {
  const val = input.value.trim();
  const isFocused = document.activeElement === input;
  micBtn.style.display = (!isFocused && val === "") ? '' : 'none';
  sendBtn.style.display = (val !== "" || isFocused) ? '' : 'none';
}

function getJamMenit() {
  const now = new Date();
  const jam = now.getHours().toString().padStart(2, '0');
  const menit = now.getMinutes().toString().padStart(2, '0');
  return `${jam}:${menit}`;
}

function setStatusOnline() {
  chatStatusEl.innerText = `Online - ${getJamMenit()}`;
  chatStatusEl.classList.remove("typing-indicator");
}

function setStatusAFK() {
  chatStatusEl.innerText = `Terakhir dilihat pukul ${getJamMenit()}`;
}

function setStatusTyping() {
  chatStatusEl.innerText = "VIRA sedang mengetik...";
  chatStatusEl.classList.add("typing-indicator");
}

function clearTypingStatus() {
  setStatusOnline();
}

function resetAFKTimer() {
  setStatusOnline();
  clearTimeout(afkTimeout);
  // Set AFK after 2 minutes (120,000 ms)
  afkTimeout = setTimeout(setStatusAFK, 2 * 60 * 1000);
}

// === Event Listeners Setup ===
function setupEventListeners() {
  sendBtn.addEventListener("click", () => handleSendMessage());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSendMessage();
  });
  input.addEventListener("input", toggleInputButtons);
  input.addEventListener("focus", toggleInputButtons);
  input.addEventListener("blur", () => setTimeout(toggleInputButtons, 100)); // Delay to allow button clicks

  toggleSidebarBtn?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
  togglexSidebarBtn?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  chatSearchInput?.addEventListener("input", (e) => {
    const keyword = e.target.value.toLowerCase();
    displayProductsSidebar(keyword);
  });

  document.querySelectorAll(".sidebar-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".sidebar-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const label = tab.textContent.trim().toLowerCase();
      displayProductsSidebar(chatSearchInput.value.toLowerCase(), label);
    });
  });

  menuDropdownBtn?.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent document click from closing immediately
    menuDropdownList.classList.toggle("d-none");
  });

  document.addEventListener("click", (e) => {
    if (!menuDropdownBtn?.contains(e.target) && !menuDropdownList?.contains(e.target)) {
      menuDropdownList?.classList.add("d-none");
    }
  });

  document.getElementById("loginUserBtn")?.addEventListener("click", () => {
    window.location.href = "/login-user";
  });
  document.getElementById("loginAdminBtn")?.addEventListener("click", () => {
    window.location.href = "/login-admin";
  });

  // AFK detection
  ["keydown", "click", "scroll", "touchstart"].forEach(evt =>
    window.addEventListener(evt, resetAFKTimer)
  );
}

function setupTrashButtons() {
  // Desktop trash button
  if (desktopTrashBtn) desktopTrashBtn.addEventListener("click", clearAllChats);

  // Mobile trash button
  if (window.innerWidth <= 540) {
    const mobileTrash = document.createElement("button");
    mobileTrash.id = "mobile-trash";
    mobileTrash.title = "Hapus Chat";
    mobileTrash.innerHTML = '<i class="bi bi-trash3-fill"></i>';
    mobileTrash.onclick = clearAllChats;
    chatHeaderTools?.appendChild(mobileTrash);
  }
}

// === Initialization ===
// This block ensures vira.js functions are called ONLY after Firebase is ready.
// The `firebaseSDK.html` is now responsible for setting `window.auth` and `window.db`.
document.addEventListener("DOMContentLoaded", () => {
  // We need to wait for window.auth and window.db to be populated by firebaseSDK.html
  const initInterval = setInterval(() => {
    if (window.auth && window.db) { // Check if Firebase instances are available globally
      clearInterval(initInterval);
      console.log("Vira.js: Firebase services (auth, db) are ready.");

      // Assign to local variables for convenience
      auth = window.auth;
      db = window.db;

      // Setup UI and functionality
      toggleInputButtons();
      loadChatHistory();
      displayProductsSidebar();
      setupLogoutButton();
      setupVoiceRecognition();
      setupEventListeners();
      setupTrashButtons();

      // Set initial status
      setStatusOnline();
      resetAFKTimer();

      // Listen for auth state changes using the global 'auth' instance
      auth.onAuthStateChanged(updateAuthUI);
    }
  }, 50); // Check more frequently if needed, or adjust based on your page load
});