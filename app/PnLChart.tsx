'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface PnLChartProps {
  closedPositions: any[];
  currentPnL: number;
}

export default function PnLChart({ closedPositions, currentPnL }: PnLChartProps) {
  // Sort trades by close timestamp and calculate cumulative P&L
  const sortedTrades = [...closedPositions]
    .filter(pos => pos.close_timestamp && pos.close_timestamp > 0)
    .sort((a, b) => a.close_timestamp - b.close_timestamp);

  // Calculate cumulative P&L over time
  let cumulativePnL = 0;
  const chartData = sortedTrades.map((pos, index) => {
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

    let tradePnL = 0;
    if (entryPrice > 0 && amount > 0) {
      tradePnL = isShort
        ? amount * (entryPrice - closePrice)
        : amount * (closePrice - entryPrice);
    }

    cumulativePnL += tradePnL;

    const date = new Date(pos.close_timestamp);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return {
      date: dateStr,
      timestamp: pos.close_timestamp,
      pnl: cumulativePnL,
      tradeNum: index + 1,
    };
  });

  // Add current unrealized P&L as the last point
  if (chartData.length > 0 && currentPnL !== 0) {
    const now = new Date();
    chartData.push({
      date: 'Now',
      timestamp: Date.now(),
      pnl: cumulativePnL + currentPnL,
      tradeNum: chartData.length + 1,
    });
  }

  // If no data, show placeholder
  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-taupe text-sm">
        No trade history to display
      </div>
    );
  }

  // Calculate min/max for better Y-axis
  const pnlValues = chartData.map(d => d.pnl);
  const minPnL = Math.min(...pnlValues, 0);
  const maxPnL = Math.max(...pnlValues, 0);
  const padding = Math.max(Math.abs(minPnL), Math.abs(maxPnL)) * 0.1;

  const formatPnL = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const finalPnL = chartData[chartData.length - 1]?.pnl || 0;
  const lineColor = finalPnL >= 0 ? '#4ade80' : '#ff6b6b';

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
          <XAxis
            dataKey="date"
            stroke="#888"
            fontSize={10}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#888"
            fontSize={10}
            tickLine={false}
            tickFormatter={formatPnL}
            domain={[minPnL - padding, maxPnL + padding]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '4px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#888' }}
            formatter={(value: any) => [formatPnL(value), 'Cumulative P&L']}
          />
          <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="pnl"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: lineColor }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
