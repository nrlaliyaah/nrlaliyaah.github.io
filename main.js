// Konfigurasi Worker PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const pdfUrl = 'modul'; // Gunakan .dat agar tidak terdeteksi IDM
let pdfDoc = null;
let pageFlip = null;
const renderedPages = new Set();

// 1. Fungsi Hitung Ukuran Dinamis
function getOptimalSize() {
    const ratio = 0.707; // Rasio A4
    const isPortrait = window.innerHeight > window.innerWidth || window.innerWidth < 700;

    // Beri margin agar tidak mentok (85% dari tinggi layar)
    let availableHeight = window.innerHeight * 0.85;
    let availableWidth = window.innerWidth * 0.90;

    let finalHeight, finalWidth;

    if (isPortrait) {
        finalWidth = availableWidth;
        finalHeight = finalWidth / ratio;
        if (finalHeight > availableHeight) {
            finalHeight = availableHeight;
            finalWidth = finalHeight * ratio;
        }
    } else {
        finalHeight = availableHeight;
        finalWidth = finalHeight * ratio;
        if (finalWidth * 2 > availableWidth) {
            finalWidth = availableWidth / 2;
            finalHeight = finalWidth / ratio;
        }
    }

    return {
        width: Math.floor(finalWidth),
        height: Math.floor(finalHeight),
        isPortrait: isPortrait
    };
}

// 2. Fungsi Render Halaman (Lazy Load)
async function renderPage(pageNum) {
    if (renderedPages.has(pageNum)) return;
    renderedPages.add(pageNum);

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.5 }); // Skala tinggi agar tajam

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

// 3. Inisialisasi Utama
async function initFlipbook() {
    try {
        // Mengambil PDF sebagai ArrayBuffer (Proteksi Auto-Download)
        const response = await fetch(pdfUrl);
        const dataBuffer = await response.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument({ data: dataBuffer }).promise;

        document.getElementById('main-loader').style.display = 'none';
        const flipbookElement = document.getElementById('flipbook-viewport');
        flipbookElement.style.display = 'block';

        // Buat elemen halaman kosong
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const div = document.createElement('div');
            div.className = 'page-wrapper';
            div.setAttribute('data-page', i);
            div.innerHTML = `<div class="page-loader">Memuat...</div>`;
            flipbookElement.appendChild(div);
        }

        const size = getOptimalSize();

        // Setup StPageFlip
        pageFlip = new St.PageFlip(flipbookElement, {
            width: size.width,
            height: size.height,
            size: "stretch",
            showCover: true,
            usePortrait: true,
            mode: size.isPortrait ? 'portrait' : 'landscape',
            maxShadowOpacity: 0.5
        });

        pageFlip.loadFromHTML(document.querySelectorAll('.page-wrapper'));

        // Render halaman awal
        for (let i = 1; i <= Math.min(3, pdfDoc.numPages); i++) renderPage(i);

        // Event Lazy Load saat balik halaman
        pageFlip.on('flip', (e) => {
            const current = e.data + 1;
            [current, current + 1, current + 2].forEach(p => {
                if (p <= pdfDoc.numPages) renderPage(p);
            });
        });

    } catch (error) {
        console.error("Gagal memuat flipbook:", error);
        document.getElementById('main-loader').innerText = "Gagal memuat dokumen.";
    }
}

// 4. Fungsi Fullscreen & Resize
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

window.addEventListener('resize', () => {
    if (pageFlip) {
        const size = getOptimalSize();
        pageFlip.update({
            width: size.width,
            height: size.height,
            mode: size.isPortrait ? 'portrait' : 'landscape'
        });
    }
});

// Jalankan
initFlipbook();