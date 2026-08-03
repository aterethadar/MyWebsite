'use strict';

const { json, methodNotAllowed, readJsonBody } = require('./_lib/http');
const { sendAuthCodeEmail } = require('./_lib/email');

function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        methodNotAllowed(res, ['POST']);
        return;
    }

    try {
        const payload = await readJsonBody(req);
        const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
        const code = typeof payload.code === 'string' ? payload.code.trim() : '';

        if (!isValidEmail(email) || !code || code.length < 4 || code.length > 10) {
            json(res, 400, {
                ok: false,
                error: 'invalid-payload'
            });
            return;
        }

        await sendAuthCodeEmail({ toEmail: email, code });

        json(res, 200, {
            ok: true,
            message: 'code-sent'
        });
    } catch (error) {
        const message = typeof error.message === 'string' ? error.message : 'unknown-error';
        json(res, 500, {
            ok: false,
            error: message
        });
    }
};
