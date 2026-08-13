import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBcrxF7ALsihnj9XVboj7fzPLVVauyFmLs",
  authDomain: "gooesbrief.firebaseapp.com",
  databaseURL: "https://gooesbrief-default-rtdb.firebaseio.com",
  projectId: "gooesbrief",
  storageBucket: "gooesbrief.firebasestorage.app",
  messagingSenderId: "43371193199",
  appId: "1:43371193199:web:3e8b77015277703041be9a",
  measurementId: "G-WPNLPZBMPV",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

// Every read/write in this app is scoped to a caselist the signed-in user
// is a member of (see database.rules.json). Google sign-in is what lets
// the security rules know who's asking, and lets caselist owners see real
// names in the members list instead of an anonymous session id.
export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signOutOfGoogle() {
  return signOut(auth);
}
