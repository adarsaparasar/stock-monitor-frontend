
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

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://stock-monitor-backend-tplo.onrender.com';

const API_URL = `${API_BASE_URL
  .replace(/\/+$/, '')
  .replace(/^wss?:\/\//, 'https://')
  .replace(/^http:\/\//, 'https://')}/api/stocks`;

const STOCK_SYMBOL = 'IBM';
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
  const [priceHistory, setPriceHistory] = useState([]);
  const [timeRange, setTimeRange] = useState('1D');

  // Load IBM stock and its saved price history.
  useEffect(() => {
    let cancelled = false;

    async function loadStock() {
      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error('Expected an array of stocks');
        }

        const ibmStocks = data.filter(
          (stock) =>
            stock.symbol?.toUpperCase() === STOCK_SYMBOL
        );

        if (cancelled) return;

        setStocks(ibmStocks);

        if (ibmStocks.length === 0) {
          throw new Error(
            'IBM was not found. Please ensure an IBM record exists in the backend database.'
          );
        }

        const stock = ibmStocks[0];

        // Fetch saved IBM price history.
        let historyPoints = [];

        try {
          const historyResponse = await fetch(
            `${API_URL}/${encodeURIComponent(STOCK_SYMBOL)}/history`
          );

          if (!historyResponse.ok) {
            throw new Error(
              `History request failed: ${historyResponse.status}`
            );
          }

          const historyData = await historyResponse.json();

          if (!Array.isArray(historyData)) {
            throw new Error('Expected history to be an array');
          }

          historyPoints = historyData
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
            .sort((a, b) => a.timestamp - b.timestamp);
        } catch (historyError) {
          console.error(
            'Failed to load IBM price history:',
            historyError
          );
        }

        if (cancelled) return;

        // If history is empty, show the current price as one point.
        if (historyPoints.length === 0) {
          const price = Number(stock.price);

          if (Number.isFinite(price)) {
            const timestamp = Date.now();

            historyPoints = [
              {
                time: new Date(timestamp).toLocaleTimeString(),
                timestamp,
                price,
              },
            ];
          }
        }

        setPriceHistory(historyPoints.slice(-MAX_POINTS));
      } catch (err) {
        console.error('IBM stock fetch failed:', err);

        if (!cancelled) {
          setError(err.message || 'Unable to load IBM stock data.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStock();

    return () => {
      cancelled = true;
    };
  }, []);

  // Receive IBM-only live updates over WebSocket.
  useEffect(() => {
    const disconnect = connectToStockUpdates((updatedStock) => {
      if (
        updatedStock.symbol?.toUpperCase() !== STOCK_SYMBOL
      ) {
        return;
      }

      const price = Number(updatedStock.price);

      if (!Number.isFinite(price)) {
        console.warn('Ignoring invalid IBM update:', updatedStock);
        return;
      }

      const timestamp = Date.now();

      setStocks((currentStocks) =>
        currentStocks.map((stock) =>
          stock.symbol?.toUpperCase() === STOCK_SYMBOL
            ? { ...stock, ...updatedStock, symbol: STOCK_SYMBOL }
            : stock
        )
      );

      setPriceHistory((currentHistory) => {
        const updatedHistory = [
          ...currentHistory,
          {
            time: new Date(timestamp).toLocaleTimeString(),
            timestamp,
            price,
          },
        ];

        return updatedHistory.slice(-MAX_POINTS);
      });
    });

    return () => disconnect();
  }, []);

  const selectedStock = stocks[0];

  const cutoffTime = Date.now() - RANGE_IN_MS[timeRange];

  const filteredChartData = priceHistory.filter(
    (point) =>
      Number.isFinite(point.timestamp) &&
      point.timestamp >= cutoffTime
  );

  const currentPrice = Number(selectedStock?.price);
  const currentChange = Number(selectedStock?.change);

  const currentPercent = Number.parseFloat(
    String(selectedStock?.changePercent ?? '').replace('%', '')
  );

  const priceIsValid =
    selectedStock && Number.isFinite(currentPrice);

  const changeIsValid =
    selectedStock && Number.isFinite(currentChange);

  const percentIsValid =
    selectedStock && Number.isFinite(currentPercent);

  const changeClass = !changeIsValid
    ? ''
    : currentChange > 0
      ? 'positive'
      : currentChange < 0
        ? 'negative'
        : '';

  const rowChangeClass = !changeIsValid
    ? ''
    : currentChange > 0
      ? 'positive'
      : currentChange < 0
        ? 'negative'
        : '';

  const rowPercentClass = !percentIsValid
    ? ''
    : currentPercent > 0
      ? 'positive'
      : currentPercent < 0
        ? 'negative'
        : '';

  return (
    <div className="app">
      <header className="dashboard-header">
        <h1>IBM Stock Monitor</h1>
        <p>IBM stock price, market movement, and price history.</p>
      </header>

      {loading && (
        <p>Loading IBM stock data and price history...</p>
      )}

      {!loading && error && (
        <p className="error">{error}</p>
      )}

      {!loading && !error && selectedStock && (
        <>
          <section className="chart-section">
            <h2>IBM Stock Price History &amp; Live Updates</h2>

            <div className="selected-stock-summary">
              <h3>IBM — International Business Machines</h3>

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
                        'IBM Price',
                      ]}
                    />

                    <Line
                      type="monotone"
                      dataKey="price"
                      name="IBM"
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
                  No IBM price points available for {timeRange}.
                  Try a wider time range or wait for new updates.
                </p>
              )}
            </div>

            <small>
              Showing up to the latest {MAX_POINTS} saved and live
              IBM price points. The selected range filters the
              points currently loaded in the browser.
            </small>
          </section>

          <section className="stocks-section">
            <h2>IBM Stock Details</h2>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th>Price (USD)</th>
                    <th>Change</th>
                    <th>Change %</th>
                  </tr>
                </thead>

                <tbody>
                  <tr key={selectedStock.id ?? STOCK_SYMBOL}>
                    <td>IBM</td>
                    <td>
                      {selectedStock.companyName ||
                        'International Business Machines'}
                    </td>

                    <td>
                      {priceIsValid
                        ? `$${currentPrice.toFixed(2)}`
                        : '—'}
                    </td>

                    <td className={rowChangeClass}>
                      {changeIsValid
                        ? `${currentChange > 0 ? '+' : ''}${currentChange.toFixed(2)}`
                        : '—'}
                    </td>

                    <td className={rowPercentClass}>
                      {percentIsValid
                        ? `${currentPercent > 0 ? '+' : ''}${currentPercent.toFixed(4)}%`
                        : '—'}
                    </td>
                  </tr>
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
