import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { Activity, TrendingUp, DollarSign, Clock, History } from 'lucide-react';
import { generateCandlestickData, runMovingAverageStrategy } from './mockData';

function App() {
  const chartContainerRef = useRef(null);
  const [data, setData] = useState([]);
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState({
    winRate: 0,
    totalTrades: 0,
    netProfit: 0,
    finalBalance: 10000
  });

  useEffect(() => {
    // 1. Generate Data and Run Strategy
    const historicalData = generateCandlestickData(500);
    const strategyResult = runMovingAverageStrategy(historicalData, 10, 30);
    
    setData(historicalData);
    setTrades(strategyResult.trades.reverse()); // latest first

    // Calculate Stats
    const totalTrades = Math.floor(strategyResult.trades.length / 2); // pairs of buy/sell
    const winningTrades = strategyResult.trades.filter(t => t.profit > 0).length;
    const finalBalance = strategyResult.finalBalance;
    const netProfit = finalBalance - 10000;
    
    setStats({
      totalTrades,
      winRate: totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : 0,
      netProfit,
      finalBalance
    });

    // 2. Initialize Chart
    window.__debug_chartContainer = chartContainerRef.current;
    window.__debug_createChart = createChart;
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1, // Magnet mode
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        rightOffset: 12,
      },
      handleScroll: true,
      handleScale: true,
    });
    window.__debug_chart = chart;

    // 3. Add Series
    const mainSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
    });

    mainSeries.setData(historicalData);
    
    // Add Strategy Markers
    if (strategyResult.markers.length > 0) {
      mainSeries.setMarkers(strategyResult.markers);
    }

    // Add Moving Averages
    const shortSMASeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      priceLineVisible: false,
    });
    shortSMASeries.setData(strategyResult.shortSMA);

    const longSMASeries = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 2,
      priceLineVisible: false,
    });
    longSMASeries.setData(strategyResult.longSMA);

    // Dynamic resize
    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="header">
        <h1>XAU/USD Algo Trading System</h1>
        <div className="status-badge">
          <div className="status-dot"></div>
          System Active (Simulated)
        </div>
      </header>

      {/* Top Stats */}
      <div className="stats-row">
        <div className="glass-panel stat-card">
          <span className="stat-label">Initial Balance</span>
          <span className="stat-value">$10,000.00</span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Final Balance</span>
          <span className={`stat-value ${stats.finalBalance > 10000 ? 'positive' : 'negative'}`}>
            ${stats.finalBalance.toFixed(2)}
          </span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Net Profit</span>
          <span className={`stat-value ${stats.netProfit > 0 ? 'positive' : 'negative'}`}>
            {stats.netProfit > 0 ? '+' : ''}${stats.netProfit.toFixed(2)}
          </span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Win Rate / Trades</span>
          <span className="stat-value">{stats.winRate}% / {stats.totalTrades}</span>
        </div>
      </div>

      <div className="grid-layout">
        {/* Main Chart */}
        <div className="glass-panel">
          <h2 className="panel-title">
            <Activity size={20} className="text-accent-blue" />
            Market Data & Strategy 
            <span style={{fontSize: '0.8rem', opacity: 0.6, marginLeft: 'auto'}}>SMA(10) vs SMA(30)</span>
          </h2>
          <div ref={chartContainerRef} className="chart-container" />
        </div>

        {/* Trade Log */}
        <div className="glass-panel">
          <h2 className="panel-title">
            <History size={20} />
            Trade Log
          </h2>
          <div className="trades-list">
            {trades.map((trade, idx) => (
              <div key={idx} className={`trade-item ${trade.type.toLowerCase()}`}>
                <div className="trade-info">
                  <span className={`trade-type ${trade.type.toLowerCase()}`}>
                    {trade.type} XAU/USD
                  </span>
                  <span className="trade-date">{trade.time}</span>
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
        </div>
      </div>
    </div>
  );
}

export default App;
