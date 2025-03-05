const axios = require('axios');
const refreshTokenLark = require('../tokens/refreshTokenLark');

let LARK_ACCESS_TOKEN = "";
let listPrimary = [];
let listNew = [];
let listUpdate = [];

const callAPIEtsohome = async () => {
    const shopifyAPI = `https://${process.env.SHOPIFY_STORE_ETSOHOME}/admin/api/2025-01/products.json`;

    try {
        const response = await axios.get(shopifyAPI, {
            headers: {
                'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN_ETSOHOME,
                'Content-Type': 'application/json',
            },
        });

        return response.data.products;
    } catch (error) {
        console.error('Lỗi khi gọi Shopify API:', error.response?.data || error.message);
    }
};

const getDataLarkBase = async () => {
    const LARK_API = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN_CJ_BASECOST}/tables/${process.env.LARK_TABLE_ID_PRODUCTS_ETSOHOME}/records`;

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
    const LARK_API = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN_CJ_BASECOST}/tables/${process.env.LARK_TABLE_ID_PRODUCTS_ETSOHOME}/records`;

    try {
        await axios.post(
            LARK_API,
            { fields: modelDataProducts(data) },
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
    const LARK_API = `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN_CJ_BASECOST}/tables/${process.env.LARK_TABLE_ID_PRODUCTS_ETSOHOME}/records/${data.record_id}`;

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
            let dataLarkBase = modelDataProductsLarkBase(listDataLarkBase[j]);

            if (dataLarkBase.fields.id == datalistPrimary.id) {
                let keysToCheck = [
                    "title", "tags", "status", "created_at", "updated_at", "published_at"
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

const modelDataProducts = (model) => {
    return {
        id: model.id.toString(),
        title: model.title ? model.title : "",
        tags: model.tags ? model.tags : "",
        status: model.status ? model.status : "",
        created_at: model.created_at ? model.created_at : "",
        updated_at: model.updated_at ? model.updated_at : "",
        published_at: model.published_at ? model.published_at : ""
    }
}

const modelDataProductsLarkBase = (model) => {
    return {
        fields: {
            id: model.fields.id.toString(),
            title: model.fields.title ? model.fields.title : "",
            tags: model.fields.tags ? model.fields.tags : "",
            status: model.fields.status ? model.fields.status : "",
            created_at: model.fields.created_at ? model.fields.created_at : "",
            updated_at: model.fields.updated_at ? model.fields.updated_at : "",
            published_at: model.fields.published_at ? model.fields.published_at : ""
        },
        record_id: model.record_id
    }
}

const modelDataProductsLarkBaseUpdate = (model) => {
    return {
        fields: {
            id: model.id.toString(),
            title: model.title ? model.title : "",
            tags: model.tags ? model.tags : "",
            status: model.status ? model.status : "",
            created_at: model.created_at ? model.created_at : "",
            updated_at: model.updated_at ? model.updated_at : "",
            published_at: model.published_at ? model.published_at : ""
        },
        record_id: model.record_id
    }
}

const getProductShopyfiEtsohome = async () => {
    listPrimary = await callAPIEtsohome();
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
            await updateDataEtsohome(modelDataProductsLarkBaseUpdate(data));
        }
    }
};

module.exports = getProductShopyfiEtsohome;