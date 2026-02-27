'use server';

import { connect, keyStores } from 'near-api-js';

const FASTNEAR_RPC = 'https://rpc.fastnear.com';
const BURROW = 'contract.main.burrow.near';
const RHEA_API = 'https://api.rhea.finance/v3';

// Token metadata
const TOKENS: Record<string, { decimals: number; symbol: string }> = {
  'wrap.near': { decimals: 24, symbol: 'wNEAR' },
  'nbtc.bridge.near': { decimals: 8, symbol: 'nBTC' },
  'zec.omft.near': { decimals: 8, symbol: 'ZEC' },
  'usdt.tether-token.near': { decimals: 6, symbol: 'USDT' },
  'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near': { decimals: 6, symbol: 'USDC' },
};

// Price cache
let priceCache: Record<string, number> = {
  'wrap.near': 1.10,
  'nbtc.bridge.near': 67000,
  'zec.omft.near': 240,
  'usdt.tether-token.near': 1.0,
  'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near': 1.0,
};

// Account cache
let accountsCache: any[] = [];
let historyCache: Record<string, any[]> = {};
let lastFetch = 0;
const CACHE_TTL = 60 * 1000; // 1 minute (reduced from 5)

function getToken(tokenId: string) {
  return TOKENS[tokenId] || { decimals: 24, symbol: tokenId.slice(0, 10) };
}

async function fetchPrices() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=near,bitcoin,zcash&vs_currencies=usd', {
      cache: 'no-store'
    });
    const data = await res.json();
    if (data.near?.usd) priceCache['wrap.near'] = data.near.usd;
    if (data.bitcoin?.usd) priceCache['nbtc.bridge.near'] = data.bitcoin.usd;
    if (data.zcash?.usd) priceCache['zec.omft.near'] = data.zcash.usd;
  } catch (e) {
    console.error('Failed to fetch prices:', e);
  }
  return priceCache;
}

// Fetch trading history for a specific address (with pagination)
async function fetchTradingHistory(address: string): Promise<any[]> {
  try {
    const allRecords: any[] = [];
    let pageNum = 0;
    const pageSize = 100;
    let hasMore = true;
    
    while (hasMore) {
      const res = await fetch(
        `${RHEA_API}/margin-trading/position/history?address=${address}&page_num=${pageNum}&page_size=${pageSize}&order_column=close_timestamp&order_by=DESC&tokens=`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      
      if (data.code === 0 && data.data?.position_records) {
        const records = data.data.position_records;
        allRecords.push(...records);
        hasMore = records.length === 10 && allRecords.length < data.data.total;
        pageNum++;
      } else {
        hasMore = false;
      }
    }
    
    return allRecords;
  } catch (e) {
    console.error(`Failed to fetch history for ${address}:`, e);
    return [];
  }
}

// Fetch open position history to get entry prices
async function fetchOpenPositionHistory(address: string): Promise<Record<string, any>> {
  try {
    const res = await fetch(
      `${RHEA_API}/margin-trading/position/history?address=${address}&page_num=0&page_size=100&order_column=open_timestamp&order_by=DESC&tokens=`,
      { cache: 'no-store' }
    );
    const data = await res.json();
    
    if (data.code === 0 && data.data?.position_records) {
      // Create map of pos_id -> entry data
      const entryMap: Record<string, any> = {};
      for (const record of data.data.position_records) {
        // Extract position ID pattern: accountId_timestamp_posId
        const posId = record.pos_id;
        if (posId && record.entry_price) {
          entryMap[posId] = {
            entryPrice: parseFloat(record.entry_price),
            openTimestamp: record.open_timestamp,
            initialCollateral: parseFloat(record.amount_c || '0') / 1e18,
          };
        }
      }
      return entryMap;
    }
    return {};
  } catch (e) {
    console.error(`Failed to fetch open history for ${address}:`, e);
    return {};
  }
}

// Get all unique addresses and their trading history
async function fetchAllTradingHistory(addresses: string[]): Promise<Record<string, any[]>> {
  const history: Record<string, any[]> = {};
  
  // Fetch in parallel with rate limiting
  const chunks = [];
  for (let i = 0; i < addresses.length; i += 5) {
    chunks.push(addresses.slice(i, i + 5));
  }
  
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (address) => {
        history[address] = await fetchTradingHistory(address);
      })
    );
    // Small delay to avoid rate limits
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return history;
}

export async function forceRefresh() {
  'use server';
  lastFetch = 0; // Clear cache timestamp
  accountsCache = []; // Clear cached data
  priceCache = { // Reset to defaults
    'wrap.near': 1.10,
    'nbtc.bridge.near': 67000,
    'zec.omft.near': 240,
    'usdt.tether-token.near': 1.0,
    'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near': 1.0,
  };
  await fetchPrices(); // Fetch fresh prices
  return { success: true, timestamp: Date.now() };
}

