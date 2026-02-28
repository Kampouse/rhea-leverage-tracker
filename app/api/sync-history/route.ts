export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createDb } from '@/db';
import { tradeHistory, syncStatus } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const startPage = parseInt(searchParams.get('startPage') || '0');
  const maxPages = parseInt(searchParams.get('maxPages') || '10'); // Sync 10 pages at a time

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    const RHEA_API = 'https://api.rhea.finance/v3';
    const allRecords: any[] = [];
    let pageNum = startPage;
    
    // Get total count first
    const totalRes = await fetch(`${RHEA_API}/margin-trading/position/history?address=${address}&page_num=0&page_size=10&order_column=close_timestamp&order_by=DESC&tokens=`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Rhea-Leverage-Tracker/1.0',
      },
    });
    const totalData = await totalRes.json();
    const totalRecords = totalData.data?.total || 0;

    // Fetch pages
    const endPage = Math.min(startPage + maxPages, 100);
    
    while (pageNum < endPage) {
      const url = `${RHEA_API}/margin-trading/position/history?address=${address}&page_num=${pageNum}&page_size=100&order_column=close_timestamp&order_by=DESC&tokens=`;

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

        if (records.length === 0) break;

        allRecords.push(...records);

        if (totalRecords > 0 && allRecords.length >= totalRecords - (startPage * 10)) break;

        pageNum++;
      } else {
        break;
      }
    }

    // Get D1 binding
    const env = process.env as any;
    const db = env.DB ? createDb(env.DB) : null;

    let syncedCount = 0;
    if (db && allRecords.length > 0) {
      const now = Date.now();
      
      // Insert records
      for (const record of allRecords) {
        try {
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
          syncedCount++;
        } catch (e) {
          // Skip errors
        }
      }
      
      // Update sync status
      const existingStatus = await db.select()
        .from(syncStatus)
        .where(eq(syncStatus.accountId, address))
        .limit(1);
      
      const newTotal = (existingStatus[0]?.totalTrades || 0) + syncedCount;
      
      await db.insert(syncStatus)
        .values({
          accountId: address,
          lastSync: now,
          totalTrades: Math.min(newTotal, totalRecords),
        })
        .onConflictDoUpdate({
          target: syncStatus.accountId,
          set: {
            lastSync: now,
            totalTrades: Math.min(newTotal, totalRecords),
          },
        });
    }

    const hasMore = (pageNum * 10) < totalRecords;

    return NextResponse.json({
      success: true,
      address,
      totalRecords,
      syncedThisRun: syncedCount,
      pagesFetched: pageNum - startPage,
      nextPage: hasMore ? pageNum : null,
      hasMore,
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

    // Fetch from database using Drizzle (no limit - get all trades)
    const records = await db.select()
      .from(tradeHistory)
      .where(eq(tradeHistory.accountId, address));

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
