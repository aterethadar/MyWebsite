'use strict';

const { json, methodNotAllowed, readJsonBody } = require('../_lib/http');
const { getOptionalEnv } = require('../_lib/config');
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
            json(res, 400, { ok: false, error: 'invalid-newsletter-details' });
            return;
        }

        await sendNewsletterCouponEmail({
            toEmail: email,
            customerName: name,
            couponCode: getOptionalEnv('NEWSLETTER_COUPON_CODE', 'ATERET10')
        });

        json(res, 200, { ok: true });
    } catch (error) {
        console.error('newsletter-submit-failed', error);
        json(res, 503, { ok: false, error: 'newsletter-send-failed' });
    }
};
