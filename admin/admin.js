// admin.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, deleteDoc,
  collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// === Firebase Config ===
// Pastikan ini sama dengan firebase-config.js atau firebase-config.local.js
const firebaseConfig = {
  apiKey: "AIzaSyCi_hDVGY1Mxu2XkHc9lU2e2dvQxNn93mE",
  authDomain: "ai-apps-4e725.firebaseapp.com",
  projectId: "ai-apps-4e725",
  storageBucket: "ai-apps-4e725.appspot.com",
  messagingSenderId: "893169320014",
  appId: "1:893169320014:web:bef13994bb20c349b3031f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// === DOM Elements ===
const logoutBtn = document.getElementById("logoutBtn");
const produkForm = document.getElementById("produk-form");
const produkList = document.getElementById("produk-list");
const loadingOverlay = document.getElementById("loadingOverlay");
const initialLoadingMessage = document.getElementById("initial-loading-message");

const produkRef = collection(db, "produk");

// === Loading Overlay Functions ===
function showLoading(message = "Memproses...") {
    loadingOverlay.textContent = message;
    loadingOverlay.classList.add("active");
}

function hideLoading() {
    loadingOverlay.classList.remove("active");
}

// === Auth Check & Admin Role Verification ===
onAuthStateChanged(auth, async (user) => {
    showLoading("Memverifikasi akses...");
    if (!user) {
        hideLoading();
        alert("Silakan login terlebih dahulu untuk mengakses halaman admin.");
        window.location.href = "/"; // Redirect ke halaman utama atau login
        return;
    }
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists() || !userSnap.data().isAdmin) {
            alert("Akses ditolak. Anda tidak memiliki izin admin.");
            await signOut(auth); // Pastikan logout jika bukan admin
            hideLoading();
            window.location.href = "/";
            return;
        }
        // Jika admin, lanjutkan memuat produk
        loadProduk();
    } catch (error) {
        console.error("Error saat verifikasi admin:", error);
        alert("Terjadi kesalahan saat memverifikasi peran admin. Silakan coba lagi.");
        await signOut(auth);
        hideLoading();
        window.location.href = "/";
    }
});

// === Logout Handler ===
logoutBtn.addEventListener("click", async () => {
    showLoading("Logging out...");
    try {
        await signOut(auth);
        alert("Anda telah berhasil logout.");
        window.location.href = "/";
    } catch (error) {
        console.error("Error saat logout:", error);
        alert("Gagal logout. Silakan coba lagi.");
    } finally {
        hideLoading();
    }
});

// === Form Submission Handler (Tambah/Edit Produk) ===
produkForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showLoading("Menyimpan produk...");

    const slug = produkForm.slug.value.trim();
    const nama = produkForm.nama.value.trim();
    const harga = parseInt(produkForm.harga.value);
    const gambar = produkForm.gambar.value.trim();
    const link = produkForm.link.value.trim();
    const deskripsi = produkForm.deskripsi.value.trim();
    const tags = produkForm.tags.value.split(",").map(t => t.trim().toLowerCase()).filter(t => t !== "");

    if (!slug) {
        alert("Slug produk tidak boleh kosong!");
        hideLoading();
        return;
    }
    if (isNaN(harga) || harga <= 0) {
        alert("Harga harus berupa angka positif!");
        hideLoading();
        return;
    }
    if (!nama) {
        alert("Nama produk tidak boleh kosong!");
        hideLoading();
        return;
    }

    try {
        const produkDocRef = doc(db, "produk", slug);
        const data = { nama, harga, gambar, link, deskripsi, tags };
        
        await setDoc(produkDocRef, data); // setDoc akan membuat atau menimpa dokumen
        
        alert("Produk berhasil disimpan!");
        produkForm.reset(); // Reset form setelah sukses
        loadProduk(); // Muat ulang daftar produk
    } catch (error) {
        console.error("Error saat menyimpan produk:", error);
        alert(`Gagal menyimpan produk: ${error.message}. Periksa input atau koneksi Anda.`);
    } finally {
        hideLoading();
    }
});

