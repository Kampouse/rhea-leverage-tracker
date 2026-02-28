const RHEA_API = 'https://api.rhea.finance/v3';

async function testAddress() {
  const address = '943addabde7913c6f58043d348ec763643689b68da2e7ab186b7d75e1d544ff2';
  
  // Fetch closed positions
  const res = await fetch(
    `${RHEA_API}/margin-trading/position/history?address=${address}&page_num=0&page_size=100&order_column=close_timestamp&order_by=DESC&tokens=`,
    { cache: 'no-store' }
  );
  const data = await res.json();
  
  console.log('=== CLOSED POSITIONS ===');
  if (data.data?.position_records) {
    data.data.position_records.forEach((pos: any) => {
      const pnl = parseFloat(pos.pnl || '0');
      console.log({
        pos_id: pos.pos_id,
        trend: pos.trend,
        token_p: pos.token_p,
        pnl: pnl,
        collateral: parseFloat(pos.amount_c || '0') / 1e18,
        close_time: new Date(pos.close_timestamp * 1000).toISOString()
      });
    });
    
    const totalRealized = data.data.position_records.reduce((sum: number, pos: any) => 
      sum + parseFloat(pos.pnl || '0'), 0
    );
    console.log('\nTotal Realized PnL from API:', totalRealized);
  }
  
  // Fetch open position history to see entry prices
  const openRes = await fetch(
    `${RHEA_API}/margin-trading/position/history?address=${address}&page_num=0&page_size=100&order_column=open_timestamp&order_by=DESC&tokens=`,
    { cache: 'no-store' }
  );
  const openData = await openRes.json();
  
  console.log('\n=== OPEN POSITION HISTORY (for entry prices) ===');
  if (openData.data?.position_records) {
    openData.data.position_records.slice(0, 5).forEach((pos: any) => {
      console.log({
        pos_id: pos.pos_id,
        entry_price: pos.entry_price,
        token_p: pos.token_p,
        open_time: new Date(pos.open_timestamp * 1000).toISOString()
      });
    });
  }
}

testAddress();
