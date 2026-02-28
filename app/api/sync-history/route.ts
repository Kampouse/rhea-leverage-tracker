export const runtime = 'edge';

import { NextResponse } from 'next/server';

// D1 types (optional - only available in Cloudflare Workers)
type D1Database = any;

interface Env {
  DB?: D1Database;
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    // Fetch all history from Rhea API
    const RHEA_API = 'https://api.rhea.finance/v3';
    const allRecords: any[] = [];
    let pageNum = 0;
    const pageSize = 100;
    
    while (true) {
      const url = `${RHEA_API}/margin-trading/position/history?address=${address}&page_num=${pageNum}&page_size=${pageSize}&order_column=close_timestamp&order_by=DESC&tokens=`;
      
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Rhea-Leverage-Tracker/1.0',
        },
      });

      if (!res.ok) break;

      const data = await res.json();
      
      if (data.code === 0 && data.data?.position_records) {
        const records = data.data.position_records;
        allRecords.push(...records);
        
        if (records.length < pageSize) break;
        pageNum++;
        if (pageNum >= 20) break;
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        break;
      }
    }

    // Store in D1 (if available)
    const env = process.env as unknown as Env;
    if (env.DB) {
      const now = Date.now();
      
      // Batch insert
      const stmts = allRecords.map(record => {
        return env.DB.prepare(
          `INSERT OR REPLACE INTO trade_history 
           (account_id, pos_id, token_c, token_d, token_p, trend, entry_price, exit_price, 
            amount_c, amount_d, amount_p, pnl, open_timestamp, close_timestamp, close_type, fee, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          address,
          record.pos_id,
          record.token_c || '',
          record.token_d || '',
          record.token_p || '',
          record.trend || 'long',
          record.entry_price || '0',
          record.price || '0',
          record.amount_c || '0',
          record.amount_d || '0',
          record.amount_p || '0',
          parseFloat(record.pnl || '0'),
          record.open_timestamp || 0,
          record.close_timestamp || 0,
          record.close_type || 'close',
          record.fee || '0',
          now
        );
      });
      
      await env.DB.batch(stmts);
      
      // Update sync status
      await env.DB.prepare(
        `INSERT OR REPLACE INTO sync_status (account_id, last_sync, total_trades)
         VALUES (?, ?, ?)`
      ).bind(address, now, allRecords.length).run();
    }

    return NextResponse.json({
      success: true,
      address,
      totalRecords: allRecords.length,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Failed to sync history:', error);
    return NextResponse.json({ error: 'Failed to sync history' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    const env = process.env as unknown as Env;
    
    if (!env.DB) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Check sync status
    const syncStatus = await env.DB.prepare(
      'SELECT * FROM sync_status WHERE account_id = ?'
    ).bind(address).first();

    if (!syncStatus) {
      // Trigger sync
      return NextResponse.json({ 
        status: 'not_synced',
        message: 'History not yet synced. POST to /api/sync-history to sync.'
      });
    }

    // Fetch from D1
    const result = await env.DB.prepare(
      'SELECT * FROM trade_history WHERE account_id = ? ORDER BY close_timestamp DESC LIMIT 500'
    ).bind(address).all();

    return NextResponse.json({
      status: 'synced',
      lastSync: syncStatus.last_sync,
      totalTrades: syncStatus.total_trades,
      records: result.results
    });
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
