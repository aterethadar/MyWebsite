'use strict';

const { getOptionalEnv } = require('../_lib/config');
const { json, methodNotAllowed } = require('../_lib/http');
const { supabaseRequest } = require('../_lib/supabase');
const { sendOrderEmails } = require('../_lib/email');

async function readCallback(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) return req.body && typeof req.body === 'object' ? req.body : {};
    try { return JSON.parse(raw); }
    catch { return Object.fromEntries(new URLSearchParams(raw)); }
}

function value(payload, ...keys) {
    const nested = payload.Value && typeof payload.Value === 'object' ? payload.Value : {};
    for (const source of [payload, nested]) {
        for (const key of keys) {
            const item = source[key];
            if (item !== undefined && item !== null && String(item).trim()) return String(item).trim();
        }
    }
    return '';
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    try {
        const callback = await readCallback(req);
        const orderId = value(callback, 'OrderId', 'orderId', 'Param1');
        const transactionId = value(callback, 'TransactionId', 'transactionId', 'TransactionID');
        const status = value(callback, 'Status', 'status').toUpperCase();
        const mosadId = value(callback, 'MosadId', 'mosadId') || getOptionalEnv('NEDARIM_MOSAD_ID', '7019114');
        if (!orderId || !transactionId) return json(res, 400, { ok: false, error: 'missing-callback-fields' });
        if (mosadId !== getOptionalEnv('NEDARIM_MOSAD_ID', '7019114')) return json(res, 400, { ok: false, error: 'mosad-mismatch' });
        if (status !== 'OK') return json(res, 400, { ok: false, error: 'payment-not-approved' });

        const rows = await supabaseRequest('orders?select=*&order_id=eq.' + encodeURIComponent(orderId) + '&limit=1');
        const order = Array.isArray(rows) ? rows[0] : null;
        if (!order) return json(res, 404, { ok: false, error: 'order-not-found' });
        if (order.status === 'paid') return json(res, 200, { ok: true, status: 'already-paid', orderId });

        const amount = Number(value(callback, 'Amount', 'amount'));
        if (!Number.isFinite(amount) || Math.round(amount) !== Math.round(Number(order.amount))) {
            return json(res, 400, { ok: false, error: 'payment-amount-mismatch' });
        }

        const updated = await supabaseRequest('orders?order_id=eq.' + encodeURIComponent(orderId) + '&status=eq.pending', {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: {
                status: 'paid',
                transaction_id: transactionId,
                confirmation_number: value(callback, 'ConfirmationNum', 'ConfirmationNumber', 'confirmationNum') || null,
                payment_response: callback,
                paid_at: new Date().toISOString()
            }
        });
        if (!Array.isArray(updated) || !updated.length) {
            const current = await supabaseRequest('orders?select=status&order_id=eq.' + encodeURIComponent(orderId) + '&limit=1');
            if (Array.isArray(current) && current[0]?.status === 'paid') return json(res, 200, { ok: true, status: 'already-paid', orderId });
            return json(res, 409, { ok: false, error: 'order-state-update-failed' });
        }

        const businessEmail = getOptionalEnv('BUSINESS_EMAIL', 'aterethadar@gmail.com');
        const businessName = getOptionalEnv('BUSINESS_NAME', 'עטרת הדר');
        try {
            await sendOrderEmails({
                businessEmail, businessName, orderId,
                name: order.name, email: order.email, phone: order.phone,
                address: order.address || '',
                deliveryMethod: order.delivery_method || 'pickup',
                deliveryNotes: order.delivery_notes || '',
                items: Array.isArray(order.items) ? order.items : []
            });
        } catch (emailError) {
            console.error('Paid order email failed', { orderId, message: emailError.message });
        }
        return json(res, 200, { ok: true, status: 'paid', orderId });
    } catch (error) {
        console.error('Nedarim callback failed', error);
        return json(res, 500, { ok: false, error: 'callback-processing-failed' });
    }
};
