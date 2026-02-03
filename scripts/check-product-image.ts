import { initializeApp } from "firebase/app";
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD_HhqKxoJexjYkp5Y4uQ-J9VqZxGYGQqE",
  authDomain: "super-fitt.firebaseapp.com",
  projectId: "super-fitt",
  storageBucket: "super-fitt.firebasestorage.app",
  messagingSenderId: "1018990726513",
  appId: "1:1018990726513:web:b7c8f8e8c8c8c8c8c8c8c8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkProduct() {
  try {
    console.log("🔍 Checking product SK-ML-003...");

    const q = query(
      collection(db, "products"),
      where("productId", "==", "SK-ML-003"),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();

      console.log("\n📦 Product found!");
      console.log("Document ID:", doc.id);
      console.log("\n📋 All fields:", Object.keys(data).join(", "));
      console.log("\n🖼️ Image fields:");
      console.log("  - imageURL:", data.imageURL || "NOT FOUND");
      console.log("  - imageUrl:", data.imageUrl || "NOT FOUND");

      if (data.imageURL) {
        console.log("\n✅ Has imageURL (old field)");
        console.log("URL:", data.imageURL);
      }
      if (data.imageUrl) {
        console.log("\n✅ Has imageUrl (new field)");
        console.log("URL:", data.imageUrl);
      }
    } else {
      console.log("❌ Product SK-ML-003 not found");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkProduct();
