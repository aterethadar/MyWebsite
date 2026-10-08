'use strict';

const { getOptionalEnv } = require('../_lib/config');
const { json, methodNotAllowed, readJsonBody } = require('../_lib/http');
const { supabaseRequest } = require('../_lib/supabase');

function getOrderAmount(items, fallbackAmount) {
    const providedAmount = Number(fallbackAmount);
    if (Number.isFinite(providedAmount) && providedAmount >= 0) return Math.round(providedAmount);
    return items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
}

function validatePayload(payload) {
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : '';
    const address = typeof payload.address === 'string' ? payload.address.trim() : '';
    const deliveryMethod = payload.deliveryMethod === 'delivery' ? 'delivery' : 'pickup';
    const deliveryNotes = typeof payload.deliveryNotes === 'string' ? payload.deliveryNotes.trim() : '';
    const items = Array.isArray(payload.items) ? payload.items : [];
    const amount = getOrderAmount(items, payload.amount);
    const subtotal = Number(payload.subtotal);
    const discountAmount = Number(payload.discountAmount);

    if (!name || !email || !phone || items.length === 0) throw new Error('missing-required-fields');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid-email');
    if (name.length > 120 || phone.length > 40 || deliveryNotes.length > 2000) throw new Error('field-too-long');
    if (deliveryMethod === 'delivery' && !address) throw new Error('delivery-address-required');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('invalid-amount');

    const safeItems = items.map(item => ({
        name: typeof item.name === 'string' ? item.name.trim() : '',
        quantity: Number(item.quantity),
        total: Number(item.total)
    }));
    if (safeItems.some(item => !item.name || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 || !Number.isFinite(item.total) || item.total < 0)) {
        throw new Error('invalid-items');
    }

    return {
        name,
        email,
        phone,
        address,
        deliveryMethod,
        deliveryNotes,
        amount,
        subtotal: Number.isFinite(subtotal) && subtotal >= amount ? Math.round(subtotal) : amount,
        discountAmount: Number.isFinite(discountAmount) && discountAmount >= 0 ? Math.round(discountAmount) : 0,
        items: safeItems
    };
}

function extractPaymentUrl(data) {
    if (!data || typeof data !== 'object') return '';
    const candidates = [
        data.paymentUrl,
        data.checkoutUrl,
        data.url,
        data.redirectUrl,
        data.link,
        data.href,
        data.data?.paymentUrl,
        data.data?.checkoutUrl,
        data.data?.url,
        data.data?.redirectUrl,
        data.data?.link,
        data.data?.href
    ];
    return candidates.find(value => typeof value === 'string' && value.trim()) || '';
}

function createNedarimPaymentConfig(order, orderId) {
    const enabled = getOptionalEnv('NEDARIM_PAYMENT_ENABLED', 'false').toLowerCase() === 'true';
    if (!enabled) return '';

    const apiBase = getOptionalEnv('NEDARIM_PAYMENT_URL', 'https://matara.pro/nedarimplus/iframe/');
    const mosadId = getOptionalEnv('NEDARIM_MOSAD_ID', getOptionalEnv('MOSAD_ID', '7019114'));
    const shluha = getOptionalEnv('NEDARIM_SHLUHA', getOptionalEnv('SHLUHA', ''));
    const apiValid = getOptionalEnv('NEDARIM_API_VALID', getOptionalEnv('API_VALID', getOptionalEnv('NEDARIM_API_KEY', '')));
    const merchantId = getOptionalEnv('NEDARIM_MERCHANT_ID', '');
    const successUrl = getOptionalEnv('NEDARIM_SUCCESS_URL', '');
    const cancelUrl = getOptionalEnv('NEDARIM_CANCEL_URL', '');
    const siteBaseUrl = getOptionalEnv('SITE_BASE_URL', '').replace(/\/$/, '');
    const callbackUrl = getOptionalEnv('NEDARIM_CALLBACK_URL', siteBaseUrl ? `${siteBaseUrl}/api/orders/callback` : '');
    if (!apiBase || !mosadId || !apiValid) return null;

    const paymentUrl = new URL(apiBase);
    const nameParts = order.name.split(/\s+/);
    const params = {
        MosadId: mosadId,
        ApiValid: apiValid,
        Amount: String(Math.round(order.amount)),
        ClientName: order.name,
        ClientEmail: order.email,
        ClientPhone: order.phone,
        CallBack: callbackUrl
    };
    Object.entries(params).forEach(([key, value]) => {
        if (value) paymentUrl.searchParams.set(key, value);
    });
    return {
        url: paymentUrl.toString(),
        value: {
            Mosad: mosadId,
            ApiValid: apiValid,
            PaymentType: 'Ragil',
            Currency: '1',
            Zeout: '',
            FirstName: nameParts[0] || order.name,
            LastName: nameParts.slice(1).join(' '),
            Street: order.address,
            City: '',
            Phone: order.phone,
            Mail: order.email,
            Amount: String(Math.round(order.amount)),
            Tashlumim: '1',
            Groupe: shluha,
            Comment: `הזמנה מעטרת הדר - ${orderId}`,
            CallBack: callbackUrl,
            CallBackMailError: '',
            Param1: orderId,
            Param2: '',
            Day: '',
            StartFrom: '',
            ThirdPartyReceipt: '0',
            ForceUpdateMatching: '',
            Tokef: ''
        }
    };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        methodNotAllowed(res, ['POST']);
        return;
    }

    try {
        const order = validatePayload(await readJsonBody(req));
        const orderId = `EH-${Date.now().toString(36).toUpperCase()}`;
        const insertedOrders = await supabaseRequest('orders?select=order_id', {
            method: 'POST',
            headers: { 'Prefer': 'return=representation' },
            body: {
                order_id: orderId,
                status: 'pending',
                name: order.name,
                email: order.email,
                phone: order.phone,
                address: order.address || null,
                delivery_method: order.deliveryMethod,
                delivery_notes: order.deliveryNotes || null,
                amount: order.amount,
                subtotal: order.subtotal,
                discount_amount: order.discountAmount,
                items: order.items
            }
        });
        if (!Array.isArray(insertedOrders) || insertedOrders[0]?.order_id !== orderId) {
            throw new Error('order-save-failed');
        }
        const paymentConfig = createNedarimPaymentConfig(order, orderId);
        if (!paymentConfig) throw new Error('payment-not-configured');
        let emailSent = null;
        json(res, 200, {
            ok: true,
            orderId,
            paymentConfig,
            paymentMode: paymentConfig ? 'nedarim-plus' : 'manual',
            emailSent
        });
    } catch (error) {
        const message = typeof error.message === 'string' ? error.message : 'unknown-error';
        const status = message === 'email-send-failed' ? 500 : 400;
        json(res, status, { ok: false, error: message });
    }
};
