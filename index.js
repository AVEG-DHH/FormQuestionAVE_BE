require("dotenv").config();
const express = require('express');
const cors = require("cors");
const axios = require('axios');
const cron = require("node-cron");

const port = process.env.PORT || 5000;
let LARK_ACCESS_TOKEN = "t-g2062ocbLXY5RKU2XQHZLOM453LBBUWZ7KHMQZIR"; // Lưu token toàn cục

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
        if (error.response?.data?.code === 99991663 || error.response?.data?.code === 99991661) {
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
        if (error.response?.data?.code === 99991663 || error.response?.data?.code === 99991661) {
            await fetchLarkToken();
            return sendLarkRequest(fields); // Gọi lại request sau khi có token mới
        }
        throw error;
    }
}

// BASECOST CJ
const urlOrderListCJ = "https://developers.cjdropshipping.com/api2.0/v1/shopping/order/list"
const CJ_TOKEN = "API@CJ3183462@CJ:eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiIyMzQyOSIsInR5cGUiOiJBQ0NFU1NfVE9LRU4iLCJzdWIiOiJicUxvYnFRMGxtTm55UXB4UFdMWnl1Rm8rMG5KQUFIM0doK1ZUYnRCYTVTcCtuNGdHQ0lHaENvRDI3UllIakN0aGR6TFFVa3JQem9MUWVGZlRSZ2ZOdW9sTC8zTGE3REZtRVBCa1ZBSG9pb05aUHNrODF4TVlaRm9LTG9GblF5WFVUOFZORDgvVHRDV0JIS2NXdmtuelpuek1jVFNWWEMxcWkvREhnd0EzN2NXR2tmY1lkSEtQVlZ3eFo1aGFXVnFSY29LdzNQcUNMTVlIOWEvb2xWWUZlT2g0a1Q1bWprMEdnTm5tczFPWE1Jc1VpU041THVFQStpcnZJWWhxRzF6cDVKclE4OGxxbzZzMC9lMmhNcmV0WDBTYzRxbnRFSURMRkdYODZ6MGVERT0iLCJpYXQiOjE3Mzk5NTE3MzZ9.mgMeR74yfPJnbnJgOkrgYmS6RUTGfG1UMcpo8CfFPV8";

let totalOrdersList = 0;
let pageNum = 1;
let pageSize = 200;
let ordersListPrimary = [];
let ordersListNew = [];
let ordersListUpdate = [];

const backupDataCJ = async () => {
    console.log("Now time update!");

    await getOrderList();
}

cron.schedule("15 0 * * *", backupDataCJ, {
    timezone: "Asia/Ho_Chi_Minh",
});

const refreshCJToken = async ()=>{
    try {
        const response = await axios.post(process.env.CJ_URL_GET_TOKEN, {
            email: process.env.CJ_EMAIL,
            password: process.env.CJ_PASSWORD
        });

        CJ_TOKEN = response.data.data.accessToken;
    } catch (error) {
        console.error("Lỗi lấy token:", error.response?.data || error.message);
    }
};

const pushDataInArr = async (arrData) => {
    const dataAPI = arrData.list;
    if (dataAPI.length > 0) {
        for (var i = 0; i < dataAPI.length; i++) {
            ordersListPrimary.push(dataAPI[i]);
        }
    }
};

const getTotalOrderList = async () => {
    try {
        const response = await axios.get(urlOrderListCJ, {
            headers: {
                'CJ-Access-Token': CJ_TOKEN,
            },
            params: {
                pageNum: 1,
                pageSize: pageSize
            }
        });

        return response.data.data.total;
    } catch (error) {
        console.error('Lỗi khi gọi Shopify API:', error.response?.data || error.message);
        if (error.response?.status === 401 || error.response?.data?.code === 99991663 || error.response?.data?.code === 99991661) {
            console.log('Token hết hạn, đang lấy token mới...');

            await refreshCJToken(); // Gọi hàm để lấy token mới
            return getTotalOrderList(); // Gọi lại request sau khi có token mới
        }

        throw error;
    }
};

