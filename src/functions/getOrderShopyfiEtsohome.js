const axios = require('axios');
const refreshTokenLark = require('../tokens/refreshTokenLark');

let LARK_ACCESS_TOKEN = "";
let listPrimary = [];
let listNew = [];
let listUpdate = [];

const callAPIOrderEtsohome = async () => {
    const shopifyAPI = `https://${process.env.SHOPIFY_STORE_ETSOHOME}/admin/api/2025-01/orders.json`;
    let allOrders = [];
    let createdAtMin = "2000-01-01T00:00:00Z"; // Lấy từ ngày xa nhất có thể
    let hasMore = true;

    try {
        while (hasMore) {
            console.log(allOrders.length);
            const response = await axios.get(shopifyAPI, {
                params: {
                    limit: 250,
                    status: "any",
                    created_at_min: createdAtMin,  // Lấy từ ngày cũ nhất
                    order: "created_at asc", // Sắp xếp theo ngày tăng dần
                },
                headers: {
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN_ETSOHOME,
                    "Content-Type": "application/json",
                },
            });

            const orders = response.data.orders;
            if (orders.length > 0) {
                allOrders = allOrders.concat(orders);

                // Lấy created_at của đơn cuối cùng và cộng thêm 1 giây để tránh trùng lặp
                let lastCreatedAt = new Date(orders[orders.length - 1].created_at);
                createdAtMin = new Date(lastCreatedAt.getTime() + 1000).toISOString();

                console.log(`📌 Đang lấy đơn hàng từ: ${createdAtMin}`);
            } else {
                hasMore = false; // Không còn đơn hàng nào nữa
            }

        }

        return allOrders;
    } catch (error) {
        console.error("Lỗi khi lấy toàn bộ đơn hàng:", error.response?.data || error.message);
        return [];
    }
};

