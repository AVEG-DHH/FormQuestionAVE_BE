const admin = require("firebase-admin");

// Import Service Account Key
const serviceAccount = require("./serviceAccountKey.json");

// Khởi tạo Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Kết nối Firestore
const db = admin.firestore();

module.exports = db;
