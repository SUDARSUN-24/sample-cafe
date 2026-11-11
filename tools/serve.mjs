#!/usr/bin/env node
/* tools/serve.mjs — a tiny local web server for testing, no packages needed.
     node tools/serve.mjs            → http://localhost:8080
     node tools/serve.mjs 5000       → another port
   It behaves like Netlify where it matters for testing:
     • sends the headers from netlify.toml (so CSP mistakes show up locally),
     • runs the booking + order backend at /api/* (data is kept in memory, so it
       is empty again each time the server restarts; staff key: local-admin),
     • compresses text files with gzip,
     • serves 404.html with status 404 for unknown paths.               */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "site");
const PORT = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) || process.env.PORT || 8080);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".mp4": "video/mp4", ".webm": "video/webm",
};
const COMPRESS = /^(text\/|application\/(json|xml|manifest)|image\/svg)/;

// Read the [[headers]] blocks of netlify.toml (just enough TOML for that file).
function loadHeaderRules() {
  const rules = [];
  let current = null;
  for (const raw of fs.readFileSync(path.join(SITE, "..", "netlify.toml"), "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "[[headers]]") rules.push((current = { pattern: "", values: {} }));
    else if (current && /^for\s*=/.test(line)) current.pattern = line.split("=")[1].trim().replace(/^"|"$/g, "");
    else if (current && /^[\w-]+\s*=\s*".*"$/.test(line)) {
      const i = line.indexOf("=");
      current.values[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
    }
  }
  return rules;
}
const matches = (pattern, url) =>
  new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$").test(url);

// The backend: the same code Netlify runs (backend/core.mjs), with an in-memory store.
// --test: tests may set the clock with an x-test-now header and wipe the data with POST /api/__reset.
const TEST = process.argv.includes("--test");
const { createApi, memoryStore } = await import("../backend/core.mjs");
const shop = (await import("../backend/shop.generated.mjs")).default;
const store = memoryStore();
async function handleApi(req, res, url) {
  let text = "";
  for await (const chunk of req) { text += chunk; if (text.length > 4000) break; }
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = null; }
  let result;
  if (TEST && url.pathname === "/api/__reset") { store.clear(); result = { status: 200, body: { ok: true } }; }
  else {
    const fixed = TEST && req.headers["x-test-now"];
    const api = createApi({ shop, store, adminKey: process.env.ADMIN_KEY || "local-admin", now: () => (fixed ? new Date(fixed) : new Date()) });
    result = await api({
      method: req.method, path: url.pathname.replace(/^\/api/, "") || "/", query: Object.fromEntries(url.searchParams),
      body, ip: req.headers["x-test-ip"] || req.socket.remoteAddress, key: req.headers["x-admin-key"] || "",
    });
  }
  res.writeHead(result.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(result.body));
}

http
  .createServer((req, res) => {
    if (req.url.startsWith("/api/")) {
      handleApi(req, res, new URL("http://localhost" + req.url)).catch(() => res.writeHead(500).end("{}"));
      return;
    }
    // Prefix instead of using a base URL: new URL("//", base) treats "//" as a host and throws.
    // Bad input (e.g. a lone "%") gets a 400 instead of crashing the server.
    let url;
    try {
      url = decodeURIComponent(new URL("http://localhost" + req.url).pathname);
    } catch {
      res.writeHead(400).end("Bad request");
      return;
    }
    let file = path.join(SITE, url.endsWith("/") ? url + "index.html" : url);
    let status = 200;
    if (!file.startsWith(SITE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(SITE, "404.html");
      status = 404;
    }
    const type = TYPES[path.extname(file)] || "application/octet-stream";
    const headers = { "Content-Type": type };
    for (const rule of loadHeaderRules()) if (matches(rule.pattern, url)) Object.assign(headers, rule.values);
    delete headers["Strict-Transport-Security"]; // meaningless on http://localhost
    headers["Content-Security-Policy"] = (headers["Content-Security-Policy"] || "").replace("; upgrade-insecure-requests", "");
    let body = fs.readFileSync(file);
    if (COMPRESS.test(type) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
      body = zlib.gzipSync(body, { level: 9 });
      headers["Content-Encoding"] = "gzip";
      headers["Vary"] = "Accept-Encoding";
    }
    headers["Content-Length"] = body.length;
    res.writeHead(status, headers);
    res.end(req.method === "HEAD" ? undefined : body);
  })
  .listen(PORT, () => console.log(`Serving ${SITE} at http://localhost:${PORT}`));
