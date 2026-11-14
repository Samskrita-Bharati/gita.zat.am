import {
  doc,
  getDoc,
  updateDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

export async function updateStreak(userUid) {
  const profileRef = doc(db, "users", userUid, "public", "profile");
  const snap = await getDoc(profileRef);

  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  const dayNumber = (dateKey) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
  };

  let streak = 1;
  let lastLoginDate = null;

  if (snap.exists()) {
    const data = snap.data();
    streak = data.streak || 1;
    lastLoginDate = data.lastLoginDate || null;

    // Read existing timestamp records while accounts transition to date keys.
    if (!lastLoginDate && data.lastLogin?.toDate) {
      const legacy = data.lastLogin.toDate();
      lastLoginDate = [legacy.getFullYear(), String(legacy.getMonth() + 1).padStart(2, "0"), String(legacy.getDate()).padStart(2, "0")].join("-");
    }
  }

  if (lastLoginDate) {
    const diffDays = dayNumber(today) - dayNumber(lastLoginDate);
    if (diffDays === 1) streak += 1;
    else if (diffDays > 1) streak = 1;
    else if (diffDays <= 0) {
      // A second login on the same date leaves the streak unchanged.
      return streak;
    }
  }

  await updateDoc(profileRef, {
    streak,
    lastLoginDate: today,
    lastLogin: Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate())),
  });

  return streak;
}