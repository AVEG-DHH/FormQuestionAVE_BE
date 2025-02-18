require("dotenv").config();
const express = require('express');
const cors = require("cors");
const axios = require('axios');

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

const shopifyAPI = `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/customers.json`;
const LARK_API = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN}/tables/${process.env.LARK_TABLE_ID_CUSTOMERS}/records`;

const getCustomers = async () => {
    try {
        const response = await axios.get(shopifyAPI, {
            headers: {
                'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
                'Content-Type': 'application/json',
            },
        });
        return response.data.customers;
    } catch (error) {
        console.error('Lỗi khi gọi Shopify API:', error.response?.data || error.message);
    }
};

const checkCustomerExistsInLarkBase = async (customerId) => {
    try {
        // Lấy tất cả các records trong bảng LarkBase
        const response = await axios.get(
            `${LARK_API}`,  // Cập nhật với đường dẫn lấy dữ liệu
            {
                headers: {
                    Authorization: `Bearer ${LARK_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        // Kiểm tra nếu dữ liệu trả về có bản ghi chứa customer_id
        const customerExists = response.data.data.items.some((record) => {
            return record.fields.customer_id === customerId
        });

        return customerExists;  // Trả về true nếu tồn tại, false nếu không
    } catch (error) {
        console.error('❌ Lỗi khi kiểm tra khách hàng tồn tại:', error.response?.data || error.message);
        return true;  // Mặc định là không tồn tại nếu có lỗi
    }
};

const formatCustomersForLarkBase = (customer) => {
    return {
        "customer_id": customer.id.toString(),
        "first_name": customer.first_name || "",
        "last_name": customer.last_name || "",
        "email": customer.email || "",
        "phone": customer.phone || "",
        "created_at": customer.created_at || "",
        "orders_count": customer.orders_count || 0,
        "total_spent": customer.total_spent || "",
        "address": customer.default_address
            ? `${customer.default_address.address1}, ${customer.default_address.city}, ${customer.default_address.country}`
            : ""
    };
};

const syncToLarkBase = async (customers) => {
    if (!customers.length) {
        console.log('⚠️ Không có khách hàng nào để đồng bộ.');
        return;
    }

    try {
        for (let customer of customers) {
            let formattedData = formatCustomersForLarkBase(customer); // Chuyển đổi mỗi customer thành mảng 1 phần tử
            // Kiểm tra xem khách hàng đã tồn tại trong LarkBase chưa
            const exists = await checkCustomerExistsInLarkBase(formattedData.customer_id);
            if (exists) {
                console.log(`🔍 Khách hàng với ID ${formattedData.customer_id} đã tồn tại trong LarkBase. Không thêm mới.`);
                continue;  // Nếu khách hàng đã tồn tại, bỏ qua và không thêm vào nữa
            }

            //Nếu khách hàng chưa tồn tại, tiến hành đồng bộ
            let response = await axios.post(
                LARK_API,
                { fields: formattedData },  // Đảm bảo sử dụng 'records'
                {
                    headers: {
                        Authorization: `Bearer ${LARK_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
    } catch (error) {
        console.error('❌ Lỗi khi đồng bộ với LarkBase:', error.response?.data || error.message);
        if (error.response?.data?.error?.field_violations) {
            console.error('Lỗi chi tiết trường:', error.response.data.error.field_violations);
        }
    }
};

// 🚀 Chạy hàm đồng bộ mỗi 24 giờ
const syncCustomersEvery24Hours = () => {
    // Tạo một interval để gọi hàm đồng bộ mỗi 24 giờ (24 * 60 * 60 * 1000 milliseconds)
    setInterval(async () => {
        console.log('🚀 Bắt đầu đồng bộ khách hàng...');
        const customers = await getCustomers();  // Lấy danh sách khách hàng từ Shopify
        await syncToLarkBase(customers);  // Đồng bộ với LarkBase
        console.log('✅ Đồng bộ hoàn thành!');
    }, 24 * 60 * 60 * 1000);  // 24 giờ = 24 * 60 * 60 * 1000 milliseconds
};

// Gọi hàm để bắt đầu đồng bộ tự động
syncCustomersEvery24Hours();


// 📌 Đồng bộ sản phẩm
const shopifyAPIProduct = `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/products.json`;
const LARK_API_PRODUCT = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN}/tables/${process.env.LARK_TABLE_ID_PRODUCTS}/records`;

const getProducts = async () => {
    try {
        const response = await axios.get(shopifyAPIProduct, {
            headers: {
                'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
                'Content-Type': 'application/json',
            },
        });
        return response.data.products;
    } catch (error) {
        console.error('Lỗi khi gọi Shopify API:', error.response?.data || error.message);
    }
};

const checkProductExistsInLarkBase = async (products_id) => {
    try {
        // Lấy tất cả các records trong bảng LarkBase
        const response = await axios.get(
            `${LARK_API_PRODUCT}`,  // Cập nhật với đường dẫn lấy dữ liệu
            {
                headers: {
                    Authorization: `Bearer ${LARK_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const customerExists = response.data.data.items.some((record) => {
            return record.fields.products_id === products_id
        });

        return customerExists;  // Trả về true nếu tồn tại, false nếu không
    } catch (error) {
        console.error('❌ Lỗi khi kiểm tra sản phẩm tồn tại:', error.response?.data || error.message);
        return true;  // Mặc định là không tồn tại nếu có lỗi
    }
};

const formatProductsForLarkBase = (product) => {
    return {
        "products_id": product.id.toString(),
        "title": product.title || "",
        "status": product.status || "",
        "created_at": product.created_at || "",
    };
};

const syncToLarkBaseProduct = async (products) => {
    if (!products.length) {
        console.log('⚠️ Không có sản phẩm nào để đồng bộ.');
        return;
    }

    try {
        for (let product of products) {
            let formattedData = formatProductsForLarkBase(product);
            // Kiểm tra xem khách hàng đã tồn tại trong LarkBase chưa
            const exists = await checkProductExistsInLarkBase(formattedData.products_id);
            if (exists) {
                console.log(`🔍 Sản phẩm với ID ${formattedData.products_id} đã tồn tại trong LarkBase. Không thêm mới.`);
                continue;
            }

            await axios.post(
                LARK_API_PRODUCT,
                { fields: formattedData },  // Đảm bảo sử dụng 'records'
                {
                    headers: {
                        Authorization: `Bearer ${LARK_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
        }
    } catch (error) {
        console.error('❌ Lỗi khi đồng bộ với LarkBase:', error.response?.data || error.message);
        if (error.response?.data?.error?.field_violations) {
            console.error('Lỗi chi tiết trường:', error.response.data.error.field_violations);
        }
    }
};

// 🚀 Chạy hàm đồng bộ mỗi 24 giờ
const syncProductsEvery24Hours = () => {
    // Tạo một interval để gọi hàm đồng bộ mỗi 24 giờ (24 * 60 * 60 * 1000 milliseconds)
    setInterval(async () => {
        console.log('🚀 Bắt đầu đồng bộ sản phẩm...');
        const products = await getProducts();
        await syncToLarkBaseProduct(products);
        console.log('✅ Đồng bộ hoàn thành!');
    }, 24 * 60 * 60 * 1000);  // 24 giờ = 24 * 60 * 60 * 1000 milliseconds
};

// Gọi hàm để bắt đầu đồng bộ tự động
syncProductsEvery24Hours();

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
