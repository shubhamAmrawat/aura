import { createApp } from "./app";
import { env } from "./config/env";
import { startScheduler } from "./jobs/trending.job";

const port = parseInt(env.PORT ?? "3001", 10);
const app = createApp();

console.log(`Starting server on port ${port}`);

app.listen(port, "0.0.0.0", (error?: Error) => {
  if (error) throw error;
  console.log(`API running at http://0.0.0.0:${port}`);
  startScheduler(); // hourly trending score recalculation
});
