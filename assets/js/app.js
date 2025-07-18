document.addEventListener('DOMContentLoaded', function () {
  const chatSearchInput = document.getElementById('chat-search'); // Dinamai ulang untuk kejelasan
  const chatList = document.getElementById('chat-list'); // Dinamai ulang untuk kejelasan

  // Blok ini berasumsi 'chat-list' adalah untuk fitur pencarian/filter yang berbeda dari produk sidebar.
  // Jika 'chat-search' secara eksklusif untuk 'sidebar-produk-list', file ini mungkin menjadi redundan.
  if (chatSearchInput && chatList) {
    chatSearchInput.addEventListener('input', function () {
      const term = chatSearchInput.value.toLowerCase();
      // Pastikan chatList.children adalah array untuk iterasi yang andal
      Array.from(chatList.children).forEach(item => {
        const title = item.querySelector('.chat-title')?.textContent.toLowerCase() || '';
        item.style.display = title.includes(term) ? '' : 'none';
      });
    });
  }
});