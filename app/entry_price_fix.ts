// Fix for entry price calculation
// Replace the P&L calculation section in calculatePnL function

      // Determine position type
      const isShort = positionToken === collateralToken;
      const type = isShort ? 'Short' : 'Long';

      // Initialize variables
      let pnl: number;
      let pnlPercent: number;
      let entryPrice: number | undefined;
      
      const positionEntry = entryData[posId];
      
      // CASE 1: Entry price from Rhea API (closed positions)
      if (positionEntry?.entryPrice) {
        entryPrice = positionEntry.entryPrice;
        
        if (isShort) {
          const priceDiff = entryPrice - positionPrice;
          pnl = priceDiff * positionAmount;
        } else {
          const priceDiff = positionPrice - entryPrice;
          pnl = priceDiff * positionAmount;
        }
        
        pnlPercent = collateralValue > 0 ? (pnl / collateralValue) * 100 : 0;
      } 
      // CASE 2: Calculate entry price from blockchain (active positions)
      else if (positionAmount > 0) {
        const totalValueAtEntry = collateralValue + borrowedValue;
        entryPrice = totalValueAtEntry / positionAmount;
        
        if (isShort) {
          const priceDiff = entryPrice - positionPrice;
          pnl = priceDiff * positionAmount;
        } else {
          const priceDiff = positionPrice - entryPrice;
          pnl = priceDiff * positionAmount;
        }
        
        pnlPercent = collateralValue > 0 ? (pnl / collateralValue) * 100 : 0;
      } 
      // CASE 3: Fallback (no position amount)
      else {
        pnl = positionValue - borrowedValue;
        pnlPercent = collateralValue > 0 ? (pnl / collateralValue) * 100 : 0;
      }
