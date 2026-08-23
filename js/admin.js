import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, setDoc, startAfter, Timestamp, where } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { FIREBASE_CONFIG } from "./firebase-config.js";

const configured = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.authDomain && FIREBASE_CONFIG.projectId);
const statusBox = document.querySelector('#admin-status');
const consoleBox = document.querySelector('#admin-console');
const loginButton = document.querySelector('#admin-login');
const logoutButton = document.querySelector('#admin-logout');
const monthFilter = document.querySelector('#month-filter');
const keywordFilter = document.querySelector('#keyword-filter');
const refreshButton = document.querySelector('#refresh-data');
const exportButton = document.querySelector('#export-csv');
const restrictTmu = document.querySelector('#restrict-tmu');
const tbody = document.querySelector('#records-body');
const summary = document.querySelector('#record-summary');
const prevButton = document.querySelector('#prev-page');
const nextButton = document.querySelector('#next-page');
const pageStatus = document.querySelector('#page-status');

let auth;
let db;
let user = null;
let rows = [];
let page = 1;
const pageSize = 30;

function setStatus(message) { if (statusBox) statusBox.innerHTML = `<p>${message}</p>`; }
function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function monthBounds(value) {
  const [year, month] = value.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) };
}

async function isAdmin(uid) {
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
}

async function loadSettings() {
  const snap = await getDoc(doc(db, 'config', 'access'));
  restrictTmu.checked = snap.exists() && snap.data().restrictToTmu === true;
}

async function loadRows() {
  if (!user) return;
  const month = monthFilter.value;
  if (!month) return;
  const { start, end } = monthBounds(month);
  const q = query(collection(db, 'draws'), where('clientDrawTime', '>=', start), where('clientDrawTime', '<', end), orderBy('clientDrawTime', 'desc'), limit(1000));
  const snap = await getDocs(q);
  const keyword = keywordFilter.value.trim().toLowerCase();
  rows = snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(r => !keyword || (r.userEmail || '').toLowerCase().includes(keyword) || (r.question || '').toLowerCase().includes(keyword));
  page = 1;
  renderRows();
}

function renderRows() {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  page = Math.min(page, totalPages);
  const start = (page - 1) * pageSize;
  const visible = rows.slice(start, start + pageSize);
  tbody.innerHTML = visible.map(r => {
    const date = r.clientDrawTime?.toDate ? r.clientDrawTime.toDate() : null;
    return `<tr><td>${date ? date.toLocaleString('zh-TW') : ''}</td><td>${escapeHtml(r.userEmail || '')}</td><td class="question-cell">${escapeHtml(r.question || '')}</td><td>${escapeHtml(r.hexagramName || '')}</td></tr>`;
  }).join('');
  summary.textContent = `共 ${rows.length.toLocaleString('zh-TW')} 筆紀錄；每頁 ${pageSize} 筆。`;
  pageStatus.textContent = `第 ${page} / ${totalPages} 頁`;
  prevButton.disabled = page <= 1;
  nextButton.disabled = page >= totalPages;
}

function exportCsv() {
  const header = ['抽籤時間','使用者帳號','問題內容','卦名'];
  const escapeCsv = v => `"${String(v ?? '').replaceAll('"','""')}"`;
  const data = rows.map(r => [r.clientDrawTime?.toDate ? r.clientDrawTime.toDate().toLocaleString('zh-TW') : '', r.userEmail || '', r.question || '', r.hexagramName || '']);
  const csv = '\uFEFF' + [header, ...data].map(row => row.map(escapeCsv).join(',')).join('\r\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `student-support-${monthFilter.value || 'records'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

if (!configured) {
  setStatus('Firebase 尚未設定，因此管理後台目前停用。');
  loginButton.disabled = true;
} else {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
  const now = new Date();
  monthFilter.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  onAuthStateChanged(auth, async (nextUser) => {
    user = nextUser;
    if (!user) {
      consoleBox.hidden = true;
      loginButton.hidden = false;
      logoutButton.hidden = true;
      setStatus('請使用已授權的 Google 管理者帳號登入。');
      return;
    }
    try {
      if (!(await isAdmin(user.uid))) throw new Error('此帳號沒有後台管理權限。');
      loginButton.hidden = true;
      logoutButton.hidden = false;
      consoleBox.hidden = false;
      setStatus(`管理者已登入：${escapeHtml(user.email || '')}`);
      await loadSettings();
      await loadRows();
    } catch (error) {
      consoleBox.hidden = true;
      setStatus(error.message || '無法確認管理權限。');
    }
  });
}

loginButton?.addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt:'select_account' });
  try { await signInWithPopup(auth, provider); } catch (error) { setStatus(error.message || '登入失敗。'); }
});
logoutButton?.addEventListener('click', () => signOut(auth));
refreshButton?.addEventListener('click', loadRows);
exportButton?.addEventListener('click', exportCsv);
prevButton?.addEventListener('click', () => { if (page > 1) { page--; renderRows(); } });
nextButton?.addEventListener('click', () => { if (page * pageSize < rows.length) { page++; renderRows(); } });
restrictTmu?.addEventListener('change', async () => {
  try {
    await setDoc(doc(db, 'config', 'access'), { restrictToTmu: restrictTmu.checked }, { merge:true });
    setStatus(`管理者已登入：${escapeHtml(user.email || '')}。北醫帳號限定已${restrictTmu.checked ? '啟用' : '關閉'}。`);
  } catch (error) {
    restrictTmu.checked = !restrictTmu.checked;
    setStatus(error.message || '設定更新失敗。');
  }
});
