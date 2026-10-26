
import { useEffect, useState } from "react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import "./App.css";
import { connectToStockUpdates } from "./services/stockWebSocket";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://stock-monitor-backend-tplo.onrender.com";

const API_URL = `${API_BASE_URL
  .replace(/\/+$/, "")
  .replace(/^wss?:\/\//i, "https://")
  .replace(/^http:\/\//i, "https://")}/api/stocks`;

const STOCK_SYMBOL = "IBM";

const TIME_RANGES = ["1H", "1D", "1W"];

function formatChartTime(timestamp) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function App() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [priceHistory, setPriceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [timeRange, setTimeRange] = useState("1D");

  // 1. Fetch the current stock details.
  useEffect(() => {
    let cancelled = false;

    async function loadStock() {
      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error(`Stock request failed: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Expected an array of stocks");
        }

        const ibmStocks = data.filter(
          (stock) =>
            stock.symbol?.toUpperCase() === STOCK_SYMBOL
        );

        if (ibmStocks.length === 0) {
          throw new Error(
            "IBM was not found in the backend database."
          );
        }

        if (!cancelled) {
          setStocks(ibmStocks);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("IBM stock fetch failed:", err);
          setError(err.message || "Unable to load IBM stock data.");
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

  // 2. Fetch saved history whenever the selected range changes.
  useEffect(() => {
    let cancelled = false;

    async function loadPriceHistory() {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const historyUrl =
          `${API_URL}/${encodeURIComponent(STOCK_SYMBOL)}` +
          `/history?range=${encodeURIComponent(timeRange)}`;

        const response = await fetch(historyUrl);

        if (!response.ok) {
          throw new Error(
            `History request failed: ${response.status}`
          );
        }

        const historyData = await response.json();

        if (!Array.isArray(historyData)) {
          throw new Error("Expected history to be an array");
        }

        const historyPoints = historyData
          .map((item) => {
            const timestamp = new Date(item.recordedAt).getTime();

            return {
              time: formatChartTime(timestamp),
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

        if (!cancelled) {
          setPriceHistory(historyPoints);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load IBM price history:", err);
          setHistoryError(
            err.message || "Unable to load price history."
          );
          setPriceHistory([]);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    loadPriceHistory();

    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  // 3. Receive live IBM price updates over WebSocket.
  useEffect(() => {
    const disconnect = connectToStockUpdates((updatedStock) => {
      if (
        updatedStock.symbol?.toUpperCase() !== STOCK_SYMBOL
      ) {
        return;
      }

      const price = Number(updatedStock.price);

      if (!Number.isFinite(price)) {
        console.warn("Ignoring invalid IBM update:", updatedStock);
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

      // Append the live price without discarding saved history.
      setPriceHistory((currentHistory) => {
        const updatedHistory = [
          ...currentHistory,
          {
            time: formatChartTime(timestamp),
            timestamp,
            price,
          },
        ];

        return updatedHistory.sort(
          (a, b) => a.timestamp - b.timestamp
        );
      });
    });

    return () => disconnect();
  }, []);

  const selectedStock = stocks[0];

  const currentPrice = Number(selectedStock?.price);
  const currentChange = Number(selectedStock?.change);

  const currentPercent = Number.parseFloat(
    String(selectedStock?.changePercent ?? "").replace("%", "")
  );

  const priceIsValid =
    selectedStock && Number.isFinite(currentPrice);

  const changeIsValid =
    selectedStock && Number.isFinite(currentChange);

  const percentIsValid =
    selectedStock && Number.isFinite(currentPercent);

  const changeClass = !changeIsValid
    ? ""
    : currentChange > 0
      ? "positive"
      : currentChange < 0
        ? "negative"
        : "";

  const rowChangeClass = changeClass;

  const rowPercentClass = !percentIsValid
    ? ""
    : currentPercent > 0
      ? "positive"
      : currentPercent < 0
        ? "negative"
        : "";

  return (
    <div className="app">
      <header className="dashboard-header">
        <h1>IBM Stock Monitor</h1>
        <p>IBM stock price, market movement, and price history.</p>
      </header>

      {loading && <p>Loading IBM stock data...</p>}

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
                  : "—"}
              </p>

              <p className={changeClass}>
                {changeIsValid
                  ? `${currentChange > 0 ? "+" : ""}${currentChange.toFixed(2)}`
                  : "—"}
                {" ("}
                {percentIsValid
                  ? `${currentPercent > 0 ? "+" : ""}${currentPercent.toFixed(4)}%`
                  : "—"}
                {")"}
              </p>
            </div>

            <div className="time-range-selector">
              {TIME_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  className={timeRange === range ? "active" : ""}
                  aria-pressed={timeRange === range}
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>

            <div className="chart-container">
              {historyLoading ? (
                <p>Loading {timeRange} price history...</p>
              ) : historyError ? (
                <p className="error">{historyError}</p>
              ) : priceHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                      dataKey="time"
                      minTickGap={20}
                    />

                    <YAxis
                      domain={["auto", "auto"]}
                      tickFormatter={(value) => `$${value}`}
                    />

                    <Tooltip
                      labelFormatter={(label) => `Time: ${label}`}
                      formatter={(value) => [
                        `$${Number(value).toFixed(2)}`,
                        "IBM Price",
                      ]}
                    />

                    <Line
                      type="monotone"
                      dataKey="price"
                      name="IBM"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#2563eb" }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p>
                  No saved IBM price history available for {timeRange}.
                  Try a wider time range or wait for new updates.
                </p>
              )}
            </div>

            <small>
              Showing saved IBM history for {timeRange}, plus live
              updates received while this page is open.
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
                        "International Business Machines"}
                    </td>

                    <td>
                      {priceIsValid
                        ? `$${currentPrice.toFixed(2)}`
                        : "—"}
                    </td>

                    <td className={rowChangeClass}>
                      {changeIsValid
                        ? `${currentChange > 0 ? "+" : ""}${currentChange.toFixed(2)}`
                        : "—"}
                    </td>

                    <td className={rowPercentClass}>
                      {percentIsValid
                        ? `${currentPercent > 0 ? "+" : ""}${currentPercent.toFixed(4)}%`
                        : "—"}
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
