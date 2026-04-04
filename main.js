pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const pdfUrl = 'modul'; 
let pdfDoc = null;
let pageFlip = null;
let currentZoom = 1.0; 
const renderedPages = new Set();

// --- 1. LOGIKA UKURAN & ZOOM ---
function getOptimalSize() {
    const ratio = 0.707; 
    let availableHeight = window.innerHeight * 0.80 * currentZoom;
    let finalHeight = availableHeight;
    let finalWidth = finalHeight * ratio;

    return {
        width: Math.floor(finalWidth),
        height: Math.floor(finalHeight)
    };
}

function changeZoom(delta) {
    currentZoom = Math.min(Math.max(currentZoom + delta, 0.5), 2.0); // Batas zoom 50% - 200%
    updateView();
}

function updateView() {
    if (pageFlip) {
        const size = getOptimalSize();
        pageFlip.update({
            width: size.width,
            height: size.height
        });
    }
}

// --- 2. FITUR GO TO PAGE ---
function goToPage() {
    const val = parseInt(document.getElementById('pageInput').value);
    if (val > 0 && val <= pdfDoc.numPages) {
        pageFlip.turnToPage(val - 1);
    } else {
        alert("Halaman tidak ditemukan");
    }
}

// --- 3. FITUR SEARCH TEXT (Jump to Page) ---
async function performSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    if (!query) return;

    let found = false;
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const strings = textContent.items.map(item => item.str).join(" ");
        
        if (strings.toLowerCase().includes(query)) {
            pageFlip.turnToPage(i - 1);
            found = true;
            break; // Berhenti di hasil pertama yang ditemukan
        }
    }
    if (!found) alert("Teks tidak ditemukan dalam dokumen.");
}

// --- 4. CORE ENGINE (REMAINDER) ---
async function renderPage(pageNum) {
    if (renderedPages.has(pageNum)) return;
    renderedPages.add(pageNum);
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.5 }); 
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    const wrapper = document.querySelector(`.page-wrapper[data-page="${pageNum}"]`);
    if (wrapper) { wrapper.innerHTML = ''; wrapper.appendChild(canvas); }
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
        pageFlip = new St.PageFlip(flipbookElement, {
            width: size.width, height: size.height,
            size: "stretch", showCover: true, usePortrait: false, maxShadowOpacity: 0.5
        });

        pageFlip.loadFromHTML(document.querySelectorAll('.page-wrapper'));
        for (let i = 1; i <= Math.min(4, pdfDoc.numPages); i++) renderPage(i);

        pageFlip.on('flip', (e) => {
            const current = e.data + 1;
            [current, current+1, current+2, current+3].forEach(p => {
                if (p <= pdfDoc.numPages) renderPage(p);
            });
        });

    } catch (e) { console.error(e); }
}

function toggleFullScreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
}

window.addEventListener('resize', updateView);
initFlipbook();
