import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

const ALLOWED_GROUPS = [
    'geo', 'app_id', 'os', 'publisher', 'bundle', 'brand',
    'model', 'ad_type', 'bid_floor', 'osv'
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
            FROM click_postback_agg 
            ${whereClause} 
            ${groupByClause}
        ) as sub
    `;
        // Note: This count might be slow on huge datasets.

        // Sort
        // We calculate rates in the select so we can sort by them.
        // However, reusing alias in ORDER BY is standard SQL.
        // CVR: installs/clicks * 10000
        // EVR: events/clicks * 1000000
        // ECPC: revenues/clicks * 1000000

        // To sort by calculated fields in pagination correctly, we need them in the query.

        const dataQuery = `
      SELECT 
        ${selectGroups}
        SUM(clicks) as clicks,
        SUM(installs) as installs,
        SUM(events) as events,
        SUM(revenues) as revenues
      FROM click_postback_agg
      ${whereClause}
      ${groupByClause}
      ORDER BY ${sortField} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `;

        // Wait for both
        const [countRows]: any = await pool.query(countQuery, params);
        const total = countRows[0]?.total || 0;

        const [rows] = await pool.query<RowDataPacket[]>(dataQuery, params);

        const formattedRows = rows.map((row: any) => {
            const clicks = Number(row.clicks || 0);
            const installs = Number(row.installs || 0);
            const events = Number(row.events || 0);
            const revenues = Number(row.revenues || 0);

            return {
                ...row,
                clicks,
                installs,
                events,
                revenues,
                cvr: clicks > 0 ? Number(((installs / clicks) * 10000).toFixed(2)) : 0,
                evr: clicks > 0 ? Number(((events / clicks) * 1000000).toFixed(2)) : 0,
                ecpc: clicks > 0 ? Number(((revenues / clicks) * 1000000).toFixed(2)) : 0,
            };
        });

        // Note: The SQL order by for derived fields (cvr, evr...) 
        // Standard SQL allows ORDER BY alias. Doris supports this.
        // But if we want to be safe, we might need to duplicate the expression in ORDER BY if it fails.
        // Let's assume it works for now (MySQL standard). 
        // HOWEVER, for `cvr` we need to make sure the alias is available.
        // Actually, since I am doing calculation in JS for the final output, 
        // I ALSO need to do it in SQL for the sorting to work correctly on the DB side before LIMIT.
        // So I should include the calculation in the SELECT clause if I want to ORDER BY it.

        // Refined Query with calculated columns for sorting:
        const dataQueryRefined = `
      SELECT 
        ${selectGroups}
        SUM(clicks) as clicks,
        SUM(installs) as installs,
        SUM(events) as events,
        SUM(revenues) as revenues,
        (SUM(installs) / NULLIF(SUM(clicks), 0) * 10000) as cvr,
        (SUM(events) / NULLIF(SUM(clicks), 0) * 1000000) as evr,
        (SUM(revenues) / NULLIF(SUM(clicks), 0) * 1000000) as ecpc
      FROM click_postback_agg
      ${whereClause}
      ${groupByClause}
      ORDER BY ${sortField} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `;

        // Re-run with refined query
        const [rowsRefined] = await pool.query<RowDataPacket[]>(dataQueryRefined, params);

        const formattedRowsRefined = rowsRefined.map((row: any) => ({
            ...row,
            clicks: Number(row.clicks),
            installs: Number(row.installs),
            events: Number(row.events),
            revenues: Number(row.revenues),
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
