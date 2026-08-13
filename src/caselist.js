import { ref, get, update, set as dbSet } from "firebase/database";
import { db } from "./firebase.js";
import { uid } from "./utils.js";

// Excludes visually ambiguous characters (0/O, 1/I) so codes are easy to
// read aloud or copy off a screen.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeJoinCode() {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export function normalizeCaselistName(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function memberRecord(user, role) {
  return {
    displayName: user.displayName || user.email || "member",
    email: user.email || "",
    photoURL: user.photoURL || "",
    role,
    joinedAt: Date.now(),
  };
}

// Creates a new caselist, adds the creator as its owner, and reserves the
// caselist's name in the global name index — all in one atomic multi-path
// update, so a failed write can never leave a half-created caselist behind.
export async function createCaselist(user, rawName) {
  const name = (rawName || "").trim();
  if (!name) throw new Error("give your caselist a name");
  const nameLower = normalizeCaselistName(name);

  const existing = await get(ref(db, `caselistNameIndex/${nameLower}`));
  if (existing.exists()) throw new Error("that caselist name is already taken — try another");

  const caselistId = uid();
  const joinCode = makeJoinCode();
  const now = Date.now();

  await update(ref(db), {
    [`caselists/${caselistId}/meta`]: {
      name,
      nameLower,
      joinCode,
      ownerUid: user.uid,
      ownerName: user.displayName || user.email || "owner",
      createdAt: now,
    },
    [`caselists/${caselistId}/members/${user.uid}`]: memberRecord(user, "owner"),
    [`caselistNameIndex/${nameLower}`]: caselistId,
    [`userCaselists/${user.uid}/${caselistId}`]: { name, role: "owner", joinedAt: now },
  });

  return { caselistId, joinCode, name };
}

// Looks the caselist up by name, then attempts to add the joiner as a
// member. The join code is submitted alongside the membership write in the
// same atomic update — the database rules compare it against the stored
// code server-side and reject the whole update if it's wrong, without ever
// exposing the real code to a client that hasn't already joined.
export async function joinCaselist(user, rawName, rawCode) {
  const nameLower = normalizeCaselistName(rawName);
  const code = (rawCode || "").trim().toUpperCase();
  if (!nameLower) throw new Error("enter the caselist name");
  if (!code) throw new Error("enter the join code");

  const snap = await get(ref(db, `caselistNameIndex/${nameLower}`));
  if (!snap.exists()) throw new Error("no caselist found with that name");
  const caselistId = snap.val();
  const now = Date.now();

  try {
    await update(ref(db), {
      [`caselists/${caselistId}/members/${user.uid}`]: memberRecord(user, "member"),
      [`caselists/${caselistId}/joinAttempts/${user.uid}`]: code,
      [`userCaselists/${user.uid}/${caselistId}`]: { name: rawName.trim(), role: "member", joinedAt: now },
    });
  } catch (e) {
    throw new Error("wrong join code");
  }

  return { caselistId };
}

export async function leaveCaselist(user, caselistId) {
  await update(ref(db), {
    [`caselists/${caselistId}/members/${user.uid}`]: null,
    [`userCaselists/${user.uid}/${caselistId}`]: null,
  });
}

// Only the owner can call this (enforced by rules). It removes the target's
// access immediately. It can't also clear that person's own userCaselists
// entry — rules only let a user write their own index — so their browser
// will just find the caselist inaccessible next time it tries to load it.
export async function removeMember(caselistId, memberUid) {
  await dbSet(ref(db, `caselists/${caselistId}/members/${memberUid}`), null);
}

export async function regenerateJoinCode(caselistId) {
  const code = makeJoinCode();
  await dbSet(ref(db, `caselists/${caselistId}/meta/joinCode`), code);
  return code;
}

// One-time helper for teams upgrading from the pre-caselist version of the
// app, where every case lived at a single shared casesById root. Copies
// that flat data into a newly created caselist; the original is left
// untouched so nothing is destroyed if something goes wrong.
export async function importLegacyCases(caselistId) {
  const snap = await get(ref(db, "casesById"));
  const obj = snap.val();
  if (!obj) return 0;
  const updates = {};
  Object.entries(obj).forEach(([caseId, raw]) => {
    updates[`caselists/${caselistId}/casesById/${caseId}`] = raw;
  });
  await update(ref(db), updates);
  return Object.keys(obj).length;
}
