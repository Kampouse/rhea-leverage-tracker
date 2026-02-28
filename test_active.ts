import { connect, keyStores } from 'near-api-js';

const FASTNEAR_RPC = 'https://rpc.fastnear.com';
const BURROW = 'contract.main.burrow.near';

async function testActivePositions() {
  const address = '943addabde7913c6f58043d348ec763643689b68da2e7ab186b7d75e1d544ff2';
  
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
  
  const userAccount = allAccounts.find((acc: any) => acc.account_id === address);
  
  if (userAccount && userAccount.margin_positions && Object.keys(userAccount.margin_positions).length > 0) {
    console.log('=== ACTIVE POSITIONS ===');
    console.log('Account:', userAccount.account_id);
    console.log('Number of positions:', Object.keys(userAccount.margin_positions).length);
    
    for (const [posId, pos] of Object.entries(userAccount.margin_positions)) {
      const p = pos as any;
      console.log(`\nPosition ${posId}:`);
      console.log('  Collateral:', p.token_c_info?.balance / 1e18, 'USDT');
      console.log('  Borrowed:', p.token_d_info?.balance / 1e18, 'NEAR');
      console.log('  Position Token:', p.token_p_id);
      console.log('  Position Amount:', p.token_p_amount / 1e24);
    }
  } else {
    console.log('No active positions found for this address');
  }
}

testActivePositions();
