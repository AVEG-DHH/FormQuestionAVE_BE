// BASECOST CJ
const urlOrderListCJ = "https://developers.cjdropshipping.com/api2.0/v1/shopping/order/list"
const CJ_TOKEN = "API@CJ3183462@CJ:eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiIyMzQyOSIsInR5cGUiOiJBQ0NFU1NfVE9LRU4iLCJzdWIiOiJicUxvYnFRMGxtTm55UXB4UFdMWnl1Rm8rMG5KQUFIM0doK1ZUYnRCYTVTcCtuNGdHQ0lHaENvRDI3UllIakN0aGR6TFFVa3JQem9MUWVGZlRSZ2ZOdW9sTC8zTGE3REZtRVBCa1ZBSG9pb05aUHNrODF4TVlaRm9LTG9GblF5WFVUOFZORDgvVHRDV0JIS2NXdmtuelpuek1jVFNWWEMxcWkvREhnd0EzN2NXR2tmY1lkSEtQVlZ3eFo1aGFXVnFSY29LdzNQcUNMTVlIOWEvb2xWWUZlT2g0a1Q1bWprMEdnTm5tczFPWE1Jc1VpU041THVFQStpcnZJWWhxRzF6cDVKclE4OGxxbzZzMC9lMmhNcmV0WDBTYzRxbnRFSURMRkdYODZ6MGVERT0iLCJpYXQiOjE3Mzk5NTE3MzZ9.mgMeR74yfPJnbnJgOkrgYmS6RUTGfG1UMcpo8CfFPV8";

let totalOrdersList = 0;
let pageNum = 1;
let pageSize = 200;
let ordersListPrimary = [];
let ordersListNew = [];
let ordersListUpdate = [];
let LARK_ACCESS_TOKEN = "t-g2062ocbLXY5RKU2XQHZLOM453LBBUWZ7KHMQZIR"; // Lưu token toàn cục


export default async function handler(req, res) {
    if (req.method === "GET") {
        try {
            await backupDataCJ(); // Hàm backup của bạn
            return res.status(200).json({ message: "Backup completed successfully!" });
        } catch (error) {
            return res.status(500).json({ message: "Backup failed!", error: error.message });
        }
    }
    return res.status(404).json({ message: "Not Found" });
}

const backupDataCJ = async () => {
    console.log("Now time update!");

    await getOrderList();
}

const fetchLarkToken = async () => {
    try {
        const response = await axios.post(process.env.LARK_URL_GET_TOKEN, {
            app_id: process.env.LARK_APP_ID,
            app_secret: process.env.LARK_APP_SECRET
        });

        LARK_ACCESS_TOKEN = response.data.tenant_access_token;
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

        // return response.data.data;
    } catch (error) {
        console.error('Lỗi khi gọi Shopify API:', error.response?.data || error.message);
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
    // if (ordersListUpdate.length > 0) {
    //     for (var k = 0; k < ordersListUpdate.length; k++) {
    //         console.log("Update: ...", k);
    //         let data = ordersListUpdate[k];
    //         await updateDataLarkOrders(formatDataCJOrderUpdate(data));
    //     }
    // }
};

getOrderList();

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
