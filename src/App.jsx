
import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

import './App.css';
import { connectToStockUpdates } from './services/stockWebSocket';


const API_URL = `${import.meta.env.VITE_API_BASE_URL}/api/stocks`;


const MAX_POINTS = 30;

const RANGE_IN_MS = {
  '1H': 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
};

function App() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [priceHistory, setPriceHistory] = useState({});
  const [timeRange, setTimeRange] = useState('1D');

  // Load stocks and their saved price history
  useEffect(() => {
    let cancelled = false;

    async function loadStocks() {
      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error('Expected an array of stocks');
        }

        if (cancelled) return;

        setStocks(data);

        if (data.length > 0) {
          setSelectedSymbol((current) => current || data[0].symbol);
        }

        const historyResults = await Promise.all(
          data.map(async (stock) => {
            try {
              const historyResponse = await fetch(
                `${API_URL}/${encodeURIComponent(stock.symbol)}/history`
              );

              if (!historyResponse.ok) {
                throw new Error(
                  `History request failed: ${historyResponse.status}`
                );
              }

              const historyData = await historyResponse.json();

              return {
                symbol: stock.symbol,
                points: historyData
                  .map((item) => {
                    const timestamp = new Date(item.recordedAt).getTime();

                    return {
                      time: new Date(timestamp).toLocaleTimeString(),
                      timestamp,
                      price: Number(item.price),
                    };
                  })
                  .filter(
                    (point) =>
                      Number.isFinite(point.timestamp) &&
                      Number.isFinite(point.price)
                  )
                  .sort((a, b) => a.timestamp - b.timestamp),
              };
            } catch (historyError) {
              console.error(
                `Failed to load history for ${stock.symbol}:`,
                historyError
              );

              return { symbol: stock.symbol, points: [] };
            }
          })
        );

        if (cancelled) return;

        setPriceHistory((current) => {
          const next = { ...current };

          historyResults.forEach(({ symbol, points }) => {
            const merged = [
              ...points,
              ...(current[symbol] || []),
            ].sort((a, b) => a.timestamp - b.timestamp);

            const unique = merged.filter(
              (point, index, array) =>
                index === 0 ||
                point.timestamp !== array[index - 1].timestamp ||
                point.price !== array[index - 1].price
            );

            next[symbol] = unique.slice(-MAX_POINTS);
          });

          // Use the current stock price if no history exists
          data.forEach((stock) => {
            if (!next[stock.symbol]?.length) {
              const price = Number(stock.price);

              if (Number.isFinite(price)) {
                const timestamp = Date.now();

                next[stock.symbol] = [
                  {
                    time: new Date(timestamp).toLocaleTimeString(),
                    timestamp,
                    price,
                  },
                ];
              }
            }
          });

          return next;
        });
      } catch (err) {
        console.error('Stock fetch failed:', err);

        if (!cancelled) {
          setError(err.message || 'Unable to load stocks.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStocks();

    return () => {
      cancelled = true;
    };
  }, []);

  // Receive live stock updates over WebSocket
  useEffect(() => {
    const disconnect = connectToStockUpdates((updatedStock) => {
      const symbol = updatedStock.symbol;
      const price = Number(updatedStock.price);

      if (!symbol || !Number.isFinite(price)) {
        console.warn('Ignoring invalid stock update:', updatedStock);
        return;
      }

      const timestamp = Date.now();

      setStocks((currentStocks) => {
        const exists = currentStocks.some(
          (stock) => stock.symbol === symbol
        );

        if (!exists) {
          return [...currentStocks, updatedStock];
        }

        return currentStocks.map((stock) =>
          stock.symbol === symbol
            ? { ...stock, ...updatedStock }
            : stock
        );
      });

      setPriceHistory((current) => {
        const previous = current[symbol] || [];

        return {
          ...current,
          [symbol]: [
            ...previous,
            {
              time: new Date(timestamp).toLocaleTimeString(),
              timestamp,
              price,
            },
          ].slice(-MAX_POINTS),
        };
      });

      setSelectedSymbol((current) => current || symbol);
    });

    return () => disconnect();
  }, []);

  const selectedStock = stocks.find(
    (stock) => stock.symbol === selectedSymbol
  );

  const chartData = priceHistory[selectedSymbol] || [];

  // Filter chart points according to the selected time range
  const cutoffTime = Date.now() - RANGE_IN_MS[timeRange];

  const filteredChartData = chartData.filter(
    (point) =>
      Number.isFinite(point.timestamp) &&
      point.timestamp >= cutoffTime
  );

  const currentPrice = Number(selectedStock?.price);
  const currentChange = Number(selectedStock?.change);

  const currentPercent = Number.parseFloat(
    String(selectedStock?.changePercent ?? '').replace('%', '')
  );

  const priceIsValid = Number.isFinite(currentPrice);
  const changeIsValid = Number.isFinite(currentChange);
  const percentIsValid = Number.isFinite(currentPercent);

  const changeClass = !changeIsValid
    ? ''
    : currentChange > 0
      ? 'positive'
      : currentChange < 0
        ? 'negative'
        : '';

  return (
    <div className="app">
      <header className="dashboard-header">
        <h1>Stock Monitor</h1>
        <p>Track your stocks in one place.</p>
      </header>

      {loading && <p>Loading stocks and price history...</p>}

      {!loading && error && (
        <p className="error">{error}</p>
      )}

      {!loading && !error && stocks.length === 0 && (
        <p>No stocks found.</p>
      )}

      {!loading && !error && stocks.length > 0 && (
        <>
          <section className="chart-section">
            <h2>Stock Price History &amp; Live Updates</h2>

            <div className="stock-selector">
              <label htmlFor="stock-select">Choose a stock:</label>

              <select
                id="stock-select"
                value={selectedSymbol}
                onChange={(event) =>
                  setSelectedSymbol(event.target.value)
                }
              >
                {stocks.map((stock) => (
                  <option key={stock.symbol} value={stock.symbol}>
                    {stock.symbol}
                  </option>
                ))}
              </select>
            </div>

            {selectedStock && (
              <div className="selected-stock-summary">
                <h3>{selectedStock.symbol}</h3>

                <p className="current-price">
                  {priceIsValid
                    ? `$${currentPrice.toFixed(2)}`
                    : '—'}
                </p>

                <p className={changeClass}>
                  {changeIsValid
                    ? `${currentChange > 0 ? '+' : ''}${currentChange.toFixed(2)}`
                    : '—'}
                  {' ('}
                  {percentIsValid
                    ? `${currentPercent > 0 ? '+' : ''}${currentPercent.toFixed(4)}%`
                    : '—'}
                  {')'}
                </p>
              </div>
            )}

            <div className="time-range-selector">
              {Object.keys(RANGE_IN_MS).map((range) => (
                <button
                  key={range}
                  type="button"
                  className={timeRange === range ? 'active' : ''}
                  aria-pressed={timeRange === range}
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>

            <div className="chart-container">
              {filteredChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredChartData}>
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                      dataKey="time"
                      minTickGap={20}
                    />

                    <YAxis
                      domain={['auto', 'auto']}
                      tickFormatter={(value) => `$${value}`}
                    />

                    <Tooltip
                      labelFormatter={(label) => `Time: ${label}`}
                      formatter={(value) => [
                        `$${Number(value).toFixed(2)}`,
                        'Price',
                      ]}
                    />

                    
<Line
  type="monotone"
  dataKey="price"
  name={selectedSymbol}
  stroke="#2563eb"
  strokeWidth={2.5}
  dot={{ r: 3, fill: '#2563eb' }}
  activeDot={{ r: 6 }}
  isAnimationActive={false}
/>

                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p>
                  No price points available for {timeRange}.
                  Try a wider time range or wait for new updates.
                </p>
              )}
            </div>

            <small>
              Showing up to the latest {MAX_POINTS} saved and live price
              points. The selected range filters the points currently
              loaded in the browser.
            </small>
          </section>

          <section className="stocks-section">
            <h2>Stocks</h2>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th>Price</th>
                    <th>Change</th>
                    <th>Change %</th>
                  </tr>
                </thead>

                <tbody>
                  {stocks.map((stock) => {
                    const change = Number(stock.change);

                    const percent = Number.parseFloat(
                      String(stock.changePercent ?? '').replace('%', '')
                    );

                    const price = Number(stock.price);

                    const rowChangeClass = !Number.isFinite(change)
                      ? ''
                      : change > 0
                        ? 'positive'
                        : change < 0
                          ? 'negative'
                          : '';

                    const rowPercentClass = !Number.isFinite(percent)
                      ? ''
                      : percent > 0
                        ? 'positive'
                        : percent < 0
                          ? 'negative'
                          : '';

                    return (
                      <tr key={stock.id ?? stock.symbol}>
                        <td>{stock.symbol}</td>
                        <td>{stock.companyName || '—'}</td>

                        <td>
                          {Number.isFinite(price)
                            ? `$${price.toFixed(2)}`
                            : '—'}
                        </td>

                        <td className={rowChangeClass}>
                          {Number.isFinite(change)
                            ? `${change > 0 ? '+' : ''}${change.toFixed(2)}`
                            : '—'}
                        </td>

                        <td className={rowPercentClass}>
                          {Number.isFinite(percent)
                            ? `${percent > 0 ? '+' : ''}${percent.toFixed(4)}%`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default App;
