require("dotenv").config();
const express = require('express');
const cors = require("cors");
const axios = require('axios');

const db = require('./firebase-config'); // Import Firestore config

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "https://form-question-ave.vercel.app",
    "https://naturalcleansingae.com/",
    "https://www.naturalcleansingae.com/"
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

const port = process.env.PORT || 5000;

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

// Endpoint proxy để gọi API của LarkSuite
app.post("/api/lark-data", async (req, res) => {
    try {
        const response = await axios.post(
            `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_ID}/tables/${process.env.LARK_TABLE_ID}/records`,
            { fields: req.body.fields },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer t-g2062d9mUAGOGI2WOG7HGEI2YJX64RW4PZDY3NFO`
                }
            }
        );

        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            message: "Error calling Lark API",
            error: error.response?.data || error.message
        });
    }
});


// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
