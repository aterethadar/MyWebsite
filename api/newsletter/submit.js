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

        const couponCode = getOptionalEnv('NEWSLETTER_COUPON_CODE', 'ATERET10');
        await sendNewsletterCouponEmail({
            toEmail: email,
            customerName: name,
            couponCode
        });

        json(res, 200, { ok: true, couponCode });
    } catch (error) {
        const message = typeof error.message === 'string' ? error.message : 'unknown-error';
        if (message !== 'invalid-newsletter-details') {
            console.error('newsletter-submit-failed', error);
        }
        json(res, message === 'invalid-newsletter-details' ? 400 : 503, {
            ok: false,
            error: message === 'invalid-newsletter-details' ? message : 'newsletter-send-failed'
        });
    }
};