const callAPIGetOrdersList = async (pageNumNew) => {
    try {
        const response = await axios.get(urlOrderListCJ, {
            headers: {
                'CJ-Access-Token': CJ_TOKEN,
            },
            params: {
                pageNum: pageNumNew,
                pageSize: pageSize
            }
        });
        await pushDataInArr(response.data.data);
    } catch (error) {
        console.error('Lỗi khi gọi Shopify API:', error.response?.data || error.message);
        if (error.response?.status === 401 || error.response?.data?.code === 99991663 || error.response?.data?.code === 99991661) {
            console.log('Token hết hạn, đang lấy token mới...');

            await refreshCJToken(); // Gọi hàm để lấy token mới
            return getTotalOrderList(); // Gọi lại request sau khi có token mới
        }

        throw error;
    }
};

const LARK_API_CJ_ORDER = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN_CJ_BASECOST}/tables/${process.env.LARK_TABLE_ID_CJ_BASECOST_ORDER}/records`;
const getDataLarkBase = async () => {
    let allDataLB = [];
    let pageToken = "" || null;

    try {
        do {
            const response = await axios.get(
                `${LARK_API_CJ_ORDER}`,  // Cập nhật với đường dẫn lấy dữ liệu
                {
                    headers: {
                        Authorization: `Bearer ${LARK_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    params: {
                        "page_token": pageToken
                    }
                }
            );

            allDataLB.push(...response.data?.data?.items);
            pageToken = response.data?.data?.page_token || null;
        } while (pageToken)

        return allDataLB;
    } catch (error) {
        // 📌 Nếu token hết hạn (code: 99991663), lấy token mới rồi thử lại
        if (error.response?.data?.code === 99991663 || error.response?.data?.code === 99991661) {
            await fetchLarkToken();
            return getDataLarkBase();
        }
        throw error;
    }
};

const getDataNewUpdateCJ = async (arrCJ, arrLB) => {

    for (let i = 0; i < arrCJ.length; i++) {
        let dataCJ = arrCJ[i];

        for (let j = 0; j < arrLB.length; j++) {
            let dataLB = arrLB[j];

            if (dataLB.fields.orderId == dataCJ.orderId) {
                let keysToCheck = [
                    "orderNum", "cjOrderId", "shippingCountryCode", "shippingProvince",
                    "shippingCity", "shippingPhone", "shippingAddress", "shippingCustomerName",
                    "remark", "orderWeight", "orderStatus", "orderAmount", "productAmount",
                    "postageAmount", "logisticName", "trackNumber", "createDate", "paymentDate"
                ];

                let hasChanged = keysToCheck.some(key => String(dataLB.fields[key] || "") !== String(dataCJ[key] || ""));

                if (hasChanged) {
                    ordersListUpdate.push({ ...dataCJ, record_id: dataLB.record_id });
                };
                break;
            };

            if (j == arrLB.length - 1) {
                ordersListNew.push(dataCJ);
            }
        };
    };
};

const getOrderList = async () => {
    let arrLarkBaseData = await getDataLarkBase();

    totalOrdersList = await getTotalOrderList();
    pageNum = totalOrdersList % pageSize == 0 ? Math.floor(totalOrdersList / pageSize) : Math.floor(totalOrdersList / pageSize) + 1;

    for (var i = 1; i <= pageNum; i++) {
        await callAPIGetOrdersList(i);
    }

    await getDataNewUpdateCJ(ordersListPrimary, arrLarkBaseData);

    // Add record data New
    console.log(ordersListNew.length);
    if (ordersListNew.length > 0) {
        for (var j = 0; j < ordersListNew.length; j++) {
            console.log("New: ...", j);
            let data = ordersListNew[j];
            await sendLarkOrders(formatDataCJOrder(data));
        }
    }

    // Update record data
    console.log(ordersListUpdate.length);
    if (ordersListUpdate.length > 0) {
        for (var k = 0; k < ordersListUpdate.length; k++) {
            console.log("Update: ...", k);
            let data = ordersListUpdate[k];
            await updateDataLarkOrders(formatDataCJOrderUpdate(data));
        }
    }
};

