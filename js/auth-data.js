import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { FIREBASE_CONFIG } from "./firebase-config.js";

const configured = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.authDomain && FIREBASE_CONFIG.projectId);
let auth = null;
let db = null;
let currentUser = null;
let accessSettings = { restrictToTmu: false };
let resolveReady;
const ready = new Promise((resolve) => { resolveReady = resolve; });

function dispatchAuthState() {
  window.dispatchEvent(new CustomEvent("student-support-auth-changed", {
    detail: { user: currentUser, configured, accessSettings }
  }));
}

async function loadAccessSettings() {
  if (!db) return;
  try {
    const snapshot = await getDoc(doc(db, "config", "access"));
    if (snapshot.exists()) {
      accessSettings = {
        restrictToTmu: snapshot.data().restrictToTmu === true
      };
    }
  } catch (error) {
    console.warn("Unable to load access settings", error);
  }
}

if (configured) {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    await loadAccessSettings();
    resolveReady();
    dispatchAuthState();
  });
} else {
  resolveReady();
  dispatchAuthState();
}

window.StudentSupportAuth = {
  configured,
  ready,
  getUser: () => currentUser,
  getAccessSettings: () => ({ ...accessSettings }),
  async signIn() {
    if (!configured) throw new Error("Firebase 尚未設定完成。");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    await loadAccessSettings();
    dispatchAuthState();
    return currentUser;
  },
  async signOut() {
    if (!auth) return;
    await signOut(auth);
  },
  async saveDraw({ question, hexagramName, clientDrawTime }) {
    await ready;
    if (!db || !currentUser) throw new Error("請先使用 Google 帳號登入。");

    const email = currentUser.email || "";
    if (accessSettings.restrictToTmu && !email.toLowerCase().endsWith("@tmu.edu.tw")) {
      throw new Error("目前僅開放臺北醫學大學 @tmu.edu.tw 帳號使用。");
    }

    const expireAt = new Date(clientDrawTime);
    expireAt.setFullYear(expireAt.getFullYear() + 1);

    await addDoc(collection(db, "draws"), {
      uid: currentUser.uid,
      userEmail: email,
      question,
      hexagramName,
      clientDrawTime: Timestamp.fromDate(new Date(clientDrawTime)),
      createdAt: serverTimestamp(),
      expireAt: Timestamp.fromDate(expireAt)
    });
  }
};
