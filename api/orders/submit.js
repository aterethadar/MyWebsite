'use strict';

const { getOptionalEnv, requireEnv } = require('../_lib/config');
const { json, methodNotAllowed, readJsonBody } = require('../_lib/http');
const { sendOrderEmails } = require('../_lib/email');

function validatePayload(payload) {
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : '';
    const address = typeof payload.address === 'string' ? payload.address.trim() : '';
    const deliveryMethod = payload.deliveryMethod === 'delivery' ? 'delivery' : 'pickup';
    const deliveryNotes = typeof payload.deliveryNotes === 'string' ? payload.deliveryNotes.trim() : '';
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (!name || !email || !phone || items.length === 0) throw new Error('missing-required-fields');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid-email');
    if (name.length > 120 || phone.length > 40 || deliveryNotes.length > 2000) throw new Error('field-too-long');
    if (deliveryMethod === 'delivery' && !address) throw new Error('delivery-address-required');

    const safeItems = items.map(item => ({
        name: typeof item.name === 'string' ? item.name.trim() : '',
        quantity: Number(item.quantity),
        total: Number(item.total)
    }));
    if (safeItems.some(item => !item.name || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 || !Number.isFinite(item.total) || item.total < 0)) {
        throw new Error('invalid-items');
    }

    return { name, email, phone, address, deliveryMethod, deliveryNotes, items: safeItems };
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
        const orderId = `EH-${Date.now().toString(36).toUpperCase()}`;
        await sendOrderEmails({ businessEmail, businessName, orderId, ...order });
        json(res, 200, { ok: true, orderId });
    } catch (error) {
        const message = typeof error.message === 'string' ? error.message : 'unknown-error';
        const status = message === 'email-send-failed' ? 500 : 400;
        json(res, status, { ok: false, error: message });
    }
};
