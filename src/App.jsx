
import { useEffect, useState } from "react";
import "./App.css";

const API_URL =
  "https://stock-monitor-backend-tplo.onrender.com/api/stocks";

export default function App() {
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchIBMPrice() {
      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const stocks = await response.json();
        const ibm = stocks.find(
          (stock) => stock.symbol?.toUpperCase() === "IBM"
        );

        if (!ibm) {
          throw new Error("IBM stock was not found.");
        }

        if (active) {
          setPrice(Number(ibm.price));
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Unable to load IBM stock price.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchIBMPrice();

    // Refresh the displayed price every 60 seconds.
    const intervalId = setInterval(fetchIBMPrice, 60_000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <main className="stock-page">
      <section className="stock-card">
        <p className="stock-label">IBM · NYSE</p>

        <h1>IBM Stock Price</h1>

        {loading ? (
          <p>Loading stock price...</p>
        ) : price !== null && Number.isFinite(price) ? (
          <p className="stock-price">
            ${price.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        ) : (
          <p className="stock-error">
            {error || "Stock price unavailable."}
          </p>
        )}

        <p className="stock-note">
          Latest price available from the backend
        </p>
      </section>
    </main>
  );
}
