// Μικρός static server για το παραγωγικό build (dist/) του EV SEA GUARD AI.
// Χρησιμοποιείται από τον EV LABS Παρουσιάσεις launcher (node server.cjs + Cloudflare tunnel).
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8221;
const ROOT = path.join(__dirname, "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

if (!fs.existsSync(ROOT)) {
  console.error("ΣΦΑΛΜΑ: λείπει ο φάκελος dist/. Τρέξε πρώτα: npm run build");
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  let filePath = path.normalize(path.join(ROOT, urlPath));

  // ασφάλεια: μην βγεις εκτός ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      filePath = path.join(ROOT, "index.html"); // SPA fallback
    }
    fs.readFile(filePath, (e, data) => {
      if (e) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
      });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`EV SEA GUARD AI (dist) → http://localhost:${PORT}`);
});
