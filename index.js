require("dotenv").config();

const { google } = require('googleapis');

const spreadsheetId = '15uz68axwL8hFysYVPvJrpwHYopU4tOnxrL0jziuf3lA';
const sheetName = 'LarkbaseEmail_New';

const refreshTokenLark = require('./src/tokens/refreshTokenLark');

const express = require('express');
const cors = require("cors");
const axios = require('axios');

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

let LARK_ACCESS_TOKEN = "t-g2063d1xE4FTBGJHGSENQDJFP2BHUGR6QUJ5TONM"; // Lưu token toàn cục

// 📌 API proxy để gọi Lark API
app.post("/api/lark-data", async (req, res) => {
    try {
        const response = await sendLarkRequest(req.body.fields);
        res.status(response.status).json(response.data);

        await writeToGoogleSheet(req.body.fields);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            message: "Error calling Lark API",
            error: error.response?.data || error.message
        });
    }
});

async function writeToGoogleSheet(data) {
    try {
        const credentialsGGSheet = {
            type: process.env.GOOGLE_SERVICE_ACCOUNT_TYPE,
            project_id: process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID,
            private_key_id: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
            private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'), // Replace escaped newlines
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
            client_id: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID,
            auth_uri: process.env.GOOGLE_SERVICE_ACCOUNT_AUTH_URI,
            token_uri: process.env.GOOGLE_SERVICE_ACCOUNT_TOKEN_URI,
            auth_provider_x509_cert_url: process.env.GOOGLE_SERVICE_ACCOUNT_AUTH_PROVIDER_X509_CERT_URL,
            client_x509_cert_url: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_X509_CERT_URL,
            universe_domain: process.env.GOOGLE_SERVICE_ACCOUNT_UNIVERSE_DOMAIN,
        };
        const auth = new google.auth.GoogleAuth({
            credentials: credentialsGGSheet,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        const values = [Object.values(data)];

        const resource = {
            values,
        };

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource,
        });

        console.log('Dữ liệu đã được ghi vào Google Sheet:', response.data);
        return response;
    } catch (error) {
        console.error('Lỗi khi ghi vào Google Sheet:', error);
        throw error;
    }
}

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

        await writeToGoogleSheetNotComplete(req.body.fields);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            message: "Error calling Lark API",
            error: error.response?.data || error.message
        });
    }
});

async function writeToGoogleSheetNotComplete(data) {
    try {
        const credentialsGGSheet = {
            type: process.env.GOOGLE_SERVICE_ACCOUNT_TYPE,
            project_id: process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID,
            private_key_id: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
            private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'), // Replace escaped newlines
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
            client_id: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID,
            auth_uri: process.env.GOOGLE_SERVICE_ACCOUNT_AUTH_URI,
            token_uri: process.env.GOOGLE_SERVICE_ACCOUNT_TOKEN_URI,
            auth_provider_x509_cert_url: process.env.GOOGLE_SERVICE_ACCOUNT_AUTH_PROVIDER_X509_CERT_URL,
            client_x509_cert_url: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_X509_CERT_URL,
            universe_domain: process.env.GOOGLE_SERVICE_ACCOUNT_UNIVERSE_DOMAIN,
        };
        const auth = new google.auth.GoogleAuth({
            credentials: credentialsGGSheet,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        const values = [Object.values(data)];

        const resource = {
            values,
        };

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `LarkbaseEmail_Undone_New!A1`,
            valueInputOption: 'USER_ENTERED',
            resource,
        });

        console.log('Dữ liệu đã được ghi vào Google Sheet:', response.data);
        return response;
    } catch (error) {
        console.error('Lỗi khi ghi vào Google Sheet:', error);
        throw error;
    }
}

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

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
