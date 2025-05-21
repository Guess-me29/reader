// scripts.js

// PDF.js setup
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const fileInput = document.getElementById("fileInput");
const pdfViewer = document.getElementById("pdfViewer");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");

let pdfDoc = null;
let currentZoom = 1.0;
let currentPdfData = null;

const DB_NAME = "BookReaderDB";
const STORE_NAME = "pdfStore";
const PDF_KEY = "savedPdf";

// IndexedDB functions

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject("DB open error");
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function savePdfToIndexedDB(pdfData) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(pdfData, PDF_KEY);
    return tx.complete || new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.error("IndexedDB save error:", err);
  }
}

async function loadPdfFromIndexedDB() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.get(PDF_KEY);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? new Uint8Array(result) : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB load error:", err);
    return null;
  }
}

// PDF rendering functions

async function loadPdf(data) {
  try {
    pdfDoc = await pdfjsLib.getDocument(data).promise;
    renderAllPages();
  } catch (err) {
    console.error("Error loading PDF:", err);
  }
}

function clearViewer() {
  pdfViewer.innerHTML = "";
}

async function renderAllPages() {
  clearViewer();
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    await renderPage(i);
  }
}

async function renderPage(pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: currentZoom });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
  };

  await page.render(renderContext).promise;

  const pageContainer = document.createElement("div");
  pageContainer.className = "page-container";
  pageContainer.appendChild(canvas);
  pdfViewer.appendChild(pageContainer);
}

// Event handlers

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file || file.type !== "application/pdf") {
    alert("Please upload a valid PDF file");
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    currentPdfData = new Uint8Array(reader.result);
    await savePdfToIndexedDB(currentPdfData);
    await loadPdf(currentPdfData);
  };
  reader.readAsArrayBuffer(file);
});

zoomInBtn.addEventListener("click", async () => {
  currentZoom = Math.min(currentZoom + 0.2, 3);
  if (pdfDoc) await renderAllPages();
});

zoomOutBtn.addEventListener("click", async () => {
  currentZoom = Math.max(currentZoom - 0.2, 0.5);
  if (pdfDoc) await renderAllPages();
});

// Load PDF from IndexedDB on page load if available
window.addEventListener("load", async () => {
  const savedPdf = await loadPdfFromIndexedDB();
  if (savedPdf) {
    currentPdfData = savedPdf;
    await loadPdf(savedPdf);
  }
});
