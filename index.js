const express = require('express');
const db = require('./firebase-config'); // Import Firestore config

const app = express();
const port = process.env.PORT || 3000;

// Middleware để parse body request thành JSON
app.use(express.json());

// API để lưu dữ liệu vào Firestore
app.post('/api/save-firestore-not-complete', async (req, res) => {
    try {
        const { userId, customerData } = req.body;

        if (!userId || !customerData) {
            return res.status(400).json({ message: 'Missing userId or customerData' });
        }

        // Lưu dữ liệu vào Firestore
        await db.collection('customer-answer-not-complete').doc(userId).set(customerData);

        return res.status(200).json({ message: 'Data saved successfully' });
    } catch (error) {
        console.error('Error saving data to Firestore:', error);
        return res.status(500).json({ message: 'Error saving data to Firestore' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