// === Load & Display Produk ===
async function loadProduk() {
    produkList.innerHTML = `<div class="col-12 text-center text-muted">Memuat daftar produk...</div>`; // Pesan loading di daftar
    initialLoadingMessage.classList.add('d-none'); // Sembunyikan pesan loading awal
    showLoading("Memuat produk...");
    try {
        const snapshot = await getDocs(produkRef);
        produkList.innerHTML = ""; // Bersihkan daftar sebelum mengisi

        if (snapshot.empty) {
            produkList.innerHTML = `<div class="col-12 text-center text-muted">Belum ada produk. Tambahkan produk pertama Anda!</div>`;
        } else {
            snapshot.forEach(doc => {
                const p = doc.data();
                const col = document.createElement("div");
                col.className = "col"; // Bootstrap 5 uses col for auto-sizing in rows
                col.innerHTML = `
                    <div class="card text-bg-secondary h-100">
                        <img src="${p.gambar || 'https://via.placeholder.com/150/0000FF/FFFFFF?text=No+Image'}" class="card-img-top" alt="${p.nama}"/>
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title">${p.nama}</h5>
                            <p class="card-text flex-grow-1">${p.deskripsi || ""}</p>
                            <p class="card-text mb-2"><strong>Rp${p.harga?.toLocaleString('id-ID')}</strong></p>
                            <p class="mb-2"><small class="text-white-50">Tags: ${p.tags?.join(", ") || "-"}</small></p>
                            <div class="mt-auto d-flex justify-content-between align-items-center">
                                <a href="${p.link}" target="_blank" class="btn btn-primary btn-sm me-2 ${p.link ? '' : 'disabled'}" ${p.link ? '' : 'aria-disabled="true"'}>Beli</a>
                                <button class="btn btn-info btn-sm me-2 edit-produk-btn" data-id="${doc.id}">✏️ Edit</button>
                                <button class="btn btn-danger btn-sm delete-produk-btn" data-id="${doc.id}">🗑️ Hapus</button>
                            </div>
                        </div>
                    </div>
                `;
                produkList.appendChild(col);
            });
            addProdukEventListeners(); // Tambahkan event listener setelah semua produk dirender
        }
    } catch (error) {
        console.error("Error memuat produk:", error);
        produkList.innerHTML = `<div class="col-12 text-center text-danger">Gagal memuat daftar produk: ${error.message}</div>`;
        alert("Gagal memuat produk. Periksa koneksi internet atau aturan Firestore Anda.");
    } finally {
        hideLoading();
    }
}

// === Add Event Listeners for Edit/Delete Buttons ===
function addProdukEventListeners() {
    document.querySelectorAll(".delete-produk-btn").forEach(button => {
        button.onclick = null; // Clear previous listeners
        button.addEventListener("click", () => {
            const id = button.dataset.id;
            hapusProduk(id);
        });
    });

    document.querySelectorAll(".edit-produk-btn").forEach(button => {
        button.onclick = null; // Clear previous listeners
        button.addEventListener("click", () => {
            const id = button.dataset.id;
            editProduk(id);
        });
    });
}

// === Delete Produk Handler ===
async function hapusProduk(id) {
    if (confirm("Yakin ingin menghapus produk ini? Aksi ini tidak bisa dibatalkan.")) {
        showLoading("Menghapus produk...");
        try {
            await deleteDoc(doc(db, "produk", id));
            alert("Produk berhasil dihapus!");
            loadProduk(); // Muat ulang daftar setelah penghapusan
        } catch (error) {
            console.error("Error saat menghapus produk:", error);
            alert(`Gagal menghapus produk: ${error.message}. Pastikan aturan Firestore mengizinkan penghapusan.`);
        } finally {
            hideLoading();
        }
    }
}

// === Edit Produk Handler ===
async function editProduk(id) {
    showLoading("Memuat data produk untuk diedit...");
    try {
        const docRef = doc(db, "produk", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const p = docSnap.data();
            produkForm.slug.value = id;
            produkForm.slug.readOnly = true; // Slug tidak bisa diubah saat edit
            produkForm.nama.value = p.nama || "";
            produkForm.harga.value = p.harga || 0;
            produkForm.gambar.value = p.gambar || "";
            produkForm.link.value = p.link || "";
            produkForm.deskripsi.value = p.deskripsi || "";
            produkForm.tags.value = p.tags?.join(", ") || "";
            
            produkForm.querySelector('button[type="submit"]').textContent = "💾 Update Produk";
            // Scroll to form
            produkForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            alert("Produk tidak ditemukan!");
        }
    } catch (error) {
        console.error("Error saat memuat produk untuk edit:", error);
        alert(`Gagal memuat data produk untuk diedit: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// === Initial Load ===
// loadProduk() dipanggil setelah verifikasi admin di onAuthStateChanged