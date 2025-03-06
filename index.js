require("dotenv").config();

const getProductShopyfiEtsohome = require('./src/functions/getProductShopyfiEtsohome');
const getCustomerShopyfiEtsohome = require('./src/functions/getCustomerShopyfiEtsohome');
const refreshTokenLark = require('./src/tokens/refreshTokenLark');

const express = require('express');
const cors = require("cors");
const axios = require('axios');
const cron = require("node-cron");

const port = process.env.PORT || 5000;

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

let LARK_ACCESS_TOKEN = "t-g2062ocbLXY5RKU2XQHZLOM453LBBUWZ7KHMQZIR"; // Lưu token toàn cục

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
            `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN_TRUONG29102000}/tables/${process.env.LARK_TABLE_ID_COMPLETED_TRUONG29102000}/records`,
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
        if (error.response?.data?.code === 99991663 || error.response?.data?.code === 99991661 || error.response?.data?.code === 99991668) {
            LARK_ACCESS_TOKEN = await refreshTokenLark();
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
            `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN_TRUONG29102000}/tables/${process.env.LARK_TABLE_ID_NOT_COMPLETED_TRUONG29102000}/records`,
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
        if (error.response?.data?.code === 99991663 || error.response?.data?.code === 99991661 || error.response?.data?.code === 99991668) {
            LARK_ACCESS_TOKEN = await refreshTokenLark();
            return sendLarkRequestNotComplete(fields);
        }
        throw error;
    }
}

// BASECOST CJ
const backupDataCJ = async () => {
    console.log("Now time update!");

    console.log("--------Etsohome--------");
    // Lấy data sản phẩm từ Shopyfi Etsohome
    // await getProductShopyfiEtsohome();
    // // Lấy data khách hàng từ Shopyfi Etsohome
    // await getCustomerShopyfiEtsohome();
    // // Lấy data đơn hàng từ Shopyfi Etsohome
};

cron.schedule("15 0 * * *", backupDataCJ, {
    timezone: "Asia/Ho_Chi_Minh",
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
