import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { startDate, endDate, geo, app_id, os, publisher, bundle } = body;

        let whereClause = 'WHERE dt >= ? AND dt <= ?';
        const params: any[] = [startDate, endDate];

        if (geo) {
            whereClause += ' AND geo = ?';
            params.push(geo);
        }
        if (app_id) {
            whereClause += ' AND app_id = ?';
            params.push(app_id);
        }
        if (os) {
            whereClause += ' AND os = ?';
            params.push(os);
        }
        if (publisher) {
            whereClause += ' AND publisher = ?';
            params.push(publisher);
        }
        if (bundle) {
            whereClause += ' AND bundle = ?';
            params.push(bundle);
        }

        // CVR: installs/clicks * 10000 (万分之)
        // EVR: events/clicks * 1000000 (百万分之)
        // ECPC: revenues/clicks * 1000000 (百万分之)
        // Note: We use DECIMAL/FLOAT logic. Doris handles division by zero by returning NULL usually, but we can also handle it.
        // However, for aggregation, safe division is preferred.
        // In MySQL/Doris: a / b. If b is 0, result is NULL. 

        // We will return raw aggregates and calculate rates in JS or SQL. 
        // Calculating in SQL to ensure consistency.
        const query = `
      SELECT 
        dt,
        SUM(clicks) as clicks,
        SUM(installs) as installs,
        SUM(events) as events,
        SUM(revenues) as revenues
      FROM click_postback_agg
      ${whereClause}
      GROUP BY dt
      ORDER BY dt ASC
    `;

        const [rows] = await pool.query<RowDataPacket[]>(query, params);

        const formattedRows = rows.map((row: any) => {
            const clicks = Number(row.clicks || 0);
            const installs = Number(row.installs || 0);
            const events = Number(row.events || 0);
            const revenues = Number(row.revenues || 0);

            return {
                dt: row.dt,
                clicks,
                installs,
                events,
                revenues,
                cvr: clicks > 0 ? Number(((installs / clicks) * 10000).toFixed(2)) : 0,
                evr: clicks > 0 ? Number(((events / clicks) * 1000000).toFixed(2)) : 0,
                ecpc: clicks > 0 ? Number(((revenues / clicks) * 1000000).toFixed(2)) : 0,
            };
        });

        return NextResponse.json({ data: formattedRows });
    } catch (error) {
        console.error('Trend API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
