export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createDb } from '@/db';
import { tradeHistory, syncStatus } from '@/db/schema';
import { eq } from 'drizzle-orm';

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

    // Get D1 binding
    const env = process.env as any;
    const db = env.DB ? createDb(env.DB) : null;

    if (db) {
      const now = Date.now();
      
      // Insert records using Drizzle
      for (const record of allRecords) {
        await db.insert(tradeHistory)
          .values({
            accountId: address,
            posId: record.pos_id,
            tokenC: record.token_c || '',
            tokenD: record.token_d || '',
            tokenP: record.token_p || '',
            trend: record.trend || 'long',
            entryPrice: record.entry_price || '0',
            exitPrice: record.price || '0',
            amountC: record.amount_c || '0',
            amountD: record.amount_d || '0',
            amountP: record.amount_p || '0',
            pnl: parseFloat(record.pnl || '0'),
            openTimestamp: record.open_timestamp || 0,
            closeTimestamp: record.close_timestamp || 0,
            closeType: record.close_type || 'close',
            fee: record.fee || '0',
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: tradeHistory.posId,
            set: {
              exitPrice: record.price || '0',
              pnl: parseFloat(record.pnl || '0'),
              closeTimestamp: record.close_timestamp || 0,
              updatedAt: now,
            },
          });
      }
      
      // Update sync status
      await db.insert(syncStatus)
        .values({
          accountId: address,
          lastSync: now,
          totalTrades: allRecords.length,
        })
        .onConflictDoUpdate({
          target: syncStatus.accountId,
          set: {
            lastSync: now,
            totalTrades: allRecords.length,
          },
        });
    }

    return NextResponse.json({
      success: true,
      address,
      totalRecords: allRecords.length,
      timestamp: Date.now(),
      dbEnabled: !!db,
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
    const env = process.env as any;
    const db = env.DB ? createDb(env.DB) : null;
    
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Check sync status
    const status = await db.select()
      .from(syncStatus)
      .where(eq(syncStatus.accountId, address))
      .limit(1);

    if (status.length === 0) {
      return NextResponse.json({ 
        status: 'not_synced',
        message: 'History not yet synced. POST to /api/sync-history to sync.'
      });
    }

    // Fetch from database using Drizzle
    const records = await db.select()
      .from(tradeHistory)
      .where(eq(tradeHistory.accountId, address))
      .limit(500);

    return NextResponse.json({
      status: 'synced',
      lastSync: status[0].lastSync,
      totalTrades: status[0].totalTrades,
      records,
    });
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
