import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("Server: Starting initialization...");

  // Request logging
  app.use((req, res, next) => {
    console.log(`Server: ${req.method} ${req.url}`);
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    console.log("Server: Health check requested");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/ping", (req, res) => {
    console.log("Server: PING requested");
    res.send("PONG");
  });

  app.get("/test", (req, res) => {
    console.log("Server: TEST requested");
    res.send("<h1>SERVER IS WORKING</h1><p>If you can see this, the server is responding correctly.</p>");
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Server: Mounting Vite middleware...");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Server: Vite middleware mounted.");
  } else {
    console.log("Server: Running in production mode.");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Fallback for SPA in development
  app.get('*', (req, res, next) => {
    if (process.env.NODE_ENV !== "production") {
      if (!req.url.includes('.')) {
        res.sendFile(path.join(process.cwd(), 'index.html'));
        return;
      }
    }
    next();
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server: Running on http://0.0.0.0:${PORT}`);
    console.log(`Server: Accessible at ${process.env.APP_URL || 'local port 3000'}`);
  });
}

startServer().catch(err => {
  console.error("Server: Failed to start", err);
});
