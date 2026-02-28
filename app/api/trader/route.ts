export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createDb } from '@/db';
import { tradeHistory, syncStatus } from '@/db/schema';
import { eq } from 'drizzle-orm';

const RHEA_API = 'https://api.rhea.finance/v3';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    const env = process.env as any;
    const db = env.DB ? createDb(env.DB) : null;

    let closedPositions: any[] = [];
    let isCached = false;
    let lastSync = 0;

    // Check D1 cache first
    if (db) {
      const records = await db.select()
        .from(tradeHistory)
        .where(eq(tradeHistory.accountId, address));

      if (records.length > 0) {
        closedPositions = records.map((record: any) => ({
          pos_id: record.posId,
          token_c: record.tokenC,
          token_d: record.tokenD,
          token_p: record.tokenP,
          trend: record.trend,
          price: record.exitPrice,
          entry_price: record.entryPrice,
          amount_c: record.amountC,
          amount_d: record.amountD,
          amount_p: record.amountP,
          pnl: record.pnl,
          open_timestamp: record.openTimestamp,
          close_timestamp: record.closeTimestamp,
          close_type: record.closeType,
          fee: record.fee,
        }));
        isCached = true;

        // Get last sync time
        const status = await db.select()
          .from(syncStatus)
          .where(eq(syncStatus.accountId, address))
          .limit(1);
        lastSync = status[0]?.lastSync || 0;
      }
    }

    // Calculate stats from closed positions
    let realizedPnL = 0;
    let totalVolume = 0;
    let winningTrades = 0;

    for (const pos of closedPositions) {
      const entryPrice = parseFloat(pos.entry_price || '0');
      const closePrice = parseFloat(pos.price || '0');
      const trend = pos.trend || 'long';
      const isShort = trend === 'short' || trend === 'SHORT';
      const tokenP = pos.token_p || '';
      const tokenD = pos.token_d || '';

      let amountRaw: number;
      let decimals: number;

      if (isShort) {
        amountRaw = parseFloat(pos.amount_d || '0');
        decimals = tokenD.includes('wrap.near') ? 24 : 18;
      } else {
        amountRaw = parseFloat(pos.amount_p || '0');
        decimals = tokenP.includes('wrap.near') ? 24 : 18;
      }

      const amount = amountRaw / Math.pow(10, decimals);

      let correctPnl = 0;
      if (entryPrice > 0 && amount > 0) {
        correctPnl = isShort
          ? amount * (entryPrice - closePrice)
          : amount * (closePrice - entryPrice);
        if (correctPnl > 0) winningTrades++;
      }

      realizedPnL += correctPnl;
      totalVolume += parseFloat(pos.amount_c || '0') / 1e18;
    }

    const totalTrades = closedPositions.length;
    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Get last trade date
    const lastTrade = closedPositions.length > 0
      ? Math.max(...closedPositions.map(p => p.close_timestamp || 0))
      : null;

    // Trigger background sync if not cached
    if (!isCached && db) {
      // Async sync - don't wait
      fetch(`${RHEA_API}/margin-trading/position/history?address=${address}&page_num=0&page_size=10&order_column=close_timestamp&order_by=DESC&tokens=`)
        .then(r => r.json())
        .then(data => {
          if (data.code === 0 && data.data?.total > 0) {
            // Trigger full sync in background
            const syncUrl = new URL('/api/sync-history', request.url);
            fetch(`${syncUrl.origin}/api/sync-history?address=${address}&maxPages=5`, { method: 'POST' }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    return NextResponse.json({
      accountId: address,
      hasActivePositions: false, // Will be updated by client if needed
      activePositions: [],
      closedPositions: closedPositions.slice(0, 50), // Return last 50 for chart
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      realizedPnL,
      unrealizedPnL: 0,
      totalPnL: realizedPnL,
      totalVolume,
      lastTradeDate: lastTrade,
      isCached,
      lastSync,
      dbEnabled: !!db,
    }, {
      headers: {
        'Cache-Control': 's-maxage=30, stale-while-revalidate=10',
      },
    });
  } catch (error) {
    console.error('Failed to fetch trader:', error);
    return NextResponse.json({ error: 'Failed to fetch trader' }, { status: 500 });
  }
}