async function fetchMarginAccounts() {
  const now = Date.now();
  
  if (accountsCache.length > 0 && now - lastFetch < CACHE_TTL) {
    return accountsCache;
  }
  
  const connection = await connect({
    networkId: 'mainnet',
    nodeUrl: FASTNEAR_RPC,
    keyStore: new keyStores.InMemoryKeyStore(),
  });

  const account = await connection.account(BURROW);
  
  const allAccounts: any[] = [];
  let fromIndex = 0;
  const batchSize = 500;
  
  while (true) {
    try {
      const batch = await account.viewFunction({
        contractId: BURROW,
        methodName: 'get_margin_accounts_paged',
        args: { from_index: fromIndex, limit: batchSize },
      });
      
      if (!batch || batch.length === 0) break;
      
      allAccounts.push(...batch);
      
      if (batch.length < batchSize) break;
      fromIndex += batchSize;
    } catch (e) {
      console.error('Error fetching accounts:', e);
      break;
    }
  }
  
  accountsCache = allAccounts;
  lastFetch = now;
  
  return allAccounts;
}

export interface Position {
  accountId: string;
  posId: string;
  type: 'Long' | 'Short';
  collateralToken: string;
  collateralAmount: number;
  collateralValue: number;
  borrowedToken: string;
  borrowedAmount: number;
  borrowedValue: number;
  positionToken: string;
  positionAmount: number;
  positionValue: number;
  entryPrice?: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  leverage: number;
  health: number;
}

export interface UserStats {
  accountId: string;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgLeverage: number;
  totalVolume: number;
  activePositions: Position[];
  closedPositions: any[];
}

