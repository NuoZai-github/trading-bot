import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { Activity, Cpu, History, PlayCircle, AlertCircle } from 'lucide-react';
import { fetchHistoricalData, subscribeToLiveCandles } from './liveData';
import { analyzeMarketWithGroq } from './aiEngine';

// Simulated Virtual Environment for the AI
class VirtualBroker {
  constructor(initialBalance, onUpdate) {
    this.balance = initialBalance;
    this.equity = initialBalance;
    this.position = 0; // Amount of asset held
    this.entryPrice = 0;
    this.trades = [];
    this.onUpdate = onUpdate; // UI callback
  }

  updatePrice(currentPrice) {
    // Update equity based on current holding value
    this.equity = this.balance + (this.position * currentPrice);
    this.onUpdate();
  }

  buy(price, time) {
    if (this.position > 0) return null; // Already holding
    const size = (this.balance * 0.9) / price; // Use 90% of balance
    this.balance -= (size * price);
    this.position = size;
    this.entryPrice = price;
    
    const trade = { type: 'BUY', price, time, balance: this.balance };
    this.trades.unshift(trade);
    this.onUpdate();
    return trade;
  }

  sell(price, time) {
    if (this.position === 0) return null; // Nothing to sell
    this.balance += (this.position * price);
    const profit = (price - this.entryPrice) * this.position;
    
    this.position = 0;
    const trade = { type: 'SELL', price, time, profit, balance: this.balance };
    this.trades.unshift(trade);
    this.onUpdate();
    return trade;
  }
}

