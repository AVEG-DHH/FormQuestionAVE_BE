const axios = require('axios');

const refreshTokenCJ = async () => {
    try {
        const response = await axios.post(process.env.CJ_URL_GET_TOKEN, {
            email: process.env.CJ_EMAIL,
            password: process.env.CJ_PASSWORD
        });

        return response.data.data.accessToken;
    } catch (error) {
        console.error("Lỗi lấy token:", error.response?.data || error.message);
    }
};

module.exports = refreshTokenCJ;