const formatDataCJOrder = (data) => {
    return {
        orderId: data.orderId ? data.orderId : "",
        orderNum: data.orderNum ? data.orderNum : "",
        cjOrderId: data.cjOrderId ? data.cjOrderId : "",
        shippingCountryCode: data.shippingCountryCode ? data.shippingCountryCode : "",
        shippingProvince: data.shippingProvince ? data.shippingProvince : "",
        shippingCity: data.shippingCity ? data.shippingCity : "",
        shippingPhone: data.shippingPhone ? data.shippingPhone : "",
        shippingAddress: data.shippingAddress ? data.shippingAddress : "",
        shippingCustomerName: data.shippingCustomerName ? data.shippingCustomerName : "",
        remark: data.remark ? data.remark : "",
        orderWeight: data.orderWeight ? data.orderWeight : 0,
        orderStatus: data.orderStatus ? data.orderStatus : "",
        orderAmount: data.orderAmount ? data.orderAmount : 0,
        productAmount: data.productAmount ? data.productAmount : 0,
        postageAmount: data.postageAmount ? data.postageAmount : 0,
        logisticName: data.logisticName ? data.logisticName : "",
        trackNumber: data.trackNumber ? data.trackNumber : "",
        createDate: data.createDate ? data.createDate : "",
        paymentDate: data.paymentDate ? data.paymentDate : ""
    }
}

const sendLarkOrders = async (fields) => {
    try {
        return await axios.post(
            `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN_CJ_BASECOST}/tables/${process.env.LARK_TABLE_ID_CJ_BASECOST_ORDER}/records`,
            { fields },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${LARK_ACCESS_TOKEN}`
                }
            }
        );
    } catch (error) {
        console.log(error);
        // 📌 Nếu token hết hạn (code: 99991663), lấy token mới rồi thử lại
        if (error.response?.data?.code === 99991663 || error.response?.data?.code === 99991661) {
            await fetchLarkToken();
            return sendLarkOrders(fields); // Gọi lại request sau khi có token mới
        }
        throw error;
    }
};

const formatDataCJOrderUpdate = (data) => {
    return {
        record_id: data.record_id ? data.record_id : "",
        dataFields: {
            orderId: data.orderId ? data.orderId : "",
            orderNum: data.orderNum ? data.orderNum : "",
            cjOrderId: data.cjOrderId ? data.cjOrderId : "",
            shippingCountryCode: data.shippingCountryCode ? data.shippingCountryCode : "",
            shippingProvince: data.shippingProvince ? data.shippingProvince : "",
            shippingCity: data.shippingCity ? data.shippingCity : "",
            shippingPhone: data.shippingPhone ? data.shippingPhone : "",
            shippingAddress: data.shippingAddress ? data.shippingAddress : "",
            shippingCustomerName: data.shippingCustomerName ? data.shippingCustomerName : "",
            remark: data.remark ? data.remark : "",
            orderWeight: data.orderWeight ? data.orderWeight : 0,
            orderStatus: data.orderStatus ? data.orderStatus : "",
            orderAmount: data.orderAmount ? data.orderAmount : 0,
            productAmount: data.productAmount ? data.productAmount : 0,
            postageAmount: data.postageAmount ? data.postageAmount : 0,
            logisticName: data.logisticName ? data.logisticName : "",
            trackNumber: data.trackNumber ? data.trackNumber : "",
            createDate: data.createDate ? data.createDate : "",
            paymentDate: data.paymentDate ? data.paymentDate : ""
        }
    }
}

const updateDataLarkOrders = async (fields) => {
    try {
        return await axios.put(
            `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN_CJ_BASECOST}/tables/${process.env.LARK_TABLE_ID_CJ_BASECOST_ORDER}/records/${fields.record_id}`,
            { fields: fields.dataFields },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${LARK_ACCESS_TOKEN}`
                }
            }
        );
    } catch (error) {
        console.log(error);
        // 📌 Nếu token hết hạn (code: 99991663), lấy token mới rồi thử lại
        if (error.response?.data?.code === 99991663 || error.response?.data?.code === 99991661) {
            await fetchLarkToken();
            return updateDataLarkOrders(fields); // Gọi lại request sau khi có token mới
        }
        throw error;
    }
};

