import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

export async function updateStreak(userUid) {
  const profileRef = doc(db, "users", userUid, "public", "profile");
  const snap = await getDoc(profileRef);
  const data = snap.exists() ? snap.data() : {};

  // Temporary completion count for yesterday's two shlokas.
  const yesterdayCompletedShlokas = 2;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateKey = (date) =>
    [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

  if (data.lastStreakDate === dateKey(today)) return data.streak || 0;

  const streak = yesterdayCompletedShlokas === 2 && data.lastStreakDate === dateKey(yesterday)
    ? (data.streak || 0) + 1
    : 0;

  await updateDoc(profileRef, { streak, lastStreakDate: dateKey(today) });
  return streak;
}
