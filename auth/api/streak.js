import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

export async function updateStreak(userUid) {
  const profileRef = doc(db, "users", userUid, "public", "profile");
  const snap = await getDoc(profileRef);

  // Temporary completion count for yesterday's two shlokas.
  const yesterdayCompletedShlokas = 2;
  const data = snap.exists() ? snap.data() : {};
  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  const previousStreak = data.streak || 0;
  if (data.lastStreakDate === today) return previousStreak;

  const streak = yesterdayCompletedShlokas === 2 ? previousStreak + 1 : 0;

  await updateDoc(profileRef, { streak, lastStreakDate: today });

  return streak;
}
