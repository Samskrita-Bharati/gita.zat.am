import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { getDailySchedule } from "../../shlokasToday/daily-schedule.mjs";
import { db, serverTimestamp } from "./firebase-config.js";

const versesUrl = new URL("../../assets/bhagavad-gita-verses.json", import.meta.url);

async function loadVerses() {
  const response = await fetch(versesUrl);
  if (!response.ok) {
    throw new Error(`Verse data request failed: ${response.status}`);
  }
  return response.json();
}

function getDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getYearMonth(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function getCompletedShlokaIds(userUid, yearMonth) {
  const progressRef = doc(db, "shlokaProgress", `${userUid}_${yearMonth}`);
  const progressSnap = await getDoc(progressRef);
  const completedShlokas = progressSnap.exists()
    ? progressSnap.data().completedShlokas
    : [];

  return Array.isArray(completedShlokas) ? completedShlokas : [];
}

export async function updateStreak(userUid) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const profileRef = doc(db, "users", userUid, "public", "profile");
  const snap = await getDoc(profileRef);
  const data = snap.exists() ? snap.data() : {};

  console.log("[streak] profile exists:", snap.exists());
  console.log("[streak] lastStreakDate before check:", data.lastStreakDate ?? null);

  if (data.lastStreakDate === getDateKey(today)) {
    return data.streak || 0;
  }

  console.log("[streak] yesterday date:", getDateKey(yesterday));

  const verses = await loadVerses();
  const yesterdayShlokaIds = getDailySchedule(verses, yesterday).verses
    .map(({ id }) => Number(id));
  const completedShlokaIds = await getCompletedShlokaIds(userUid, getYearMonth(yesterday));
  console.log("[streak] yesterday shloka IDs:", yesterdayShlokaIds);
  console.log("[streak] completed shloka IDs from database:", completedShlokaIds);
  const isYeasterdayCompleted = yesterdayShlokaIds.length === 0
    || yesterdayShlokaIds.every((id) => completedShlokaIds.includes(id));

  const streak = isYeasterdayCompleted && data.lastStreakDate === getDateKey(yesterday)
    ? (data.streak || 0) + 1
    : 0;

  await updateDoc(profileRef, {
    streak,
    lastStreakDate: getDateKey(today),
    lastLogin: serverTimestamp(),
  });
  console.log("[streak] lastStreakDate saved:", getDateKey(today));
  return streak;
}
