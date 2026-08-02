'use strict';

const { html, methodNotAllowed, json } = require('../_lib/http');
const { supabaseRequest } = require('../_lib/supabase');

function pageTemplate(title, message, color) {
    return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
body { font-family: Arial, sans-serif; margin: 0; background: #f8fafc; color: #111827; }
main { max-width: 620px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
h1 { margin-top: 0; color: ${color}; }
p { line-height: 1.7; }
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<p>${message}</p>
</main>
</body>
</html>`;
}

async function handleAction(action, token) {
    const tokenField = action === 'approve' ? 'approve_token' : 'reject_token';
    const statusValue = action === 'approve' ? 'approved' : 'rejected';

    const rows = await supabaseRequest(`testimonials?select=id,status&${tokenField}=eq.${encodeURIComponent(token)}&limit=1`, {
        method: 'GET'
    });

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
        return { code: 'not-found' };
    }

    if (row.status !== 'pending') {
        return { code: 'already-moderated' };
    }

    await supabaseRequest(`testimonials?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: {
            'Prefer': 'return=minimal'
        },
        body: {
            status: statusValue,
            moderated_at: new Date().toISOString(),
            moderator_action: action,
            approve_token: null,
            reject_token: null
        },
        noContent: true
    });

    return { code: 'ok', action };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        if (req.method === 'POST') {
            methodNotAllowed(res, ['GET']);
            return;
        }
        methodNotAllowed(res, ['GET']);
        return;
    }

    const action = String(req.query.action || '').trim();
    const token = String(req.query.token || '').trim();

    if (!token || (action !== 'approve' && action !== 'reject')) {
        html(res, 400, pageTemplate('קישור לא תקין', 'הקישור לאישור או דחייה אינו תקין. נסו לפתוח את הקישור מחדש מהמייל.', '#b91c1c'));
        return;
    }

    try {
        const result = await handleAction(action, token);

        if (result.code === 'ok' && action === 'approve') {
            html(res, 200, pageTemplate('ההמלצה אושרה', 'ההמלצה אושרה ותופיע באתר לאחר רענון הדף.', '#0f766e'));
            return;
        }

        if (result.code === 'ok' && action === 'reject') {
            html(res, 200, pageTemplate('ההמלצה נדחתה', 'ההמלצה נדחתה ולא תוצג באתר.', '#92400e'));
            return;
        }

        if (result.code === 'already-moderated') {
            html(res, 200, pageTemplate('כבר טופל', 'הקישור הזה כבר נוצל וההמלצה כבר טופלה בעבר.', '#1d4ed8'));
            return;
        }

        html(res, 404, pageTemplate('לא נמצא', 'לא נמצאה המלצה תואמת לקישור הזה. ייתכן שהקישור פג תוקף.', '#b91c1c'));
    } catch (error) {
        json(res, 500, { error: 'moderation-failed' });
    }
};
