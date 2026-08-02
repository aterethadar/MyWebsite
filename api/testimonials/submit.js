'use strict';

const crypto = require('crypto');
const { getOptionalEnv, requireEnv } = require('../_lib/config');
const { json, methodNotAllowed, readJsonBody } = require('../_lib/http');
const { supabaseRequest } = require('../_lib/supabase');
const { sendModerationEmail } = require('../_lib/email');

function validatePayload(payload) {
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const content = typeof payload.content === 'string' ? payload.content.trim() : '';
    const rating = Number(payload.rating);
    const imageData = typeof payload.imageData === 'string' ? payload.imageData.trim() : '';

    if (!name || !content || Number.isNaN(rating)) {
        throw new Error('missing-required-fields');
    }

    if (rating < 1 || rating > 5) {
        throw new Error('invalid-rating');
    }

    if (content.length > 1200) {
        throw new Error('content-too-long');
    }

    if (name.length > 120) {
        throw new Error('name-too-long');
    }

    if (imageData && imageData.length > 1_500_000) {
        throw new Error('image-too-large');
    }

    return { name, content, rating, imageData };
}

function createToken() {
    return crypto.randomBytes(24).toString('hex');
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        methodNotAllowed(res, ['POST']);
        return;
    }

    try {
        const payload = await readJsonBody(req);
        const { name, content, rating, imageData } = validatePayload(payload);

        const approveToken = createToken();
        const rejectToken = createToken();

        const rows = await supabaseRequest('testimonials?select=id&limit=1', {
            method: 'POST',
            headers: {
                'Prefer': 'return=representation'
            },
            body: {
                name,
                content,
                rating,
                image_data: imageData || null,
                status: 'pending',
                approve_token: approveToken,
                reject_token: rejectToken
            }
        });

        const inserted = Array.isArray(rows) ? rows[0] : null;
        if (!inserted || !inserted.id) {
            throw new Error('insert-failed');
        }

        const siteBaseUrl = requireEnv('SITE_BASE_URL').replace(/\/$/, '');
        const businessEmail = getOptionalEnv('BUSINESS_EMAIL', 'aterethadar@gmail.com');
        const businessName = getOptionalEnv('BUSINESS_NAME', 'עטרת הדר');

        const approveUrl = `${siteBaseUrl}/api/testimonials/moderate?action=approve&token=${encodeURIComponent(approveToken)}`;
        const rejectUrl = `${siteBaseUrl}/api/testimonials/moderate?action=reject&token=${encodeURIComponent(rejectToken)}`;

        await sendModerationEmail({
            toEmail: businessEmail,
            businessName,
            customerName: name,
            rating,
            content,
            approveUrl,
            rejectUrl
        });

        json(res, 200, {
            ok: true,
            message: 'submitted-for-approval'
        });
    } catch (error) {
        const message = typeof error.message === 'string' ? error.message : 'unknown-error';
        json(res, 400, {
            ok: false,
            error: message
        });
    }
};