function calculatePnL(
  accounts: any[], 
  prices: Record<string, number>,
  entryData: Record<string, any> = {}
): Position[] {
  const positions: Position[] = [];
  
  for (const acc of accounts) {
    if (!acc.margin_positions || Object.keys(acc.margin_positions).length === 0) continue;
    
    for (const [posId, pos] of Object.entries(acc.margin_positions)) {
      const p = pos as any;
      
      const collateralInfo = p.token_c_info || {};
      const borrowedInfo = p.token_d_info || {};
      const positionToken = p.token_p_id || 'unknown';
      
      const collateralToken = collateralInfo.token_id || 'unknown';
      const borrowedToken = borrowedInfo.token_id || 'unknown';
      
      // STRICT filter: Only include positions where BOTH collateral and borrowed tokens are known
      const KNOWN_TOKENS = ['wrap.near', 'nbtc.bridge.near', 'zec.omft.near', 'usdt.tether-token.near', 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near'];

      if (!KNOWN_TOKENS.includes(collateralToken) || !KNOWN_TOKENS.includes(borrowedToken)) {
        continue;
      }
      
      const getTokenDecimals = (tokenId: string) => {
        const decimals: Record<string, number> = {
          'wrap.near': 24,
          'nbtc.bridge.near': 24,
          'zec.omft.near': 18,  // Margin contract uses 18 for ZEC
          'usdt.tether-token.near': 18,
          'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near': 18, // USDC
        };
        return decimals[tokenId] || 18;
      };
      
      const COLLATERAL_DECIMALS = 18;
      const collateralAmount = Number(collateralInfo.balance || 0) / Math.pow(10, COLLATERAL_DECIMALS);
      const borrowedAmount = Number(borrowedInfo.balance || 0) / Math.pow(10, getTokenDecimals(borrowedToken));
      const positionAmount = Number(p.token_p_amount || 0) / Math.pow(10, getTokenDecimals(positionToken));
      
      const collateralPrice = prices[collateralToken] || 1;
      const borrowedPrice = prices[borrowedToken] || 1;
      const positionPrice = prices[positionToken] || 1;
      
      const collateralValue = collateralAmount * collateralPrice;
      const borrowedValue = borrowedAmount * borrowedPrice;
      const positionValue = positionAmount * positionPrice;
      
      // Determine position type:
      // SHORT: Borrowed token is sold → position is in collateral token
      // LONG: Borrowed collateral is used to buy → position is in target asset
      const isShort = positionToken === collateralToken;
      const type = isShort ? 'Short' : 'Long';

      // Calculate PnL using entry price if available (more accurate)
      // Otherwise fall back to current method (less accurate for positions with deposits)
      let pnl: number;
      let pnlPercent: number;
      let entryPrice: number | undefined;
      
      const positionEntry = entryData[posId];
      
      if (positionEntry?.entryPrice) {
        // Use entry price from Rhea API (for closed positions in history)
        entryPrice = positionEntry.entryPrice;
        const currentPrice = positionPrice;
        
        if (isShort) {
          // SHORT: Profit when price goes DOWN
          const priceDiff = entryPrice - currentPrice;
          pnl = priceDiff * positionAmount;
        } else {
          // LONG: Profit when price goes UP
          const priceDiff = currentPrice - entryPrice;
          pnl = priceDiff * positionAmount;
        }
        
        pnlPercent = collateralValue > 0 ? (pnl / collateralValue) * 100 : 0;
      } else {
        // Calculate entry price from blockchain data for active positions
        // Entry price = Total value at open / Position amount
        // For LONG: (initial_collateral + borrowed) / position_amount
        // For SHORT: (initial_collateral + borrowed) / position_amount
        
        if (positionAmount > 0) {
          // We can estimate entry price from current blockchain state
          // This assumes the position hasn't had additional deposits
          const totalValueAtEntry = (collateralValue + borrowedValue);
          entryPrice = totalValueAtEntry / positionAmount;
        }
        
        // Fallback: Use current method (may show fake profit from deposits)
        pnl = positionValue - borrowedValue;
        pnlPercent = collateralValue > 0 ? (pnl / collateralValue) * 100 : 0;
      }
      const leverage = collateralValue > 0 ? (collateralValue + borrowedValue) / collateralValue : 0;
      const health = borrowedValue > 0 ? collateralValue / borrowedValue : 999;
      
      positions.push({
        accountId: acc.account_id,
        posId,
        type,
        collateralToken: getToken(collateralToken).symbol,
        collateralAmount,
        collateralValue,
        borrowedToken: getToken(borrowedToken).symbol,
        borrowedAmount,
        borrowedValue,
        positionToken: getToken(positionToken).symbol,
        positionAmount,
        positionValue,
        entryPrice: entryPrice,
        currentPrice: positionPrice,
        pnl,
        pnlPercent,
        leverage,
        health,
      });
    }
  }
  
  return positions;
}

export async function getUserStats(address: string): Promise<UserStats> {
  const accounts = await fetchMarginAccounts();
  const prices = await fetchPrices();
  
  // Fetch entry price data for accurate P&L calculation
  const entryData = await fetchOpenPositionHistory(address);
  
  const allPositions = calculatePnL(accounts, prices, entryData);
  
  // Get active positions for this user
  const activePositions = allPositions.filter(p => p.accountId === address);
  const unrealizedPnL = activePositions.reduce((sum, p) => sum + p.pnl, 0);
  
  // Fetch trading history
  const closedPositions = await fetchTradingHistory(address);
  
  // Calculate realized PnL from closed positions (use Rhea's calculated value)
  let realizedPnL = 0;
  let totalVolume = 0;
  
  for (const pos of closedPositions) {
    const pnl = parseFloat(pos.pnl || '0');
    realizedPnL += pnl;
    
    // Calculate volume (collateral amount)
    const collateral = parseFloat(pos.amount_c || '0') / 1e18;
    totalVolume += collateral;
  }
  
  // Add active position collateral to volume
  totalVolume += activePositions.reduce((sum, p) => sum + p.collateralValue, 0);
  
  const totalTrades = closedPositions.length + activePositions.length;
  const winningTrades = closedPositions.filter(p => parseFloat(p.pnl || '0') > 0).length + 
                         activePositions.filter(p => p.pnl > 0).length;
  const losingTrades = totalTrades - winningTrades;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  
  const avgLeverage = activePositions.length > 0
    ? activePositions.reduce((sum, p) => sum + p.leverage, 0) / activePositions.length
    : 0;
  
  return {
    accountId: address,
    realizedPnL,
    unrealizedPnL,
    totalPnL: realizedPnL + unrealizedPnL,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    avgLeverage,
    totalVolume,
    activePositions,
    closedPositions,
  };
}

export async function getLeaderboard() {
  const accounts = await fetchMarginAccounts();
  const prices = await fetchPrices();
  
  // Fetch entry data for all unique accounts
  const uniqueAccounts = [...new Set(accounts.map(a => a.account_id))];
  const allEntryData: Record<string, any> = {};
  
  // Fetch entry prices for top accounts (limit to avoid rate limits)
  const topAccounts = uniqueAccounts.slice(0, 20);
  for (const addr of topAccounts) {
    const entryData = await fetchOpenPositionHistory(addr);
    Object.assign(allEntryData, entryData);
  }
  
  const positions = calculatePnL(accounts, prices, allEntryData);
  
  positions.sort((a, b) => b.pnl - a.pnl);
  
  const topPerformers = positions.slice(0, 10);
  const bottomPerformers = positions.slice(-10).reverse();
  
  const profitable = positions.filter(p => p.pnl > 0).length;
  const shorts = positions.filter(p => p.type === 'Short').length;
  
  return {
    totalPositions: positions.length,
    stats: {
      profitable,
      unprofitable: positions.length - profitable,
      profitRate: ((profitable / positions.length) * 100).toFixed(1) + '%',
      shorts,
      longs: positions.length - shorts,
      totalPnL: positions.reduce((sum, p) => sum + p.pnl, 0),
      avgPnLPercent: (positions.reduce((sum, p) => sum + p.pnlPercent, 0) / positions.length).toFixed(2) + '%',
    },
    topPerformers,
    worstPerformers: bottomPerformers,
  };
}

export async function getPositions(limit: number = 100, sortBy: string = 'pnl', order: 'asc' | 'desc' = 'desc') {
  const accounts = await fetchMarginAccounts();
  const prices = await fetchPrices();
  const positions = calculatePnL(accounts, prices, {});
  
  positions.sort((a, b) => {
    const multiplier = order === 'desc' ? -1 : 1;
    const aVal = a[sortBy as keyof Position];
    const bVal = b[sortBy as keyof Position];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal > bVal ? 1 : -1) * multiplier;
    }
    return 0;
  });
  
  return {
    total: positions.length,
    positions: positions.slice(0, limit),
  };
}
