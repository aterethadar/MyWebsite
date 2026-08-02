'use strict';

const { json, methodNotAllowed } = require('../_lib/http');
const { supabaseRequest } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        methodNotAllowed(res, ['GET']);
        return;
    }

    try {
        const rows = await supabaseRequest('testimonials?select=name,content,rating,image_data,submitted_at,status&status=eq.approved&order=submitted_at.desc&limit=50', {
            method: 'GET'
        });

        const testimonials = (Array.isArray(rows) ? rows : []).map((row) => ({
            name: row.name,
            content: row.content,
            rating: Number(row.rating),
            imageData: row.image_data || '',
            createdAt: row.submitted_at || null
        }));

        json(res, 200, {
            ok: true,
            testimonials
        });
    } catch (error) {
        json(res, 500, {
            ok: false,
            error: 'approved-fetch-failed',
            testimonials: []
        });
    }
};
