'use strict';

const { getOptionalEnv } = require('../_lib/config');
const { json, methodNotAllowed, readJsonBody } = require('../_lib/http');
const { sendOrderEmails } = require('../_lib/email');

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

    return { name, email, phone, address, deliveryMethod, deliveryNotes, amount, items: safeItems };
}

function createNedarimPaymentLink(order, orderId) {
    const enabled = getOptionalEnv('NEDARIM_PAYMENT_ENABLED', 'false').toLowerCase() === 'true';
    if (!enabled) return '';

    const apiBase = getOptionalEnv('NEDARIM_API_URL', getOptionalEnv('NEDARIM_PAYMENT_URL', getOptionalEnv('NEDARIM_BASE_URL', '')));
    const mosadId = getOptionalEnv('NEDARIM_MOSAD_ID', getOptionalEnv('MOSAD_ID', ''));
    const shluha = getOptionalEnv('NEDARIM_SHLUHA', getOptionalEnv('SHLUHA', ''));
    const apiValid = getOptionalEnv('NEDARIM_API_VALID', getOptionalEnv('API_VALID', getOptionalEnv('NEDARIM_API_KEY', '')));
    const merchantId = getOptionalEnv('NEDARIM_MERCHANT_ID', '');
    const successUrl = getOptionalEnv('NEDARIM_SUCCESS_URL', '');
    const cancelUrl = getOptionalEnv('NEDARIM_CANCEL_URL', '');
    const callbackUrl = getOptionalEnv('NEDARIM_CALLBACK_URL', '');
    if (!apiBase || !mosadId || !shluha || !apiValid) return '';

    const paymentUrl = new URL(apiBase);
    const params = {
        MosadId: mosadId,
        Shluha: shluha,
        ApiValid: apiValid,
        Amount: String(Math.round(order.amount)),
        ClientName: order.name,
        ClientEmail: order.email,
        ClientPhone: order.phone,
        Comment: 'Order ' + orderId,
        OrderId: orderId,
        CallBack: callbackUrl,
        SuccessUrl: successUrl,
        CancelUrl: cancelUrl,
        MerchantId: merchantId
    };
    Object.entries(params).forEach(([key, value]) => {
        if (value) paymentUrl.searchParams.set(key, value);
    });
    return paymentUrl.toString();
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        methodNotAllowed(res, ['POST']);
        return;
    }

    try {
        const order = validatePayload(await readJsonBody(req));
        const businessEmail = getOptionalEnv('BUSINESS_EMAIL', 'aterethadar@gmail.com');
        const businessName = getOptionalEnv('BUSINESS_NAME', 'עטרת הדר');
        const orderId = 'EH-' + Date.now().toString(36).toUpperCase();
        const paymentUrl = createNedarimPaymentLink(order, orderId);
        await sendOrderEmails({ businessEmail, businessName, orderId, ...order });
        json(res, 200, {
            ok: true,
            orderId,
            paymentUrl,
            paymentMode: paymentUrl ? 'nedarim-plus' : 'manual'
        });
    } catch (error) {
        const message = typeof error.message === 'string' ? error.message : 'unknown-error';
        const status = message === 'email-send-failed' ? 500 : 400;
        json(res, status, { ok: false, error: message });
    }
};
