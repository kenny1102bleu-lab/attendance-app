// Firebase設定
// 謙一さんのFirebaseプロジェクトの設定値をここに入れてください
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // TODO: 謙一さんのFirebaseプロジェクトの設定値に差し替え
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

let app = null;
let db = null;

export function initFirebase(config) {
  if (config && config.apiKey) {
    app = initializeApp(config);
    db = getFirestore(app);
  }
  return { app, db };
}

export function getDb() {
  return db;
}

export function isFirebaseReady() {
  return db !== null;
}
