import { createServer } from "http";
import { config } from "dotenv";
import { AutomationQueue } from "./automation/queue";
import { AutomationHttpHandler } from "./automation/http-handler";

config({ path: ".env.local" });
config({ path: ".env" });

if (process.env.NODE_ENV === "production") {
  process.chdir("/app");
}

const automationQueue = new AutomationQueue();
const automationHandler = new AutomationHttpHandler(automationQueue);

automationQueue.initialize().catch((err) =>
  console.error("[Automation] Init failed:", err)
);

const PORT = parseInt(process.env.AUTOMATION_PORT || "8080");
const server = createServer(async (req, res) => {
  const handled = await automationHandler.handle(req, res);
  if (!handled) {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Automation server running on http://localhost:${PORT}`);
});

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await automationQueue.shutdown();
  server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await automationQueue.shutdown();
  server.close();
  process.exit(0);
});