// const shopifyAPI = `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/customers.json`;
// const LARK_API = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN}/tables/${process.env.LARK_TABLE_ID_CUSTOMERS}/records`;

// const getCustomers = async () => {
//     try {
//         const response = await axios.get(shopifyAPI, {
//             headers: {
//                 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
//                 'Content-Type': 'application/json',
//             },
//         });
//         return response.data.customers;
//     } catch (error) {
//         console.error('Lỗi khi gọi Shopify API:', error.response?.data || error.message);
//     }
// };

// const checkCustomerExistsInLarkBase = async (customerId) => {
//     try {
//         // Lấy tất cả các records trong bảng LarkBase
//         const response = await axios.get(
//             `${LARK_API}`,  // Cập nhật với đường dẫn lấy dữ liệu
//             {
//                 headers: {
//                     Authorization: `Bearer ${LARK_ACCESS_TOKEN}`,
//                     'Content-Type': 'application/json',
//                 },
//             }
//         );

//         // Kiểm tra nếu dữ liệu trả về có bản ghi chứa customer_id
//         const customerExists = response.data.data.items.some((record) => {
//             return record.fields.customer_id === customerId
//         });

//         return customerExists;  // Trả về true nếu tồn tại, false nếu không
//     } catch (error) {
//         console.error('❌ Lỗi khi kiểm tra khách hàng tồn tại:', error.response?.data || error.message);
//         return true;  // Mặc định là không tồn tại nếu có lỗi
//     }
// };

// const formatCustomersForLarkBase = (customer) => {
//     return {
//         "customer_id": customer.id.toString(),
//         "first_name": customer.first_name || "",
//         "last_name": customer.last_name || "",
//         "email": customer.email || "",
//         "phone": customer.phone || "",
//         "created_at": customer.created_at || "",
//         "orders_count": customer.orders_count || 0,
//         "total_spent": customer.total_spent || "",
//         "address": customer.default_address
//             ? `${customer.default_address.address1}, ${customer.default_address.city}, ${customer.default_address.country}`
//             : ""
//     };
// };

// const syncToLarkBase = async (customers) => {
//     if (!customers.length) {
//         console.log('⚠️ Không có khách hàng nào để đồng bộ.');
//         return;
//     }

//     try {
//         for (let customer of customers) {
//             let formattedData = formatCustomersForLarkBase(customer); // Chuyển đổi mỗi customer thành mảng 1 phần tử
//             // Kiểm tra xem khách hàng đã tồn tại trong LarkBase chưa
//             const exists = await checkCustomerExistsInLarkBase(formattedData.customer_id);
//             if (exists) {
//                 console.log(`🔍 Khách hàng với ID ${formattedData.customer_id} đã tồn tại trong LarkBase. Không thêm mới.`);
//                 continue;  // Nếu khách hàng đã tồn tại, bỏ qua và không thêm vào nữa
//             }

//             //Nếu khách hàng chưa tồn tại, tiến hành đồng bộ
//             let response = await axios.post(
//                 LARK_API,
//                 { fields: formattedData },  // Đảm bảo sử dụng 'records'
//                 {
//                     headers: {
//                         Authorization: `Bearer ${LARK_ACCESS_TOKEN}`,
//                         'Content-Type': 'application/json',
//                     },
//                 }
//             );
//         }
//     } catch (error) {
//         console.error('❌ Lỗi khi đồng bộ với LarkBase:', error.response?.data || error.message);
//         if (error.response?.data?.error?.field_violations) {
//             console.error('Lỗi chi tiết trường:', error.response.data.error.field_violations);
//         }
//     }
// };

// // 🚀 Chạy hàm đồng bộ mỗi 24 giờ
// const syncCustomersEvery24Hours = () => {
//     // Tạo một interval để gọi hàm đồng bộ mỗi 24 giờ (24 * 60 * 60 * 1000 milliseconds)
//     setInterval(async () => {
//         console.log('🚀 Bắt đầu đồng bộ khách hàng...');
//         const customers = await getCustomers();  // Lấy danh sách khách hàng từ Shopify
//         await syncToLarkBase(customers);  // Đồng bộ với LarkBase
//         console.log('✅ Đồng bộ hoàn thành!');
//     }, 24 * 60 * 60 * 1000);  // 24 giờ = 24 * 60 * 60 * 1000 milliseconds
// };

