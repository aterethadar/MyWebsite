'use strict';

const { json, methodNotAllowed, readJsonBody } = require('../_lib/http');
const { getOptionalEnv, requireEnv } = require('../_lib/config');
const { sendNewsletterCouponEmail } = require('../_lib/email');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        methodNotAllowed(res, ['POST']);
        return;
    }

    try {
        const payload = await readJsonBody(req);
        const name = typeof payload.name === 'string' ? payload.name.trim() : '';
        const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
        if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('invalid-newsletter-details');
        }

        await sendNewsletterCouponEmail({
            toEmail: email,
            customerName: name,
            couponCode: getOptionalEnv('NEWSLETTER_COUPON_CODE', 'ATERET10')
        });

        json(res, 200, { ok: true });
    } catch (error) {
        json(res, 400, { ok: false, error: error.message || 'newsletter-send-failed' });
    }
};