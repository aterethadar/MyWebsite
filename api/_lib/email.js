'use strict';

const { getOptionalEnv, requireEnv } = require('./config');

async function sendModerationEmail({ toEmail, businessName, customerName, rating, content, approveUrl, rejectUrl }) {
    const resendApiKey = requireEnv('RESEND_API_KEY');
    const fromEmail = getOptionalEnv('RESEND_FROM_EMAIL', 'onboarding@resend.dev');

    const subject = `המלצה חדשה ממתינה לאישור - ${businessName}`;
    const html = [
        '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">',
        `<h2 style="margin:0 0 12px">המלצה חדשה ממתינה לאישור</h2>`,
        `<p style="margin:0 0 8px"><strong>שם הלקוח:</strong> ${escapeHtml(customerName)}</p>`,
        `<p style="margin:0 0 8px"><strong>דירוג:</strong> ${Number(rating)} / 5</p>`,
        `<p style="margin:0 0 16px"><strong>תוכן:</strong><br>${escapeHtml(content)}</p>`,
        `<p style="margin:0 0 12px">בחרו פעולה:</p>`,
        `<p style="margin:0 0 8px"><a href="${approveUrl}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px">אישור ופרסום באתר</a></p>`,
        `<p style="margin:0 0 8px"><a href="${rejectUrl}" style="display:inline-block;padding:10px 16px;background:#b91c1c;color:#fff;text-decoration:none;border-radius:8px">דחייה</a></p>`,
        '<p style="margin-top:16px;font-size:13px;color:#6b7280">הקישורים חד-פעמיים ומיועדים לניהול ההמלצות באתר.</p>',
        '</div>'
    ].join('');

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: fromEmail,
            to: [toEmail],
            subject,
            html
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`email-send-failed:${response.status}:${err}`);
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

module.exports = {
    sendModerationEmail
};
