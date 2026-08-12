import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

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

const auth = getAuth(app);

// The database rules require auth != null. This is anonymous sign-in, not
// per-person identity — every visitor gets an interchangeable session — it
// exists purely so raw REST/script requests to the database URL get
// rejected while the app itself (which signs in automatically) still works.
// The TEAM_PASSCODE gate in App.jsx is the layer that actually controls who
// uses the app; this just stops requests that skip the app entirely.
export const authReady = new Promise((resolve, reject) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    unsubscribe();
    if (user) {
      resolve(user);
      return;
    }
    signInAnonymously(auth)
      .then((cred) => resolve(cred.user))
      .catch(reject);
  });
});