const getDataLarkBase = async () => {
    const LARK_API = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN_CJ_BASECOST}/tables/${process.env.LARK_TABLE_ID_ORDERS_ETSOHOME}/records`;

    let allDataLB = [];
    let pageToken = "" || null;

    try {
        do {
            const response = await axios.get(
                `${LARK_API}`,
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
        if (error.response?.data?.code === 99991663 || error.response?.data?.code === 99991661 || error.response?.data?.code === 99991668) {
            LARK_ACCESS_TOKEN = await refreshTokenLark();
            return getDataLarkBase();
        }
        throw error;
    }
};

const addDataEtsohome = async (data) => {
    const LARK_API = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN_CJ_BASECOST}/tables/${process.env.LARK_TABLE_ID_ORDERS_ETSOHOME}/records`;

    try {
        await axios.post(
            LARK_API,
            { fields: modelDataOrders(data) },
            {
                headers: {
                    Authorization: `Bearer ${LARK_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (error) {
        if (error.response?.data?.code === 99991663 || error.response?.data?.code === 99991661 || error.response?.data?.code === 99991668) {
            LARK_ACCESS_TOKEN = await refreshTokenLark();
            return addDataEtsohome(data);
        }
        throw error;
    }
};

const updateDataEtsohome = async (data) => {
    const LARK_API = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN_CJ_BASECOST}/tables/${process.env.LARK_TABLE_ID_ORDERS_ETSOHOME}/records/${data.record_id}`;

    try {
        await axios.put(
            LARK_API,
            { fields: data.fields },
            {
                headers: {
                    Authorization: `Bearer ${LARK_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (error) {
        if (error.response?.data?.code === 99991663 || error.response?.data?.code === 99991661 || error.response?.data?.code === 99991668) {
            LARK_ACCESS_TOKEN = await refreshTokenLark();
            return updateDataEtsohome(data);
        }
        throw error;
    }
};

const getDataNewUpdate = async (listPrimary, listDataLarkBase) => {
    for (let i = 0; i < listPrimary.length; i++) {
        let datalistPrimary = listPrimary[i];

        for (let j = 0; j < listDataLarkBase.length; j++) {
            let dataLarkBase = modelDataOrdersLarkBase(listDataLarkBase[j]);

            if (dataLarkBase.fields.id == datalistPrimary.id) {
                // let keysToCheck = [
                //     // 🔹 Trường của khách hàng
                //     "first_name", "last_name", "email", "phone", "created_at",
                //     "orders_count", "total_spent",

                //     // 🔹 Trường của đơn hàng
                //     "financial_status", "fulfillment_status", "total_price",
                //     "total_discounts", "total_quantity", "refund_amount", "source_name"
                // ];

                let keysToCheck = [
                    // 🔹 Trường của khách hàng
                    "order_number", "financial_status"
                ];

                let hasChanged = keysToCheck.some(key => String(dataLarkBase.fields[key] || "") !== String(datalistPrimary[key] || ""));

                if (hasChanged) {
                    listUpdate.push({ ...datalistPrimary, record_id: dataLarkBase.record_id });
                };
                break;
            };

            if (j == listDataLarkBase.length - 1) {
                listNew.push(datalistPrimary);
            }
        };
    };
};

const modelDataOrders = (order) => {
    return {
        id: order.id.toString(),
        order_number: order.order_number.toString(),
        created_at: order.created_at || "",
        financial_status: order.financial_status || "",
        fulfillment_status: order.fulfillment_status || "unfulfilled",
        total_price: order.total_price ? parseFloat(order.total_price) : 0,
        subtotal_price: order.subtotal_price ? parseFloat(order.subtotal_price) : 0,
        total_tax: order.total_tax ? parseFloat(order.total_tax) : 0,
        total_discounts: order.total_discounts ? parseFloat(order.total_discounts) : 0,
        shipping_price: order.total_shipping_price_set?.shop_money?.amount
            ? parseFloat(order.total_shipping_price_set.shop_money.amount)
            : 0,
        currency: order.currency || "",
        source_name: order.source_name || "",
        gateway: order.gateway || "",
        payment_status: order.financial_status || "",
        refund_amount: order.refunds
            ? order.refunds.reduce((sum, refund) =>
                sum + parseFloat(refund.transactions?.[0]?.amount || 0), 0)
            : 0,
        customer_id: order.customer?.id ? order.customer.id.toString() : "",
        customer_email: order.customer?.email || "",
        customer_name: `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim(),
        customer_tags: order.customer?.tags || "",
        line_items: order.line_items
            ? order.line_items.map(item => item.name).join(", ")
            : "",
        product_ids: order.line_items || order.line_items[0].product_id
            ? order.line_items.map(item => item.product_id.toString()).join(", ")
            : "",
        variant_ids: order.line_items || order.line_items[0].variant_id
            ? order.line_items.map(item => item.variant_id.toString()).join(", ")
            : "",
        total_quantity: order.line_items
            ? order.line_items.reduce((sum, item) => sum + item.quantity, 0)
            : 0,
        discount_codes: order.discount_codes
            ? order.discount_codes.map(code => code.code).join(", ")
            : "",
    }
}

const modelDataOrdersLarkBase = (order) => {
    return {
        fields: {
            id: order.fields.id.toString(),
            order_number: order.fields.order_number.toString(),
            created_at: order.fields.created_at || "",
            financial_status: order.fields.financial_status || "",
            fulfillment_status: order.fields.fulfillment_status || "unfulfilled",
            total_price: order.fields.total_price ? parseFloat(order.fields.total_price) : 0,
            subtotal_price: order.fields.subtotal_price ? parseFloat(order.fields.subtotal_price) : 0,
            total_tax: order.fields.total_tax ? parseFloat(order.fields.total_tax) : 0,
            total_discounts: order.fields.total_discounts ? parseFloat(order.fields.total_discounts) : 0,
            shipping_price: order.fields.total_shipping_price_set?.shop_money?.amount
                ? parseFloat(order.fields.total_shipping_price_set.shop_money.amount)
                : 0,
            currency: order.fields.currency || "",
            source_name: order.fields.source_name || "",
            gateway: order.fields.gateway || "",
            payment_status: order.fields.financial_status || "",
            refund_amount: order.fields.refunds
                ? order.fields.refunds.reduce((sum, refund) =>
                    sum + parseFloat(refund.transactions?.[0]?.amount || 0), 0)
                : 0,
            customer_id: order.fields.customer?.id ? order.fields.customer.id.toString() : "",
            customer_email: order.fields.customer?.email || "",
            customer_name: `${order.fields.customer?.first_name || ""} ${order.fields.customer?.last_name || ""}`.trim(),
            customer_tags: order.fields.customer?.tags || "",
            line_items: order.fields.line_items ? order.fields.line_items : "",
            product_ids: order.fields.product_ids ? order.fields.product_ids : "",
            variant_ids: order.fields.variant_ids ? order.fields.variant_ids : "",
            total_quantity: order.fields.total_quantity ? order.fields.total_quantity : 0,
            discount_codes: order.fields.discount_codes ? order.fields.discount_codes : "",
        },
        record_id: order.record_id,
    };
};


const modelDataOrdersLarkBaseUpdate = (order) => {
    return {
        fields: {
            id: order.id.toString(),
            order_number: order.order_number.toString(),
            created_at: order.created_at || "",
            financial_status: order.financial_status || "",
            fulfillment_status: order.fulfillment_status || "unfulfilled",
            total_price: order.total_price ? parseFloat(order.total_price) : 0,
            subtotal_price: order.subtotal_price ? parseFloat(order.subtotal_price) : 0,
            total_tax: order.total_tax ? parseFloat(order.total_tax) : 0,
            total_discounts: order.total_discounts ? parseFloat(order.total_discounts) : 0,
            shipping_price: order.total_shipping_price_set?.shop_money?.amount
                ? parseFloat(order.total_shipping_price_set.shop_money.amount)
                : 0,
            currency: order.currency || "",
            source_name: order.source_name || "",
            gateway: order.gateway || "",
            payment_status: order.financial_status || "",
            refund_amount: order.refunds
                ? order.refunds.reduce((sum, refund) =>
                    sum + parseFloat(refund.transactions?.[0]?.amount || 0), 0)
                : 0,
            customer_id: order.customer?.id ? order.customer.id.toString() : "",
            customer_email: order.customer?.email || "",
            customer_name: `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim(),
            customer_tags: order.customer?.tags || "",
            line_items: order.line_items
                ? order.line_items.map(item => item.name).join(", ")
                : "",
            product_ids: order.line_items
                ? order.line_items.map(item => item.product_id.toString()).join(", ")
                : "",
            variant_ids: order.line_items
                ? order.line_items.map(item => item.variant_id.toString()).join(", ")
                : "",
            total_quantity: order.line_items
                ? order.line_items.reduce((sum, item) => sum + item.quantity, 0)
                : 0,
            discount_codes: order.discount_codes
                ? order.discount_codes.map(code => code.code).join(", ")
                : "",
        },
        record_id: order.record_id,
    }
}

const getOrderShopyfiEtsohome = async () => {
    listPrimary = await callAPIOrderEtsohome();
    const listDataLarkBase = await getDataLarkBase();

    await getDataNewUpdate(listPrimary, listDataLarkBase);

    // Add record data New
    console.log(listNew.length);
    if (listNew.length > 0) {
        for (var j = 0; j < listNew.length; j++) {
            console.log("New: ...", j);

            let data = listNew[j];
            await addDataEtsohome(data);
        }
    }

    // Update record data
    console.log(listUpdate.length);
    if (listUpdate.length > 0) {
        for (var k = 0; k < listUpdate.length; k++) {
            console.log("Update: ...", k);

            let data = listUpdate[k];
            await updateDataEtsohome(modelDataOrdersLarkBaseUpdate(data));
        }
    }
};

module.exports = getOrderShopyfiEtsohome;