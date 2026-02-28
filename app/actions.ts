'use server';

import { connect, keyStores } from 'near-api-js';

const FASTNEAR_RPC = 'https://rpc.fastnear.com';
const BURROW = 'contract.main.burrow.near';
const RHEA_API = 'https://api.rhea.finance/v3';

// Token metadata cache (fetched from contracts)
interface TokenMeta {
  baseDecimals: number;      // Token's native decimals (from ft_metadata)
  extraDecimals: number;     // Burrow extra decimals (from get_asset)
  marginDecimals: number;    // Total decimals for margin (base + extra)
  symbol: string;
}
let tokenMetaCache: Record<string, TokenMeta> = {};
let tokenMetaFetched = false;

// Price cache (starts empty, fetched from API)
let priceCache: Record<string, number> = {};

// Account cache
let accountsCache: any[] = [];
let historyCache: Record<string, any[]> = {};
let lastFetch = 0;
const CACHE_TTL = 60 * 1000; // 1 minute (reduced from 5)

// Fetch token metadata from Burrow contract and token contracts
async function fetchTokenMetadata(connection: any): Promise<void> {
  if (tokenMetaFetched) return;
  
  try {
    const account = await connection.account(BURROW);
    
    // Get registered tokens from margin config
    const config = await account.viewFunction({
      contractId: BURROW,
      methodName: 'get_margin_config',
      args: {},
    });
    
    const tokenIds = Object.keys(config.registered_tokens || {});
    
    // Fetch metadata for each token
    for (const tokenId of tokenIds) {
      try {
        // Get extra decimals from Burrow
        const asset = await account.viewFunction({
          contractId: BURROW,
          methodName: 'get_asset',
          args: { token_id: tokenId },
        });
        const extraDecimals = asset.config?.extra_decimals || 0;
        
        // Get base decimals from token contract
        let baseDecimals = 18; // default
        let symbol = tokenId.slice(0, 10);
        
        try {
          const tokenAccount = await connection.account(tokenId);
          const metadata = await tokenAccount.viewFunction({
            contractId: tokenId,
            methodName: 'ft_metadata',
            args: {},
          });
          baseDecimals = metadata.decimals || 18;
          symbol = metadata.symbol || symbol;
        } catch {
          // Token contract might not exist or not have ft_metadata
        }
        
        tokenMetaCache[tokenId] = {
          baseDecimals,
          extraDecimals,
          marginDecimals: baseDecimals + extraDecimals,
          symbol,
        };
      } catch (e) {
        console.error(`Failed to fetch metadata for ${tokenId}:`, e);
      }
    }
    
    tokenMetaFetched = true;
  } catch (e) {
    console.error('Failed to fetch token metadata:', e);
  }
}

function getToken(tokenId: string): TokenMeta {
  return tokenMetaCache[tokenId] || { 
    baseDecimals: 18, 
    extraDecimals: 0, 
    marginDecimals: 18, 
    symbol: tokenId.slice(0, 10) 
  };
}

async function fetchPrices() {
  try {
    const res = await fetch('https://1click.chaindefuser.com/v0/tokens', {
      cache: 'no-store'
    });
    const tokens = await res.json();
    
    // Build price cache from all tokens
    for (const token of tokens) {
      // Map assetId to our token IDs (remove "nep141:" prefix if present)
      const tokenId = token.assetId.replace(/^nep141:/, '');
      if (token.price) {
        priceCache[tokenId] = token.price;
        
        // Also map omft.near tokens to factory.bridge.near format for backward compatibility
        if (tokenId.includes('.omft.near')) {
          // Example: eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near
          //      -> 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near
          //      -> a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near (without 0x)
          const match = tokenId.match(/^(?:eth-)?(0x[a-f0-9]+)\.omft\.near$/i);
          if (match) {
            const address = match[1];
            // Map with 0x prefix
            priceCache[`${address}.factory.bridge.near`] = token.price;
            // Map without 0x prefix (some contracts use this format)
            priceCache[`${address.substring(2)}.factory.bridge.near`] = token.price;
          }
        }
      }
    }
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
  priceCache = {}; // Reset price cache
  tokenMetaCache = {}; // Reset token metadata cache
  tokenMetaFetched = false;
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

  // Fetch token metadata first
  await fetchTokenMetadata(connection);

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
      
      // Only include positions where we have token metadata
      const collateralMeta = getToken(collateralToken);
      const borrowedMeta = getToken(borrowedToken);
      const positionMeta = getToken(positionToken);
      
      if (!tokenMetaCache[collateralToken] || !tokenMetaCache[borrowedToken]) {
        continue;
      }
      
      // Use dynamic decimals from token metadata
      // Collateral is always in 18 decimals (USDT accounting)
      const COLLATERAL_DECIMALS = 18;
      const collateralAmount = Number(collateralInfo.balance || 0) / Math.pow(10, COLLATERAL_DECIMALS);
      const borrowedAmount = Number(borrowedInfo.balance || 0) / Math.pow(10, borrowedMeta.marginDecimals);
      const positionAmount = Number(p.token_p_amount || 0) / Math.pow(10, positionMeta.marginDecimals);
      
      const collateralPrice = prices[collateralToken] || 1;
      const borrowedPrice = prices[borrowedToken] || 1;
      const positionPrice = prices[positionToken] || 1;
      
      const collateralValue = collateralAmount * collateralPrice;
      const borrowedValue = borrowedAmount * borrowedPrice;
      const positionValue = positionAmount * positionPrice;
      
      // Determine position type:
      const isShort = positionToken === collateralToken;
      const type = isShort ? 'Short' : 'Long';

      // Get entry price from API data (if available)
      const fullPosId = `${acc.account_id}_${posId}`;
      const entryInfo = entryData[fullPosId] || entryData[posId];
      const entryPrice = entryInfo?.entryPrice;

      // Calculate PnL using actual entry price (if available)
      let pnl: number;
      let pnlPercent: number;

      if (entryPrice && positionAmount > 0) {
        // Use actual entry price from API
        if (isShort) {
          // SHORT: P&L = (Entry Price - Current Price) × Amount
          pnl = (entryPrice - positionPrice) * positionAmount;
        } else {
          // LONG: P&L = (Current Price - Entry Price) × Amount
          pnl = (positionPrice - entryPrice) * positionAmount;
        }
      } else {
        // Fallback: Position Value - Borrowed Value (less accurate)
        pnl = positionValue - borrowedValue;
      }

      pnlPercent = collateralValue > 0 ? (pnl / collateralValue) * 100 : 0;

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
        entryPrice,
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
// Force rebuild Fri Feb 27 18:34:27 EST 2026
