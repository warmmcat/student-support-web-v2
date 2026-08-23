'use strict';

const drawStylesheet = document.createElement('link');
drawStylesheet.rel = 'stylesheet';
drawStylesheet.href = 'css/draw.css?v=20260823-1';
document.head.append(drawStylesheet);

const v2Stylesheet = document.createElement('link');
v2Stylesheet.rel = 'stylesheet';
v2Stylesheet.href = 'css/v2.css?v=20260823-1';
document.head.append(v2Stylesheet);

const authModule = document.createElement('script');
authModule.type = 'module';
authModule.src = 'js/auth-data.js?v=20260823-1';
document.head.append(authModule);

const shareModule = document.createElement('script');
shareModule.src = 'js/share-result.js?v=20260823-6';
shareModule.defer = true;
document.head.append(shareModule);

const yearTarget = document.querySelector('#current-year');
const drawButton = document.querySelector('#draw-button');
const drawAgainButton = document.querySelector('#draw-again-button');
const drawAnimation = document.querySelector('#draw-animation');
const resultCard = document.querySelector('#result-card');
const resultNumber = document.querySelector('#result-number');
const resultTitle = document.querySelector('#result-title');
const resultDescription = document.querySelector('#result-description');
const resultLove = document.querySelector('#result-love');
const resultStudy = document.querySelector('#result-study');
const resultRelationships = document.querySelector('#result-relationships');
const resultStress = document.querySelector('#result-stress');
const resultMessage = document.querySelector('#result-message');
const drawIntro = document.querySelector('.draw-intro');
const drawNotice = document.querySelector('.draw-notice');

if (yearTarget) yearTarget.textContent = new Date().getFullYear().toString();

let previousIndex = -1;
let isDrawing = false;
let authUser = null;

const gate = document.createElement('div');
gate.className = 'draw-gate';
gate.innerHTML = `
  <section class="login-card" aria-labelledby="login-title">
    <div>
      <h3 id="login-title">先登入，再為自己抽一卦</h3>
      <p id="login-status">正在確認登入狀態…</p>
    </div>
    <div class="login-actions">
      <button class="button button-secondary" id="google-login-button" type="button">使用 Google 帳號登入</button>
      <button class="text-button" id="google-logout-button" type="button" hidden>登出</button>
    </div>
  </section>
  <div class="question-field">
    <label for="draw-question"><strong>此刻，你最想問的是什麼？</strong></label>
    <p>可以寫下正在困擾你的事情、想釐清的念頭，或此刻最想獲得提醒的問題。</p>
    <textarea id="draw-question" maxlength="5000" rows="8" placeholder="請在這裡寫下你的問題…" disabled></textarea>
    <div class="question-meta"><span id="question-helper">登入後即可輸入問題。</span><span id="question-counter">0 / 5,000</span></div>
  </div>`;

if (drawIntro && drawNotice) drawIntro.insertBefore(gate, drawNotice);

const loginButton = document.querySelector('#google-login-button');
const logoutButton = document.querySelector('#google-logout-button');
const loginStatus = document.querySelector('#login-status');
const questionInput = document.querySelector('#draw-question');
const questionCounter = document.querySelector('#question-counter');
const questionHelper = document.querySelector('#question-helper');

function showMessage(message, isError = false) {
  if (!questionHelper) return;
  questionHelper.textContent = message;
  questionHelper.classList.toggle('field-error', isError);
}

function updateEligibility() {
  const hasQuestion = Boolean(questionInput?.value.trim());
  const eligible = Boolean(authUser && hasQuestion && !isDrawing);
  if (drawButton) drawButton.disabled = !eligible;
  if (drawAgainButton) drawAgainButton.disabled = !eligible;
}

function renderAuthState(detail = {}) {
  authUser = detail.user || null;
  const configured = detail.configured !== false;
  const restricted = detail.accessSettings?.restrictToTmu === true;

  if (!configured) {
    if (loginStatus) loginStatus.textContent = '2.0 後端尚未完成 Firebase 設定。';
    if (loginButton) loginButton.disabled = true;
    if (questionInput) questionInput.disabled = true;
    showMessage('管理者完成 Firebase 設定後即可登入使用。', true);
    updateEligibility();
    return;
  }

  if (authUser) {
    if (loginStatus) loginStatus.textContent = `已登入：${authUser.email || 'Google 使用者'}${restricted ? '（目前限 @tmu.edu.tw）' : ''}`;
    if (loginButton) loginButton.hidden = true;
    if (logoutButton) logoutButton.hidden = false;
    if (questionInput) questionInput.disabled = false;
    showMessage('請先寫下問題，才能按下抽籤鍵。');
  } else {
    if (loginStatus) loginStatus.textContent = restricted ? '目前僅開放 @tmu.edu.tw Google 帳號。' : '需使用 Google 帳號登入才能抽籤。';
    if (loginButton) {
      loginButton.hidden = false;
      loginButton.disabled = false;
    }
    if (logoutButton) logoutButton.hidden = true;
    if (questionInput) questionInput.disabled = true;
    showMessage('登入後即可輸入問題。');
  }
  updateEligibility();
}