// // Gọi hàm để bắt đầu đồng bộ tự động
// syncCustomersEvery24Hours();

// // 📌 Đồng bộ sản phẩm
// const shopifyAPIProduct = `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/products.json`;
// const LARK_API_PRODUCT = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN}/tables/${process.env.LARK_TABLE_ID_PRODUCTS}/records`;

// const getProducts = async () => {
//     try {
//         const response = await axios.get(shopifyAPIProduct, {
//             headers: {
//                 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
//                 'Content-Type': 'application/json',
//             },
//         });
//         return response.data.products;
//     } catch (error) {
//         console.error('Lỗi khi gọi Shopify API:', error.response?.data || error.message);
//     }
// };

// const checkProductExistsInLarkBase = async (products_id) => {
//     try {
//         // Lấy tất cả các records trong bảng LarkBase
//         const response = await axios.get(
//             `${LARK_API_PRODUCT}`,  // Cập nhật với đường dẫn lấy dữ liệu
//             {
//                 headers: {
//                     Authorization: `Bearer ${LARK_ACCESS_TOKEN}`,
//                     'Content-Type': 'application/json',
//                 },
//             }
//         );

//         const customerExists = response.data.data.items.some((record) => {
//             return record.fields.products_id === products_id
//         });

//         return customerExists;  // Trả về true nếu tồn tại, false nếu không
//     } catch (error) {
//         console.error('❌ Lỗi khi kiểm tra sản phẩm tồn tại:', error.response?.data || error.message);
//         return true;  // Mặc định là không tồn tại nếu có lỗi
//     }
// };

// const formatProductsForLarkBase = (product) => {
//     return {
//         "products_id": product.id.toString(),
//         "title": product.title || "",
//         "status": product.status || "",
//         "created_at": product.created_at || "",
//     };
// };

// const syncToLarkBaseProduct = async (products) => {
//     if (!products.length) {
//         console.log('⚠️ Không có sản phẩm nào để đồng bộ.');
//         return;
//     }

//     try {
//         for (let product of products) {
//             let formattedData = formatProductsForLarkBase(product);
//             // Kiểm tra xem khách hàng đã tồn tại trong LarkBase chưa
//             const exists = await checkProductExistsInLarkBase(formattedData.products_id);
//             if (exists) {
//                 console.log(`🔍 Sản phẩm với ID ${formattedData.products_id} đã tồn tại trong LarkBase. Không thêm mới.`);
//                 continue;
//             }

//             await axios.post(
//                 LARK_API_PRODUCT,
//                 { fields: formattedData },  // Đảm bảo sử dụng 'records'
//                 {
//                     headers: {
//                         Authorization: `Bearer ${LARK_ACCESS_TOKEN}`,
//                         'Content-Type': 'application/json',
//                     },
//                 }
//             );
//         }
//     } catch (error) {
//         console.error('❌ Lỗi khi đồng bộ với LarkBase:', error.response?.data || error.message);
//         if (error.response?.data?.error?.field_violations) {
//             console.error('Lỗi chi tiết trường:', error.response.data.error.field_violations);
//         }
//     }
// };

// // 🚀 Chạy hàm đồng bộ mỗi 24 giờ
// const syncProductsEvery24Hours = () => {
//     // Tạo một interval để gọi hàm đồng bộ mỗi 24 giờ (24 * 60 * 60 * 1000 milliseconds)
//     setInterval(async () => {
//         console.log('🚀 Bắt đầu đồng bộ sản phẩm...');
//         const products = await getProducts();
//         await syncToLarkBaseProduct(products);
//         console.log('✅ Đồng bộ hoàn thành!');
//     }, 24 * 60 * 60 * 1000);  // 24 giờ = 24 * 60 * 60 * 1000 milliseconds
// };

// // Gọi hàm để bắt đầu đồng bộ tự động
// syncProductsEvery24Hours();

// // 📌 Đồng bộ sản phẩm
// const shopifyAPIOrder = `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/orders.json`;
// const LARK_API_ORDER = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN}/tables/${process.env.LARK_TABLE_ID_ORDERS}/records`;

