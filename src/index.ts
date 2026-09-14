import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[LedgerPulse] Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
});
