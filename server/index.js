import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

const config = loadConfig();
const app = createApp({ config });

createServer(app).listen(config.port, () => {
  console.log(`Fezzy payment backend listening on :${config.port}`);
});