function App() {
  const chartContainerRef = useRef(null);
  
  // App State
  const [symbol, setSymbol] = useState('PAXGUSDT'); // PAXG = Gold equivalent token in crypto
  const [isLive, setIsLive] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Trading Stats
  const brokerRef = useRef(null);
  const [trades, setTrades] = useState([]);
  const [brokerState, setBrokerState] = useState({ balance: 10000, equity: 10000 });
  const [aiStatus, setAiStatus] = useState('Waiting for model...');

  useEffect(() => {
    // Initialize Virtual Broker
    brokerRef.current = new VirtualBroker(10000, () => {
      setBrokerState({ 
        balance: brokerRef.current.balance, 
        equity: brokerRef.current.equity,
        position: brokerRef.current.position 
      });
      setTrades([...brokerRef.current.trades]);
    });

    // Initialize Chart
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#d1d5db' },
      grid: { vertLines: { color: 'rgba(255, 255, 255, 0.05)' }, horzLines: { color: 'rgba(255, 255, 255, 0.05)' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
      timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true, secondsVisible: false },
    });

    const mainSeries = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444',
      borderDownColor: '#ef4444', borderUpColor: '#10b981',
      wickDownColor: '#ef4444', wickUpColor: '#10b981',
    });

    let ws = null;

    const startEngine = async () => {
      setLoading(true);
      // Fetch 200 minutes of history
      const history = await fetchHistoricalData(symbol, '1m', 200);
      let localCandleCache = [];
      if (history.length > 0) {
        mainSeries.setData(history);
        setCurrentPrice(history[history.length - 1].close);
        localCandleCache = [...history];
      }
      
      setIsLive(true);
      setLoading(false);

      // Start Live Feed
      ws = subscribeToLiveCandles(symbol.toLowerCase(), '1m', async (liveCandle) => {
        mainSeries.update(liveCandle);
        setCurrentPrice(liveCandle.close);
        brokerRef.current.updatePrice(liveCandle.close);
        
        // Update local cache
        const lastCandle = localCandleCache[localCandleCache.length - 1];
        if (lastCandle && lastCandle.time === liveCandle.time) {
           localCandleCache[localCandleCache.length - 1] = liveCandle;
        } else {
           localCandleCache.push(liveCandle);
        }
        
        // Ensure cache doesn't grow indefinitely
        if (localCandleCache.length > 300) localCandleCache.shift();

        // ============================================
        // 🔮 AI TRADING LOGIC ENTRY POINT
        // ============================================
        if (liveCandle.isFinal) {
          setAiStatus("Analyzing new candle...");
          
          try {
             // Call Groq API
             const decision = await analyzeMarketWithGroq(
                localCandleCache, 
                brokerRef.current.position,
                brokerRef.current.balance
             );
             
             if (decision.action === 'BUY') {
                const trade = brokerRef.current.buy(liveCandle.close, liveCandle.time);
                if (trade) {
                  setAiStatus(`BOUGHT. Rationale: ${decision.reason}`);
                } else setAiStatus(`BUY Signal (Already Full). Rationale: ${decision.reason}`);
             } else if (decision.action === 'SELL') {
                const trade = brokerRef.current.sell(liveCandle.close, liveCandle.time);
                if (trade) {
                  setAiStatus(`SOLD. Rationale: ${decision.reason}`);
                } else setAiStatus(`SELL Signal (Already Flat). Rationale: ${decision.reason}`);
             } else {
                setAiStatus(`HOLDING. Rationale: ${decision.reason}`);
             }
          } catch (e) {
             setAiStatus("AI Analysis failed. Next try in 1m.");
          }
        }
      });
    };

    startEngine();

    // Resize handler
    const handleResize = () => chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ws) ws.close();
      chart.remove();
    };
  }, [symbol]);

  const netProfit = brokerState.equity - 10000;

  return (
    <div className="dashboard-container">
      <header className="header">
        <h1>{symbol === 'PAXGUSDT' ? 'Gold (PAXG)' : 'Crypto'} Live AI Trading System</h1>
        <div className="status-badge" style={{ background: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' }}>
          <div className="status-dot" style={{ backgroundColor: isLive ? 'var(--accent-green)' : '#f59e0b' }}></div>
          {isLive ? 'Live Market Feed Active' : 'Connecting Array...'}
        </div>
      </header>

      {/* AI Agent Status Component */}
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'var(--accent-blue)', padding: '0.5rem', borderRadius: '8px' }}>
            <Cpu size={24} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>AI Trading Agent</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
              Status: <span style={{ color: '#60a5fa' }}>{aiStatus}</span>
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${currentPrice.toFixed(2)}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Price</div>
        </div>
      </div>

      <div className="stats-row">
        <div className="glass-panel stat-card">
          <span className="stat-label">Initial Balance</span>
          <span className="stat-value">$10,000.00</span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Total Equity (Virtual)</span>
          <span className={`stat-value ${brokerState.equity > 10000 ? 'positive' : brokerState.equity < 10000 ? 'negative' : ''}`}>
            ${brokerState.equity.toFixed(2)}
          </span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Net Profit</span>
          <span className={`stat-value ${netProfit > 0 ? 'positive' : netProfit < 0 ? 'negative' : ''}`}>
            {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
          </span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Position Size</span>
          <span className="stat-value">{brokerState.position > 0 ? (brokerState.position.toFixed(4) + ' Units') : 'Flat (No Position)'}</span>
        </div>
      </div>

      <div className="grid-layout">
        <div className="glass-panel" style={{ position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-panel)', zIndex: 10 }}>
              Loading real-time market data...
            </div>
          )}
          <h2 className="panel-title">
            <Activity size={20} className="text-accent-blue" />
            Live Market: {symbol} (1 Minute Interval)
          </h2>
          <div ref={chartContainerRef} className="chart-container" style={{ height: '400px' }} />
        </div>

        <div className="glass-panel">
          <h2 className="panel-title">
            <History size={20} />
            AI Execution Log
          </h2>
          {trades.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', opacity: 0.5, gap: '1rem' }}>
              <AlertCircle size={40} />
              <p>No trades executed yet.<br/>AI is waiting for signals.</p>
            </div>
          ) : (
            <div className="trades-list">
              {trades.map((trade, idx) => (
                <div key={idx} className={`trade-item ${trade.type.toLowerCase()}`}>
                  <div className="trade-info">
                    <span className={`trade-type ${trade.type.toLowerCase()}`}>{trade.type}</span>
                    <span className="trade-date">{new Date(trade.time * 1000).toLocaleTimeString()}</span>
                  </div>
                  <div className="trade-info" style={{alignItems: 'flex-end'}}>
                    <span className="trade-price">${trade.price.toFixed(2)}</span>
                    {trade.profit !== undefined && (
                      <span className={`trade-profit ${trade.profit >= 0 ? 'positive' : 'negative'}`}>
                        {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
