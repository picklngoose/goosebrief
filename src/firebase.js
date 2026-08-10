import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

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
