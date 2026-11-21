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
  const todayDateKey = getDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const profileRef = doc(db, "users", userUid, "public", "profile");
  const snap = await getDoc(profileRef);
  const data = snap.exists() ? snap.data() : {};
  const currentStreak = data.streak || 0;
  const lastLoginDate = data.lastLogin?.toDate
    ? getDateKey(data.lastLogin.toDate())
    : null;

  console.log("[streak] profile exists:", snap.exists());
  console.log("[streak] lastLogin date:", lastLoginDate);

  if (lastLoginDate === todayDateKey) {
    return currentStreak;
  }

  if (lastLoginDate && lastLoginDate > todayDateKey) {
    console.error("[streak] Invalid future lastLogin date:", lastLoginDate);
    return currentStreak;
  }

  console.log("[streak] yesterday date:", getDateKey(yesterday));

  const verses = await loadVerses();
  const yesterdayShlokaIds = getDailySchedule(verses, yesterday).verses
    .map(({ id }) => Number(id));
  const completedShlokaIds = await getCompletedShlokaIds(userUid, getYearMonth(yesterday));
  console.log("[streak] yesterday shloka IDs:", yesterdayShlokaIds);
  console.log("[streak] completed shloka IDs from database:", completedShlokaIds);
  const isYesterdayCompleted = yesterdayShlokaIds.length === 0
    || yesterdayShlokaIds.every((id) => completedShlokaIds.includes(id));

  const streak = isYesterdayCompleted ? currentStreak + 1 : 0;

  await updateDoc(profileRef, {
    streak,
    lastLogin: serverTimestamp(),
  });
  console.log("[streak] streak check saved for:", todayDateKey);
  return streak;
}
