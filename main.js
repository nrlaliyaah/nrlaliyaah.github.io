pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const pdfUrl = 'draft.dat'; 
let pdfDoc = null;
let pageFlip = null;
const renderedPages = new Set();

// Fungsi hitung ukuran HANYA untuk mode 2 halaman (Landscape Style)
function getOptimalSize() {
    const ratio = 0.707; // Rasio A4
    
    // Gunakan 90% dari ruang layar yang tersedia
    let availableHeight = window.innerHeight * 0.85;
    let availableWidth = window.innerWidth * 0.90;

    // Hitung berdasarkan tinggi sebagai batas utama
    let finalHeight = availableHeight;
    let finalWidth = finalHeight * ratio;

    // Jika total lebar 2 halaman melebihi lebar layar, kecilkan berdasarkan lebar
    if (finalWidth * 2 > availableWidth) {
        finalWidth = availableWidth / 2;
        finalHeight = finalWidth / ratio;
    }

    return {
        width: Math.floor(finalWidth),
        height: Math.floor(finalHeight)
    };
}

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

async function initFlipbook() {
    try {
        const response = await fetch(pdfUrl);
        const dataBuffer = await response.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument({ data: dataBuffer }).promise;

        document.getElementById('main-loader').style.display = 'none';
        const flipbookElement = document.getElementById('flipbook-viewport');
        flipbookElement.style.display = 'block';

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const div = document.createElement('div');
            div.className = 'page-wrapper';
            div.setAttribute('data-page', i);
            flipbookElement.appendChild(div);
        }

        const size = getOptimalSize();

        // Inisialisasi TANPA mode portrait otomatis
        pageFlip = new St.PageFlip(flipbookElement, {
            width: size.width,
            height: size.height,
            size: "stretch",
            showCover: true, // Halaman 1 tetap cover tunggal di tengah
            usePortrait: false, // DIPAKSA MATI: Selalu 2 halaman
            maxShadowOpacity: 0.5
        });

        pageFlip.loadFromHTML(document.querySelectorAll('.page-wrapper'));

        for (let i = 1; i <= Math.min(4, pdfDoc.numPages); i++) renderPage(i);

        pageFlip.on('flip', (e) => {
            const current = e.data + 1;
            [current, current + 1, current + 2, current + 3].forEach(p => {
                if (p <= pdfDoc.numPages) renderPage(p);
            });
        });

    } catch (error) {
        console.error(error);
    }
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// Update ukuran hanya angka width/height saja
window.addEventListener('resize', () => {
    if (pageFlip) {
        const size = getOptimalSize();
        pageFlip.update({
            width: size.width,
            height: size.height
        });
    }
});

initFlipbook();
