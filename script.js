const SLIDES_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzB78vCB7KGj1V8dZmgUxeAFxf-mkW-MN94ZqlE9nKStrGBBoy_D4mg9HFM6hnlKUBf/exec";
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

function fileToBase64Resized(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 600;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target.result;
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

async function getEntries() {
  const db = await openDB();
  return new Promise((resolve) => {
    const transaction = db.transaction("entries", "readonly");
    const store = transaction.objectStore("entries");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });
}

async function markEntryAsSynced(entry) {
  const db = await openDB();
  return new Promise((resolve) => {
    const transaction = db.transaction("entries", "readwrite");
    const store = transaction.objectStore("entries");
    entry.synced = true;
    const request = store.put(entry);
    request.onsuccess = () => resolve();
  });
}

async function renderEntries() {
  const container = document.getElementById("entriesContainer");
  const entries = await getEntries();

  entries.sort((a, b) => new Date(b.customDate) - new Date(a.customDate));
  container.innerHTML = "";

  entries.forEach((entry) => {
    const imagesHtml = (entry.images || [])
      .map((src) => `<img src="${src}" alt="Uploaded photo" />`)
      .join("");

    const statusBadge = (entry.synced === true) 
      ? `<span style="color: #68d391; font-size: 11px; font-weight: bold; font-family: 'Space Mono', monospace;">✔ Synced</span>` 
      : `<span style="color: #f6ad55; font-size: 11px; font-weight: bold; font-family: 'Space Mono', monospace;">⏳ Not Synced</span>`;

    const card = document.createElement("article");
    card.className = "entry-card";
    card.innerHTML = `
      <header class="entry-header">
        <time class="date">${entry.customDate} - ${statusBadge}</time>
        <div class="author">${entry.author}</div>
      </header>
      <section class="entry-images-container">${imagesHtml}</section>
      <section class="entry-box-thoughts">${entry.thoughts}</section>
      <section class="entry-box-lyrics">${entry.lyrics}</section>
      <button class="delete-btn" onclick="deleteEntry(${entry.id})">Delete Local Entry</button>
    `;
    container.appendChild(card);
  });
}

document.getElementById("entryForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const files = Array.from(document.getElementById("images").files);
  const base64Images = await Promise.all(files.map((file) => fileToBase64Resized(file)));

  const newEntry = {
    customDate: document.getElementById("customDate").value,
    author: document.getElementById("author").value,
    thoughts: document.getElementById("thoughts").value,
    lyrics: document.getElementById("lyrics").value,
    images: base64Images,
    synced: false
  };

  const db = await openDB();
  const transaction = db.transaction("entries", "readwrite");
  const store = transaction.objectStore("entries");
  store.add(newEntry);

  transaction.oncomplete = () => {
    document.getElementById("entryForm").reset();
    renderEntries();
    alert("Entry saved locally!");
  };
});

document.getElementById("syncSlidesBtn").addEventListener("click", async () => {
  const entries = await getEntries();
  const unsyncedEntries = entries.filter((entry) => entry.synced !== true);

  if (!unsyncedEntries.length) {
    alert("No new entries to sync! All entries are already in Google Slides.");
    return;
  }

  const syncBtn = document.getElementById("syncSlidesBtn");
  syncBtn.disabled = true;
  syncBtn.innerText = `Syncing ${unsyncedEntries.length} new entry/entries...`;

  unsyncedEntries.sort((a, b) => new Date(a.customDate) - new Date(b.customDate));

  for (const entry of unsyncedEntries) {
    try {
      const payload = {
        customDate: entry.customDate || "",
        author: entry.author || "",
        thoughts: entry.thoughts || "",
        lyrics: entry.lyrics || "",
        images: entry.images || []
      };

      await fetch(SLIDES_APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      await markEntryAsSynced(entry);
    } catch (err) {
      console.error("Failed item sync", err);
    }
  }

  alert("Sync completed!");
  syncBtn.disabled = false;
  syncBtn.innerText = "Sync all entries to Slides";
  renderEntries();
});

async function deleteEntry(id) {
  const db = await openDB();
  const transaction = db.transaction("entries", "readwrite");
  const store = transaction.objectStore("entries");
  store.delete(id);
  transaction.oncomplete = () => renderEntries();
}

renderEntries();
