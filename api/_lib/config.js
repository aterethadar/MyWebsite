'use strict';

function requireEnv(name) {
    const value = process.env[name];
    if (!value || !value.trim()) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value.trim();
}

function getOptionalEnv(name, fallback = '') {
    const value = process.env[name];
    if (!value || !value.trim()) {
        return fallback;
    }
    return value.trim();
}

module.exports = {
    requireEnv,
    getOptionalEnv
};
