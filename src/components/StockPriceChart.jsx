
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function StockPriceChart({ data }) {
  const chartData = data.map((item) => ({
    time: new Date(item.recordedAt).toLocaleTimeString(),
    price: item.price
  }));

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip />
          <Line
            type="linear"
            dataKey="price"
            stroke="#2563eb"
            dot
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
