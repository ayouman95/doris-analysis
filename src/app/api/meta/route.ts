import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

const ALLOWED_FIELDS = ['geo', 'app_id', 'os', 'publisher', 'bundle'];

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const field = searchParams.get('field');
        const search = searchParams.get('search') || '';

        if (!field || !ALLOWED_FIELDS.includes(field)) {
            return NextResponse.json({ data: [] });
        }

        // Limit to 50 results for autocomplete
        // Search using LIKE
        const query = `
        SELECT DISTINCT ${field} as value 
        FROM click_postback_agg 
        WHERE ${field} LIKE ? 
        LIMIT 50
    `;

        const [rows] = await pool.query<RowDataPacket[]>(query, [`%${search}%`]);

        return NextResponse.json({
            data: rows.map((r: any) => ({ value: r.value, label: r.value }))
        });

    } catch (error) {
        console.error('Meta API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
