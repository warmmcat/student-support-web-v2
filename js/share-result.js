'use strict';

(() => {
const resultCard = document.querySelector('#result-card');
if (!resultCard) throw new Error('找不到抽籤結果區塊。');

const shareStylesheet = document.createElement('link');
shareStylesheet.rel = 'stylesheet';
shareStylesheet.href = 'css/share-result.css?v=20260823-2';
document.head.append(shareStylesheet);

const tools = document.createElement('section');
tools.className = 'share-tools';
tools.setAttribute('aria-label', '儲存與分享抽籤結果');
tools.innerHTML = `
  <div class="share-tools-heading">
    <strong>把這份提醒留給自己</strong>
    <span>分享檔只包含卦象結果，不包含你的問題或登入帳號。</span>
  </div>
  <div class="share-tools-actions">
    <button class="button button-secondary" id="download-result-image" type="button">下載圖片 PNG</button>
    <button class="button button-secondary" id="download-result-pdf" type="button">下載 PDF</button>
    <button class="button button-primary" id="share-result" type="button">分享結果</button>
  </div>
  <p class="share-status" id="share-status" role="status" aria-live="polite"></p>`;

const reminder = resultCard.querySelector('.result-reminder');
const resultActions = resultCard.querySelector('.result-actions');
if (resultActions) resultCard.insertBefore(tools, resultActions);
else if (reminder) reminder.insertAdjacentElement('afterend', tools);
else resultCard.append(tools);

const imageButton = tools.querySelector('#download-result-image');
const pdfButton = tools.querySelector('#download-result-pdf');
const shareButton = tools.querySelector('#share-result');
const status = tools.querySelector('#share-status');

const dependencies = {
  html2canvas: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js'
};

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('share-status-error', isError);
}

function setBusy(active) {
  [imageButton, pdfButton, shareButton].forEach(button => {
    button.disabled = active;
    button.setAttribute('aria-busy', active.toString());
  });
}

function loadScript(src, readyCheck) {
  if (readyCheck()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('分享元件載入失敗。')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('分享元件載入失敗。'));
    document.head.append(script);
  });
}

async function ensureHtml2Canvas() {
  await loadScript(dependencies.html2canvas, () => typeof window.html2canvas === 'function');
}

async function ensureJsPdf() {
  await loadScript(dependencies.jspdf, () => Boolean(window.jspdf?.jsPDF));
}

function safeFileName() {
  const title = document.querySelector('#result-title')?.textContent?.trim() || '易經心靈抽籤';
  return title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 50);
}

function buildExportCard() {
  const staging = document.createElement('div');
  staging.className = 'share-export-stage';

  const exportCard = resultCard.cloneNode(true);
  exportCard.hidden = false;
  exportCard.removeAttribute('id');
  exportCard.classList.add('share-export-card');
  exportCard.querySelector('.result-actions')?.remove();
  exportCard.querySelector('.share-tools')?.remove();

  const brand = document.createElement('div');
  brand.className = 'share-export-brand';
  brand.innerHTML = '<span aria-hidden="true">心</span><strong>臺北醫學大學學生輔導中心｜心靈解籤所</strong>';
  exportCard.prepend(brand);

  const footer = document.createElement('footer');
  footer.className = 'share-export-footer';
  footer.innerHTML = '<p>這是一段支持性的自我反思文字，不是預言，也不能取代心理諮商、醫療診斷或其他專業建議。</p><p>warmmcat.github.io/student-support-web-v2/</p>';
  exportCard.append(footer);

  staging.append(exportCard);
  document.body.append(staging);
  return { staging, exportCard };
}

async function renderResultCanvas() {
  await ensureHtml2Canvas();
  if (resultCard.hidden) throw new Error('請先完成抽籤，再儲存結果。');

  const { staging, exportCard } = buildExportCard();
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    return await window.html2canvas(exportCard, {
      backgroundColor: '#fffaf3',
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 960
    });
  } finally {
    staging.remove();
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('無法建立圖片檔。')), 'image/png', 1);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadImage() {
  setBusy(true);
  setStatus('正在製作分享圖片…');
  try {
    const canvas = await renderResultCanvas();
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, `${safeFileName()}.png`);
    setStatus('圖片已建立。');
  } catch (error) {
    setStatus(error.message || '圖片建立失敗，請稍後再試。', true);
  } finally {
    setBusy(false);
  }
}

async function downloadPdf() {
  setBusy(true);
  setStatus('正在製作單頁 PDF…');
  try {
    const [canvas] = await Promise.all([renderResultCanvas(), ensureJsPdf().then(() => null)]);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - margin * 2;
    const imageRatio = canvas.width / canvas.height;
    const pageRatio = maxWidth / maxHeight;

    let imageWidth;
    let imageHeight;
    if (imageRatio > pageRatio) {
      imageWidth = maxWidth;
      imageHeight = imageWidth / imageRatio;
    } else {
      imageHeight = maxHeight;
      imageWidth = imageHeight * imageRatio;
    }

    const x = (pageWidth - imageWidth) / 2;
    const y = (pageHeight - imageHeight) / 2;
    const imageData = canvas.toDataURL('image/jpeg', 0.92);

    pdf.addImage(imageData, 'JPEG', x, y, imageWidth, imageHeight, undefined, 'FAST');
    pdf.save(`${safeFileName()}.pdf`);
    setStatus('單頁 PDF 已建立。');
  } catch (error) {
    setStatus(error.message || 'PDF 建立失敗，請稍後再試。', true);
  } finally {
    setBusy(false);
  }
}

async function shareResult() {
  setBusy(true);
  setStatus('正在準備分享檔…');
  try {
    const canvas = await renderResultCanvas();
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], `${safeFileName()}.png`, { type: 'image/png' });
    const shareData = {
      title: '學生輔導中心｜心靈解籤所',
      text: '給此刻的自己，一段溫柔的提醒。',
      files: [file]
    };

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share(shareData);
      setStatus('分享面板已開啟。');
    } else {
      downloadBlob(blob, file.name);
      setStatus('此瀏覽器不支援直接分享，已改為下載圖片；你可以從 LINE、IG 或 Threads 選取這張圖片分享。');
    }
  } catch (error) {
    if (error?.name === 'AbortError') setStatus('已取消分享。');
    else setStatus(error.message || '分享失敗，請稍後再試。', true);
  } finally {
    setBusy(false);
  }
}

imageButton.addEventListener('click', downloadImage);
pdfButton.addEventListener('click', downloadPdf);
shareButton.addEventListener('click', shareResult);
})();
