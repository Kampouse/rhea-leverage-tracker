import { connect, keyStores } from 'near-api-js';

const FASTNEAR_RPC = 'https://rpc.fastnear.com';
const BURROW = 'contract.main.burrow.near';

async function testDecimals() {
  const address = '943addabde7913c6f58043d348ec763643689b68da2e7ab186b7d75e1d544ff2';
  
  const connection = await connect({
    networkId: 'mainnet',
    nodeUrl: FASTNEAR_RPC,
    keyStore: new keyStores.InMemoryKeyStore(),
  });

  const account = await connection.account(BURROW);
  
  const batch = await account.viewFunction({
    contractId: BURROW,
    methodName: 'get_margin_accounts_paged',
    args: { from_index: 0, limit: 500 },
  });
  
  const userAccount = batch.find((acc: any) => acc.account_id === address);
  
  if (userAccount && userAccount.margin_positions) {
    console.log('=== RAW DATA FOR ZEC POSITION ===');
    const pos = Object.values(userAccount.margin_positions)[0] as any;
    console.log('Raw token_p_amount:', pos.token_p_amount);
    console.log('Position token:', pos.token_p_id);
    
    // Test different decimals
    console.log('\nTrying different decimals:');
    console.log('Div by 10^18:', Number(pos.token_p_amount) / Math.pow(10, 18));
    console.log('Div by 10^24:', Number(pos.token_p_amount) / Math.pow(10, 24));
    console.log('Div by 10^8:', Number(pos.token_p_amount) / Math.pow(10, 8));
    
    // Expected: ~1.56 ZEC (348 USDT / $223 current price)
    console.log('\nExpected amount: ~1.56 ZEC (based on collateral)');
  }
}

testDecimals();