// const getOrders = async () => {
//     try {
//         const response = await axios.get(shopifyAPIOrder, {
//             headers: {
//                 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
//                 'Content-Type': 'application/json',
//             },
//         });
//         return response.data.orders;
//     } catch (error) {
//         console.error('Lỗi khi gọi Shopify API:', error.response?.data || error.message);
//     }
// };

// const checkOrderExistsInLarkBase = async (order_id) => {
//     try {
//         // Lấy tất cả các records trong bảng LarkBase
//         const response = await axios.get(
//             `${LARK_API_ORDER}`,  // Cập nhật với đường dẫn lấy dữ liệu
//             {
//                 headers: {
//                     Authorization: `Bearer ${LARK_ACCESS_TOKEN}`,
//                     'Content-Type': 'application/json',
//                 },
//             }
//         );
//         console.log(response.data.data);

//         const customerExists = response.data.data.items.some((record) => {
//             return record.fields.order_id === order_id
//         });

//         return customerExists;  // Trả về true nếu tồn tại, false nếu không
//     } catch (error) {
//         console.error('❌ Lỗi khi kiểm tra sản phẩm tồn tại:', error.response?.data || error.message);
//         return true;  // Mặc định là không tồn tại nếu có lỗi
//     }
// };

// const formatOrdersForLarkBase = (order) => {
//     return {
//         "order_id": order.id.toString(),
//         "first_name": order.customer.first_name || "",
//         "last_name": order.customer.last_name || "",
//         "phone": order.customer.phone || "",
//         "customer_locale": order.customer_locale || "",
//         "contact_email": order.contact_email || "",
//         "checkout_id": order.checkout_id.toString() || "",
//         "checkout_token": order.checkout_token || "",
//         "confirmation_number": order.confirmation_number || "",
//         "code": order.discount_codes ? order.discount_codes[0].code || "" : "",
//         "name_item": order.line_items[0].name || "",
//         "price_item": order.line_items[0].price || "",
//         "quantity_item": order.line_items[0].quantity || "",
//         "created_at": order.created_at || "",
//     };
// };

// const syncToLarkBaseOrder = async (orders) => {
//     if (!orders.length) {
//         console.log('⚠️ Không có đơn hàng nào để đồng bộ.');
//         return;
//     }

//     try {
//         for (let order of orders) {
//             let formattedData = formatOrdersForLarkBase(order);
//             // Kiểm tra xem khách hàng đã tồn tại trong LarkBase chưa
//             const exists = await checkOrderExistsInLarkBase(formattedData.order_id);
//             if (exists) {
//                 console.log(`🔍 Đơn hàng với ID ${formattedData.order_id} đã tồn tại trong LarkBase. Không thêm mới.`);
//                 continue;
//             }

//             await axios.post(
//                 LARK_API_ORDER,
//                 { fields: formattedData },  // Đảm bảo sử dụng 'records'
//                 {
//                     headers: {
//                         Authorization: `Bearer ${LARK_ACCESS_TOKEN}`,
//                         'Content-Type': 'application/json',
//                     },
//                 }
//             );
//         }
//     } catch (error) {
//         console.error('❌ Lỗi khi đồng bộ với LarkBase:', error.response?.data || error.message);
//         if (error.response?.data?.error?.field_violations) {
//             console.error('Lỗi chi tiết trường:', error.response.data.error.field_violations);
//         }
//     }
// };

// // 🚀 Chạy hàm đồng bộ mỗi 24 giờ
// const syncOrdersEvery24Hours = async () => {
//     // Tạo một interval để gọi hàm đồng bộ mỗi 24 giờ (24 * 60 * 60 * 1000 milliseconds)
//     setInterval(async () => {
//         console.log('🚀 Bắt đầu đồng bộ sản phẩm...');
//         const orders = await getOrders();
//         await syncToLarkBaseOrder(orders);
//         console.log('✅ Đồng bộ hoàn thành!');
//     }, 6000);  // 24 giờ = 24 * 60 * 60 * 1000 milliseconds
// };

// Gọi hàm để bắt đầu đồng bộ tự động
// syncOrdersEvery24Hours();

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
