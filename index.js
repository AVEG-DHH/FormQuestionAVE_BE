require("dotenv").config();
const express = require('express');
const cors = require("cors");
const axios = require('axios');
// const db = require('./firebase-config');

const port = process.env.PORT || 5000;
let LARK_ACCESS_TOKEN = ""; // Lưu token toàn cục

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


// Middleware để parse body request thành JSON
app.use(express.json());

// API để lưu dữ liệu vào Firestore
// app.post('/api/save-firestore-not-complete', async (req, res) => {
//     try {
//         const { userId, customerData } = req.body;

//         if (!userId || !customerData) {
//             return res.status(400).json({ message: 'Missing userId or customerData' });
//         }

//         // Lưu dữ liệu vào Firestore
//         await db.collection('customer-answer-not-complete').doc(userId).set(customerData);

//         return res.status(200).json({ message: 'Data saved successfully' });
//     } catch (error) {
//         console.error('Error saving data to Firestore:', error);
//         return res.status(500).json({ message: 'Error saving data to Firestore' });
//     }
// });

async function fetchLarkToken() {
    try {
        const response = await axios.post(process.env.LARK_URL_GET_TOKEN, {
            app_id: process.env.LARK_APP_ID,
            app_secret: process.env.LARK_APP_SECRET
        });

        LARK_ACCESS_TOKEN = response.data.tenant_access_token;
    } catch (error) {
        console.error("Lỗi lấy token:", error.response?.data || error.message);
    }
}

// 📌 Gọi token ngay khi server khởi động & tự động làm mới mỗi 1h50 phút
(async function startTokenRefresh() {
    await fetchLarkToken();
    setInterval(fetchLarkToken, 1000 * 60 * 110); // 110 phút (1h50 phút)
})();

// 📌 API proxy để gọi Lark API
app.post("/api/lark-data", async (req, res) => {
    try {
        const response = await sendLarkRequest(req.body.fields);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            message: "Error calling Lark API",
            error: error.response?.data || error.message
        });
    }
});

// 📌 Hàm gửi request tới Lark, tự động cập nhật token nếu hết hạn
async function sendLarkRequest(fields) {
    try {
        return await axios.post(
            `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN}/tables/${process.env.LARK_TABLE_ID}/records`,
            { fields },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${LARK_ACCESS_TOKEN}`
                }
            }
        );
    } catch (error) {
        // 📌 Nếu token hết hạn (code: 99991663), lấy token mới rồi thử lại
        if (error.response?.data?.code === 99991663) {
            await fetchLarkToken();
            return sendLarkRequest(fields); // Gọi lại request sau khi có token mới
        }
        throw error;
    }
}

app.post("/api/lark-data-not-complete", async (req, res) => {
    try {
        const response = await sendLarkRequestNotComplete(req.body.fields);
        res.status(response.status).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            message: "Error calling Lark API",
            error: error.response?.data || error.message
        });
    }
});

// 📌 Hàm gửi request tới Lark, tự động cập nhật token nếu hết hạn
async function sendLarkRequestNotComplete(fields) {
    try {
        return await axios.post(
            `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN}/tables/${process.env.LARK_TABLE_ID_NOT_COMPLETE}/records`,
            { fields },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${LARK_ACCESS_TOKEN}`
                }
            }
        );
    } catch (error) {
        // 📌 Nếu token hết hạn (code: 99991663), lấy token mới rồi thử lại
        if (error.response?.data?.code === 99991663) {
            await fetchLarkToken();
            return sendLarkRequest(fields); // Gọi lại request sau khi có token mới
        }
        throw error;
    }
}

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
