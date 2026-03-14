export function generateCandlestickData(numCandles = 500) {
  const data = [];
  let currentTime = new Date();
  currentTime.setUTCHours(0, 0, 0, 0); // Start at midnight UTC
  currentTime.setTime(currentTime.getTime() - numCandles * 24 * 60 * 60 * 1000); // go back
  
  // Starting gold price around $2150
  let currentPrice = 2150.0;
  
  for (let i = 0; i < numCandles; i++) {
    // Random walk with drift for Gold
    const volatility = 15; // daily volatility in points
    const drift = 0.5; // slight upward drift
    
    const open = currentPrice;
    const close = open + (Math.random() - 0.5) * volatility + drift;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    
    // Format required by lightweight-charts (Unix timestamp in seconds for D, or YYYY-MM-DD for daily)
    const time = currentTime.toISOString().split('T')[0];
    
    data.push({ time, open, high, low, close });
    currentPrice = close;
    currentTime.setTime(currentTime.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return data;
}

export function runMovingAverageStrategy(data, shortPeriod = 10, longPeriod = 30) {
  // Simple Moving Average (SMA) crossover strategy
  const markers = []; // Trade signals for chart
  const trades = []; // Trade history logs
  
  const shortSMA = [];
  const longSMA = [];
  let inPosition = false; // true if holding long
  let entryPrice = 0;
  let balance = 10000; // Starting with $10,000
  let positionSize = 0; // oz of gold
  
  // Calculate SMA
  for (let i = 0; i < data.length; i++) {
    const sliceShort = data.slice(Math.max(0, i - shortPeriod + 1), i + 1);
    const sliceLong = data.slice(Math.max(0, i - longPeriod + 1), i + 1);
    
    const avgShort = sliceShort.reduce((sum, d) => sum + d.close, 0) / sliceShort.length;
    const avgLong = sliceLong.reduce((sum, d) => sum + d.close, 0) / sliceLong.length;
    
    shortSMA.push({ time: data[i].time, value: avgShort });
    longSMA.push({ time: data[i].time, value: avgLong });
    
    // Strategy Logic (Wait until we have enough data points)
    if (i >= longPeriod) {
      const prevShort = shortSMA[i-1].value;
      const prevLong = longSMA[i-1].value;
      
      // Buy Signal: Short SMA crosses ABOVE Long SMA
      if (prevShort <= prevLong && avgShort > avgLong && !inPosition) {
        entryPrice = data[i].close;
        positionSize = (balance * 0.9) / entryPrice; // Use 90% of balance to buy
        balance -= (positionSize * entryPrice);
        inPosition = true;
        
        markers.push({
          time: data[i].time,
          position: 'belowBar',
          color: '#2196F3',
          shape: 'arrowUp',
          text: 'BUY',
        });
        
        trades.push({
          type: 'BUY',
          price: entryPrice,
          time: data[i].time,
          balance: balance + (positionSize * entryPrice)
        });
      }
      
      // Sell Signal: Short SMA crosses BELOW Long SMA
      else if (prevShort >= prevLong && avgShort < avgLong && inPosition) {
        const exitPrice = data[i].close;
        balance += (positionSize * exitPrice);
        
        const profit = (exitPrice - entryPrice) * positionSize;
        
        inPosition = false;
        positionSize = 0;
        
        markers.push({
          time: data[i].time,
          position: 'aboveBar',
          color: '#e91e63',
          shape: 'arrowDown',
          text: `SELL (Profit: $${profit.toFixed(2)})`,
        });
        
        trades.push({
          type: 'SELL',
          price: exitPrice,
          time: data[i].time,
          profit: profit,
          balance: balance
        });
      }
    }
  }
  
  // Close any open position on the last candle
  if (inPosition) {
      const exitPrice = data[data.length - 1].close;
      balance += (positionSize * exitPrice);
      const profit = (exitPrice - entryPrice) * positionSize;
      
      trades.push({
        type: 'CLOSE',
        price: exitPrice,
        time: data[data.length - 1].time,
        profit: profit,
        balance: balance
      });
  }
  
  return { 
    shortSMA, 
    longSMA, 
    markers, 
    trades, 
    finalBalance: balance 
  };
}
