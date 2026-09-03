'use strict';

const { getOptionalEnv, requireEnv } = require('./config');

async function sendModerationEmail({ toEmail, businessName, customerName, customerEmail, rating, content, approveUrl, rejectUrl }) {
    const resendApiKey = requireEnv('RESEND_API_KEY');
    const fromEmail = getOptionalEnv('RESEND_FROM_EMAIL', 'onboarding@resend.dev');

    const subject = `המלצה חדשה ממתינה לאישור - ${businessName}`;
    const html = [
        '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">',
        `<h2 style="margin:0 0 12px">המלצה חדשה ממתינה לאישור</h2>`,
        `<p style="margin:0 0 8px"><strong>שם הלקוח:</strong> ${escapeHtml(customerName)}</p>`,
        `<p style="margin:0 0 8px"><strong>אימייל הלקוח:</strong> ${escapeHtml(customerEmail)}</p>`,
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

async function sendAuthCodeEmail({ toEmail, code }) {
    const resendApiKey = requireEnv('RESEND_API_KEY');
    const fromEmail = getOptionalEnv('RESEND_FROM_EMAIL', 'onboarding@resend.dev');
    const subject = 'קוד אימות חד-פעמי לאתר עטרת הדר';
    const html = [
        '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">',
        '<h2 style="margin:0 0 14px">קוד אימות חד-פעמי</h2>',
        `<p style="margin:0 0 12px">הקוד שלך להתחברות לאתר עטרת הדר הוא:</p>`,
        `<p style="margin:0 0 18px;font-size:24px;font-weight:700;letter-spacing:0.15em;">${escapeHtml(code)}</p>`,
        '<p style="margin:0 0 12px">הקוד תקף לשימוש אחד בלבד ופט כמה דקות בלבד.</p>',
        '<p style="margin:16px 0 0;font-size:13px;color:#6b7280">אם לא ביקשת התחברות, אפשר להתעלם מההודעה.</p>',
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

async function sendTestimonialThankYouEmail({ toEmail, customerName }) {
    const resendApiKey = requireEnv('RESEND_API_KEY');
    const fromEmail = getOptionalEnv('RESEND_FROM_EMAIL', 'onboarding@resend.dev');
    const subject = 'תודה רבה על ההמלצה שלך!';
    const html = [
        '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#2f261b;background:#f7f1e7;padding:28px">',
        '<div style="max-width:600px;margin:0 auto;background:#fffdf8;border:1px solid #e7d9bb;border-radius:12px;padding:28px">',
        `<h2 style="margin:0 0 18px;color:#8f671b">תודה רבה, ${escapeHtml(customerName)}!</h2>`,
        '<p style="margin:0 0 12px">תודה ששיתפת אותנו בחוות הדעת שלך. אנחנו מעריכים את הזמן שהקדשת ואת האמון שנתת בנו.</p>',
        '<p style="margin:0 0 12px">ההמלצה התקבלה ונשלחה לבדיקה קצרה לפני פרסום באתר. לאחר האישור היא תוכל לעזור ללקוחות נוספים להכיר את עטרת הדר.</p>',
        '<p style="margin:20px 0 0;color:#6b5b41">בברכה,<br><strong>צוות עטרת הדר</strong></p>',
        '</div></div>'
    ].join('');

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromEmail, to: [toEmail], subject, html })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`email-send-failed:${response.status}:${err}`);
    }
}

async function sendOrderEmails({ businessEmail, businessName, orderId, name, email, phone, address, deliveryMethod, deliveryNotes, items }) {
    const resendApiKey = requireEnv('RESEND_API_KEY');
    const fromEmail = getOptionalEnv('RESEND_FROM_EMAIL', 'onboarding@resend.dev');
    const deliveryText = deliveryMethod === 'delivery' ? 'משלוח עד הבית' : 'איסוף עצמי ממודיעין עילית';
    const itemsHtml = items.map(item => `<li>${escapeHtml(item.name)} × ${Number(item.quantity)} - ₪${Number(item.total)}</li>`).join('');
    const customerHtml = [
        '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#2f261b;background:#f7f1e7;padding:28px">',
        '<div style="max-width:620px;margin:0 auto;background:#fffdf8;border:1px solid #e7d9bb;border-radius:12px;padding:28px">',
        `<h2 style="margin:0 0 18px;color:#8f671b">תודה על ההזמנה שלך, ${escapeHtml(name)}!</h2>`,
        `<p>הזמנה מספר <strong>${escapeHtml(orderId)}</strong> התקבלה ונמצאת בטיפול.</p>`,
        `<p><strong>אופן קבלה:</strong> ${escapeHtml(deliveryText)}</p><p><strong>כתובת:</strong> ${escapeHtml(address || 'לא נדרשה באיסוף עצמי')}</p>`,
        `<p><strong>פרטי ההזמנה:</strong></p><ul>${itemsHtml}</ul>`,
        `<p><strong>הערות:</strong> ${escapeHtml(deliveryNotes || 'אין הערות')}</p>`,
        '<p style="margin-top:20px;color:#6b5b41">ניצור איתך קשר להשלמת הפרטים ולתיאום האיסוף או המשלוח.<br>תודה שבחרת בעטרת הדר.</p>',
        '</div></div>'
    ].join('');
    const businessHtml = [
        '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#2f261b">',
        `<h2>הזמנה חדשה ${escapeHtml(orderId)}</h2>`,
        `<p><strong>שם מלא:</strong> ${escapeHtml(name)}</p><p><strong>אימייל:</strong> ${escapeHtml(email)}</p><p><strong>טלפון:</strong> ${escapeHtml(phone)}</p>`,
        `<p><strong>אופן קבלה:</strong> ${escapeHtml(deliveryText)}</p><p><strong>כתובת:</strong> ${escapeHtml(address || 'לא נדרשה באיסוף עצמי')}</p><p><strong>הערות:</strong> ${escapeHtml(deliveryNotes || 'אין הערות')}</p>`,
        `<ul>${itemsHtml}</ul>`,
        '</div>'
    ].join('');
    const send = (toEmail, subject, html) => fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromEmail, to: [toEmail], subject, html })
    });
    const [businessResponse, customerResponse] = await Promise.all([
        send(businessEmail, `הזמנה חדשה ${orderId} - ${businessName}`, businessHtml),
        send(email, 'תודה על ההזמנה שלך בעטרת הדר!', customerHtml)
    ]);
    if (!businessResponse.ok || !customerResponse.ok) throw new Error('email-send-failed');
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
    sendModerationEmail,
    sendAuthCodeEmail,
    sendTestimonialThankYouEmail,
    sendOrderEmails
};
