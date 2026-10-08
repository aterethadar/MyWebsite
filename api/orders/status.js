'use strict';

const { json, methodNotAllowed } = require('../_lib/http');
const { supabaseRequest } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        methodNotAllowed(res, ['GET']);
        return;
    }

    try {
        const orderId = String(req.query?.orderId || '').trim();
        const transactionId = String(req.query?.transactionId || '').trim();
        if (!orderId || !transactionId) {
            json(res, 400, { ok: false, error: 'missing-payment-fields' });
            return;
        }

        const rows = await supabaseRequest(
            `orders?select=status,transaction_id&order_id=eq.${encodeURIComponent(orderId)}&transaction_id=eq.${encodeURIComponent(transactionId)}&limit=1`
        );
        const order = Array.isArray(rows) ? rows[0] : null;
        if (!order) {
            json(res, 404, { ok: false, status: 'not-found' });
            return;
        }

        json(res, 200, {
            ok: true,
            status: order.status === 'paid' ? 'paid' : 'pending'
        });
    } catch (error) {
        console.error('Order payment status lookup failed:', error.message);
        json(res, 500, { ok: false, error: 'payment-status-unavailable' });
    }
};