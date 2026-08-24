// Initialize local database using IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("JournalDB", 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("entries")) {
        db.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("Failed to open IndexedDB");
  });
}

// Convert image files to Base64 data strings for local storage
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

// Get all saved entries
async function getEntries() {
  const db = await openDB();
  return new Promise((resolve) => {
    const transaction = db.transaction("entries", "readonly");
    const store = transaction.objectStore("entries");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });
}

// Render entries sorted strictly by custom user date (Newest first)
async function renderEntries() {
  const container = document.getElementById("entriesContainer");
  const entries = await getEntries();

  // Sort by customDate field
  entries.sort((a, b) => new Date(b.customDate) - new Date(a.customDate));

  container.innerHTML = "";

  entries.forEach((entry) => {
    const imagesHtml = entry.images
      .map((src) => `<img src="${src}" alt="Uploaded photo" />`)
      .join("");

    const card = document.createElement("article");
    card.className = "entry-card";
    card.innerHTML = `
      <header class="entry-header">
        <time class="date">${entry.customDate}</time>
        <div class="author">${entry.author}</div>
      </header>
      <section class="entry-images-container">${imagesHtml}</section>
      <section class="entry-box-thoughts">${entry.thoughts}</section>
      <section class="entry-box-lyrics">${entry.lyrics}</section>
      <button class="delete-btn" onclick="deleteEntry(${entry.id})">Delete Entry</button>
    `;
    container.appendChild(card);
  });
}

// Form Submission
document.getElementById("entryForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const files = Array.from(document.getElementById("images").files);
  const base64Images = await Promise.all(files.map((file) => fileToBase64(file)));

  const newEntry = {
    customDate: document.getElementById("customDate").value,
    author: document.getElementById("author").value,
    thoughts: document.getElementById("thoughts").value,
    lyrics: document.getElementById("lyrics").value,
    images: base64Images
  };

  const db = await openDB();
  const transaction = db.transaction("entries", "readwrite");
  const store = transaction.objectStore("entries");
  store.add(newEntry);

  transaction.oncomplete = () => {
    document.getElementById("entryForm").reset();
    renderEntries();
  };
});

// Delete Entry Helper Function
async function deleteEntry(id) {
  const db = await openDB();
  const transaction = db.transaction("entries", "readwrite");
  const store = transaction.objectStore("entries");
  store.delete(id);
  transaction.oncomplete = () => renderEntries();
}

// Standalone Download Functionality (Detached from Database)
document.getElementById("downloadBtn").addEventListener("click", () => {
  const container = document.getElementById("entriesContainer");
  
  if (!container.children.length) {
    alert("No entries to download yet! Add some entries first.");
    return;
  }

  // Clone entries to safely strip delete buttons out of the backup file
  const cloneContainer = container.cloneNode(true);
  const deleteBtns = cloneContainer.querySelectorAll(".delete-btn");
  deleteBtns.forEach(btn => btn.remove());

  const styles = document.querySelector("style").innerHTML;

  // Build static HTML string with embedded images and layout
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Journal Backup - ${new Date().toLocaleDateString()}</title>
  <style>
    ${styles}
  </style>
</head>
<body>
  <div class="container">
    <h2 style="text-align: center; color: #333; margin-bottom: 30px;">Saved Journal Backup</h2>
    <div>${cloneContainer.innerHTML}</div>
  </div>
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  
  a.href = url;
  a.download = `journal-backup-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Initial render call on startup
renderEntries();