window.addEventListener('student-support-auth-changed', (event) => renderAuthState(event.detail));

loginButton?.addEventListener('click', async () => {
  try {
    loginButton.disabled = true;
    await window.StudentSupportAuth?.signIn();
  } catch (error) {
    showMessage(error.message || 'Google 登入失敗，請稍後再試。', true);
  } finally {
    loginButton.disabled = false;
  }
});

logoutButton?.addEventListener('click', async () => {
  await window.StudentSupportAuth?.signOut();
  if (questionInput) questionInput.value = '';
  if (questionCounter) questionCounter.textContent = '0 / 5,000';
});

questionInput?.addEventListener('input', () => {
  const count = questionInput.value.length;
  if (questionCounter) questionCounter.textContent = `${count.toLocaleString('zh-TW')} / 5,000`;
  showMessage(count > 0 ? '問題已準備好，可以抽籤。' : '請先寫下問題，才能按下抽籤鍵。', count === 0);
  updateEligibility();
});

function getRandomIndex(length) {
  if (length <= 1) return 0;
  let index;
  if (window.crypto && window.crypto.getRandomValues) {
    const randomValue = new Uint32Array(1);
    do {
      window.crypto.getRandomValues(randomValue);
      index = randomValue[0] % length;
    } while (index === previousIndex);
  } else {
    do index = Math.floor(Math.random() * length); while (index === previousIndex);
  }
  return index;
}

function formatSection(text, category) {
  if (typeof text !== 'string') return '';
  const cleaned = text.trim().replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '');
  const prefix = `${category}：`;
  return cleaned.startsWith(prefix) ? cleaned.slice(prefix.length).trim() : cleaned;
}

function setResultContent(target, text, category) {
  if (target) target.textContent = formatSection(text, category);
}

function setDrawingState(active) {
  isDrawing = active;
  if (drawButton) {
    drawButton.textContent = active ? '正在抽取一卦…' : '靜心後，抽一卦';
    drawButton.setAttribute('aria-busy', active.toString());
  }
  if (drawAgainButton) {
    drawAgainButton.textContent = active ? '正在抽取…' : '再抽一卦';
    drawAgainButton.setAttribute('aria-busy', active.toString());
  }
  updateEligibility();
}

function revealHexagram(hexagram) {
  resultNumber.textContent = `第 ${hexagram.number} 卦`;
  resultTitle.textContent = hexagram.name;
  setResultContent(resultDescription, hexagram.description, '說明');
  setResultContent(resultLove, hexagram.love, '關於感情');
  setResultContent(resultStudy, hexagram.study, '關於課業');
  setResultContent(resultRelationships, hexagram.relationships, '關於人際');
  setResultContent(resultStress, hexagram.stress, '壓力調適');
  setResultContent(resultMessage, hexagram.message, '給同學的一句話');
  if (drawAnimation) drawAnimation.hidden = true;
  resultCard.hidden = false;
  setDrawingState(false);
  window.requestAnimationFrame(() => {
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    resultTitle.focus({ preventScroll: true });
  });
}

async function drawHexagram() {
  const question = questionInput?.value.trim() || '';
  if (isDrawing || !authUser || !question || !Array.isArray(window.HEXAGRAMS) || window.HEXAGRAMS.length !== 64) {
    showMessage(!authUser ? '請先登入 Google 帳號。' : '請先寫下你想問的問題。', true);
    return;
  }

  const index = getRandomIndex(window.HEXAGRAMS.length);
  const hexagram = window.HEXAGRAMS[index];
  const clientDrawTime = new Date();

  setDrawingState(true);
  resultCard.hidden = true;

  try {
    await window.StudentSupportAuth.saveDraw({ question, hexagramName: hexagram.name, clientDrawTime });
  } catch (error) {
    setDrawingState(false);
    showMessage(error.message || '抽籤紀錄無法安全儲存，因此本次未進行抽籤。', true);
    return;
  }

  previousIndex = index;
  if (drawAnimation) {
    drawAnimation.hidden = false;
    window.requestAnimationFrame(() => drawAnimation.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  window.setTimeout(() => revealHexagram(hexagram), 3000);
}

if (resultTitle) resultTitle.tabIndex = -1;
drawButton?.addEventListener('click', drawHexagram);
drawAgainButton?.addEventListener('click', drawHexagram);
updateEligibility();
