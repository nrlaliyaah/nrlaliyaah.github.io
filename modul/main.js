pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const pdfUrl = 'modul'; // Gunakan .dat agar aman dari IDM
let pdfDoc = null;
let pageFlip = null;
const renderedPages = new Set();

// Deteksi apakah layar dalam mode portrait / smartphone
function isPortraitMode() {
    return getViewportHeight() > window.innerWidth || window.innerWidth < 768;
}

// Gunakan visualViewport untuk mendapatkan tinggi layar yang BENAR-BENAR terlihat
function getViewportHeight() {
    // visualViewport.height mengecualikan address bar & tombol navigasi browser
    if (window.visualViewport) {
        return window.visualViewport.height;
    }
    return window.innerHeight;
}

// 1. Hitung Ukuran Pas di Layar
function getOptimalSize() {
    const ratio = 0.707; // Rasio standar A4
    const portrait = isPortraitMode();

    // Gunakan viewport yang benar-benar terlihat, bukan window.innerHeight
    let availableHeight = getViewportHeight() - 100;
    let availableWidth = window.innerWidth * 0.95;

    if (portrait) {
        // Mode portrait: tampilkan 1 halaman saja, manfaatkan lebar layar penuh
        let finalWidth = availableWidth;
        let finalHeight = finalWidth / ratio;

        // Pastikan tidak melebihi tinggi layar
        if (finalHeight > availableHeight) {
            finalHeight = availableHeight;
            finalWidth = finalHeight * ratio;
        }

        return {
            width: Math.floor(finalWidth),
            height: Math.floor(finalHeight)
        };
    } else {
        // Mode landscape: tampilkan 2 halaman berdampingan
        availableWidth = window.innerWidth * 0.90;

        let finalHeight = availableHeight;
        let finalWidth = finalHeight * ratio;

        // Pastikan 2 halaman muat secara horizontal
        if (finalWidth * 2 > availableWidth) {
            finalWidth = availableWidth / 2;
            finalHeight = finalWidth / ratio;
        }

        return {
            width: Math.floor(finalWidth),
            height: Math.floor(finalHeight)
        };
    }
}

// 2. Navigasi Halaman
function goToPage() {
    const pageNum = parseInt(document.getElementById('pageInput').value);
    if (pageNum > 0 && pageNum <= pdfDoc.numPages) {
        pageFlip.turnToPage(pageNum - 1);
    } else {
        alert("Halaman tidak valid!");
    }
}

// 3. Render Canvas (Lazy Load)
async function renderPage(pageNum) {
    if (renderedPages.has(pageNum)) return;
    renderedPages.add(pageNum);

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport: viewport }).promise;

    const wrapper = document.querySelector(`.page-wrapper[data-page="${pageNum}"]`);
    if (wrapper) {
        wrapper.innerHTML = '';
        wrapper.appendChild(canvas);
    }
}

// 4. Rebuild flipbook (digunakan saat orientasi berubah)
function rebuildFlipbook() {
    if (!pdfDoc) return;

    // Simpan halaman saat ini
    const currentPage = pageFlip ? pageFlip.getCurrentPageIndex() : 0;

    // Destroy instance lama
    if (pageFlip) {
        pageFlip.destroy();
        pageFlip = null;
    }

    const flipbookElement = document.getElementById('flipbook-viewport');
    flipbookElement.innerHTML = '';

    // Buat ulang page wrapper
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const div = document.createElement('div');
        div.className = 'page-wrapper';
        div.setAttribute('data-page', i);
        flipbookElement.appendChild(div);
    }

    // Reset rendered pages agar di-render ulang
    renderedPages.clear();

    const size = getOptimalSize();
    const portrait = isPortraitMode();

    pageFlip = new St.PageFlip(flipbookElement, {
        width: size.width,
        height: size.height,
        maxWidth: portrait ? size.width : size.width * 2,
        maxHeight: size.height,
        size: portrait ? "fixed" : "stretch",
        showCover: true,
        usePortrait: true, // Selalu izinkan mode 1 halaman
        maxShadowOpacity: 0.5,
        mobileScrollSupport: true // Swipe support di mobile
    });

    pageFlip.loadFromHTML(document.querySelectorAll('.page-wrapper'));

    // Render halaman di sekitar posisi saat ini
    const start = Math.max(1, currentPage);
    for (let i = start; i <= Math.min(start + 4, pdfDoc.numPages); i++) {
        renderPage(i);
    }

    // Kembali ke halaman yang sedang dibaca
    if (currentPage > 0) {
        pageFlip.turnToPage(currentPage);
    }

    // Lazy load saat membalik halaman
    pageFlip.on('flip', (e) => {
        const current = e.data + 1;
        [current, current + 1, current + 2, current + 3].forEach(p => {
            if (p <= pdfDoc.numPages) renderPage(p);
        });
    });
}

// 5. Inisialisasi pertama kali
async function initFlipbook() {
    try {
        const response = await fetch(pdfUrl);
        const dataBuffer = await response.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument({ data: dataBuffer }).promise;

        document.getElementById('main-loader').style.display = 'none';
        const flipbookElement = document.getElementById('flipbook-viewport');
        flipbookElement.style.display = 'block';

        rebuildFlipbook();

    } catch (err) {
        console.error(err);
        document.getElementById('main-loader').innerText = "Gagal memuat file.";
    }
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// Track orientasi untuk mendeteksi perubahan portrait <-> landscape
let wasPortrait = isPortraitMode();
let resizeTimer = null;

function handleResize() {
    if (!pageFlip) return;

    // Debounce agar tidak rebuild terlalu sering
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const nowPortrait = isPortraitMode();

        if (nowPortrait !== wasPortrait) {
            // Orientasi berubah → rebuild flipbook sepenuhnya
            wasPortrait = nowPortrait;
            rebuildFlipbook();
        } else {
            // Hanya resize biasa → update ukuran saja
            const size = getOptimalSize();
            pageFlip.update({ width: size.width, height: size.height });
        }
    }, 150);
}

window.addEventListener('resize', handleResize);

// visualViewport resize — dipicu saat address bar muncul/hilang di mobile
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleResize);
}

initFlipbook();
