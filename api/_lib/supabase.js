'use strict';

const { requireEnv } = require('./config');

function getSupabaseConfig() {
    const baseUrl = requireEnv('SUPABASE_URL').replace(/\/$/, '');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    return { baseUrl, serviceRoleKey };
}

async function supabaseRequest(path, options = {}) {
    const { baseUrl, serviceRoleKey } = getSupabaseConfig();

    const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`supabase-request-failed:${response.status}:${errorBody}`);
    }

    if (options.noContent) {
        return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

module.exports = {
    supabaseRequest
};
