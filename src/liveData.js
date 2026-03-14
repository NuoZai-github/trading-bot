export async function fetchHistoricalData(symbol = 'BTCUSDT', interval = '1m', limit = 100) {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    const data = await res.json();
    
    // Binance API returns an array of arrays. 
    // Indices: 0: openTime, 1: open, 2: high, 3: low, 4: close
    return data.map(d => ({
      // lightweight-charts needs time in seconds if it's intraday
      time: Math.floor(d[0] / 1000), 
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4])
    }));
  } catch (err) {
    console.error("Error fetching historical data:", err);
    return [];
  }
}

export function subscribeToLiveCandles(symbol = 'btcusdt', interval = '1m', onUpdate) {
  // Binance WebSocket stream for live klines (candles)
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const kline = message.k;
    
    if (kline) {
      onUpdate({
        time: Math.floor(kline.t / 1000),
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
        isFinal: kline.x // boolean indicating if this is the final final update for this candle
      });
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  return ws;
}
