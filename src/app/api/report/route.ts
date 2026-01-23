import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

const ALLOWED_GROUPS = [
    'geo', 'app_id', 'os', 'publisher', 'bundle'
];

type SortField = 'clicks' | 'installs' | 'events' | 'revenues' | 'cvr' | 'evr' | 'ecpc';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            startDate,
            endDate,
            geo,
            app_id,
            os,
            publisher,
            bundle,
            groupBy = [],
            page = 1,
            pageSize = 20,
            sortField = 'clicks',
            sortOrder = 'desc'
        } = body;

        // Filters
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

        // Grouping
        // Ensure groupBy fields are allowed
        const safeGroupBy = (groupBy as string[]).filter(g => ALLOWED_GROUPS.includes(g));
        if (safeGroupBy.length === 0) {
            // Default grouping if none provided? Or maybe just total?
            // Requirement says "can select 3 grouping fields".
            // We'll proceed even if empty, effectivly total agg.
        }

        const groupByClause = safeGroupBy.length > 0 ? `GROUP BY ${safeGroupBy.join(', ')}` : '';
        const selectGroups = safeGroupBy.length > 0 ? `${safeGroupBy.join(', ')},` : '';

        // Count Total (for pagination)
        // Note: Counting distinct groups can be expensive in Doris/OLAP if high cardinality.
        // For pagination we usually need a count. 
        // Optimization: Wrapped in subquery? Or approximate?
        // Let's do a separate count query or SQL_CALC_FOUND_ROWS equivalent (not always supported).
        // Simple count first.
        const countQuery = `
        SELECT count(*) as total FROM (
            SELECT 1 
            FROM click_postback_agg_v2
            ${whereClause} 
            ${groupByClause}
        ) as sub
    `;
        // Note: This count might be slow on huge datasets.

        // Sort
        // We calculate rates in the select so we can sort by them.
        // However, reusing alias in ORDER BY is standard SQL.
        // We include calculated fields in the SELECT clause to allow sorting by them.
        const dataQuery = `
      SELECT 
        ${selectGroups}
        SUM(clicks) as clicks,
        SUM(installs) as installs,
        SUM(events) as events,
        SUM(revenues) as revenues,
        (SUM(installs) / NULLIF(SUM(clicks), 0) * 10000) as cvr,
        (SUM(events) / NULLIF(SUM(clicks), 0) * 1000000) as evr,
        (SUM(revenues) / NULLIF(SUM(clicks), 0) * 1000000) as ecpc
      FROM click_postback_agg_v2
      ${whereClause}
      ${groupByClause}
      ORDER BY ${sortField} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `;

        // Wait for count
        const [countRows]: any = await pool.query(countQuery, params);
        const total = countRows[0]?.total || 0;

        // Execute data query
        const [rows] = await pool.query<RowDataPacket[]>(dataQuery, params);

        const formattedRowsRefined = rows.map((row: any) => ({
            ...row,
            clicks: Number(row.clicks || 0),
            installs: Number(row.installs || 0),
            events: Number(row.events || 0),
            revenues: Number(row.revenues || 0),
            cvr: Number(Number(row.cvr || 0).toFixed(2)),
            evr: Number(Number(row.evr || 0).toFixed(2)),
            ecpc: Number(Number(row.ecpc || 0).toFixed(2)),
        }));

        return NextResponse.json({
            data: formattedRowsRefined,
            total: Number(total),
            page,
            pageSize
        });
    } catch (error) {
        console.error('Report API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
