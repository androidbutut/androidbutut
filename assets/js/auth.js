// /assets/js/auth.js
// Ini adalah IIFE (Immediately Invoked Function Expression)
// Ini akan berjalan segera setelah script dimuat.
(function() {
  // Pastikan elemen DOM ada sebelum diakses
  const loginModal = document.getElementById("loginModal");
  const loginBtn = document.getElementById("login-btn");
  // Pastikan ID ini sama dengan yang di vira.js dan HTML
  const logoutBtn = document.getElementById("logoutUserBtn");

  // Tunggu hingga window.auth dan window.db tersedia
  // Ini penting karena firebaseSDK.html yang menyediakan ini.
  let auth;
  let db;

  const initAuth = setInterval(() => {
    if (window.auth && window.db && typeof firebase !== 'undefined' && firebase.apps.length > 0) {
      clearInterval(initAuth);
      auth = window.auth;
      db = window.db; // Jika auth.js perlu db, pastikan juga diinisialisasi

      const provider = new firebase.auth.GoogleAuthProvider();

      // Fungsi untuk mengupdate UI berdasarkan status autentikasi
      function updateAuthUIState(user) {
        if (user) {
          console.log("✅ User logged in:", user.email);
          localStorage.setItem("uid", user.uid);
          if (logoutBtn) logoutBtn.classList.remove("d-none");
          if (loginBtn) loginBtn.classList.add("d-none"); // Sembunyikan tombol login jika sudah login
          if (loginModal) loginModal.classList.add("d-none"); // Sembunyikan modal login jika sudah login
        } else {
          console.log("🔓 No user logged in.");
          localStorage.removeItem("uid");
          localStorage.removeItem("yunaUser"); // Bersihkan data user lama
          if (logoutBtn) logoutBtn.classList.add("d-none");
          if (loginBtn) loginBtn.classList.remove("d-none"); // Tampilkan tombol login jika logout
          // Opsi: Tampilkan modal login jika belum login dan ini esensial
          // if (loginModal) loginModal.classList.remove("d-none");
        }
      }

      // Set up authentication state observer
      auth.onAuthStateChanged(updateAuthUIState);

      // Setup login button event listener
      if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
          try {
            const result = await auth.signInWithPopup(provider);
            const user = result.user;
            console.log("🙋‍♀️ Login successful:", user.email);

            // Simpan user info ke localStorage
            localStorage.setItem("yunaUser", JSON.stringify({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            }));

            // Redirect atau reload setelah login sukses
            location.reload();
          } catch (err) {
            console.error("❌ Login failed:", err);
            let errorMessage = "Gagal login. Silakan coba lagi!";
            if (err.code === 'auth/popup-closed-by-user') {
              errorMessage = "Login dibatalkan. Jendela popup ditutup.";
            } else if (err.code === 'auth/cancelled-popup-request') {
              errorMessage = "Login dibatalkan. Mungkin ada popup lain yang terbuka.";
            }
            alert(errorMessage);
          }
        });
      }

      // Setup logout button event listener (Ini mungkin tumpang tindih dengan vira.js,
      // tetapi biarkan untuk memastikan fungsi logout bekerja jika auth.js dimuat duluan)
      if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
          try {
            await auth.signOut();
            localStorage.removeItem("uid");
            localStorage.removeItem("yunaUser");
            alert("Kamu berhasil logout!");
            location.reload();
          } catch (err) {
            console.error("❌ Logout failed:", err);
            alert("Gagal logout. Silakan coba lagi.");
          }
        });
      }
      console.log("Auth.js script fully initialized.");

    }
  }, 50); // Cek setiap 50ms
})();