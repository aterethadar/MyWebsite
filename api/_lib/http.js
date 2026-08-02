'use strict';

function json(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(payload));
}

function methodNotAllowed(res, allowed) {
    res.statusCode = 405;
    res.setHeader('Allow', allowed.join(', '));
    json(res, 405, { error: 'method-not-allowed' });
}

function html(res, statusCode, content) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(content);
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => {
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                if (!raw) {
                    resolve({});
                    return;
                }
                resolve(JSON.parse(raw));
            } catch (error) {
                reject(new Error('invalid-json'));
            }
        });
        req.on('error', () => reject(new Error('request-read-failed')));
    });
}

module.exports = {
    json,
    html,
    methodNotAllowed,
    readJsonBody
};
