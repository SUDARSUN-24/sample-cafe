/* netlify/functions/api.mjs — puts backend/core.mjs online as /api/* on Netlify.
   Data lives in Netlify Blobs (a free key-value store that comes with the site).
   The staff key is the site's environment variable ADMIN_KEY (Netlify dashboard
   → Site configuration → Environment variables). Never write it in a file.   */
import { getStore } from "@netlify/blobs";
import { createApi } from "../../backend/core.mjs";
import shop from "../../backend/shop.generated.mjs";

const MAX_BODY = 4000; // characters; a booking or order is far smaller

function blobStore() {
  // "strong": a booking that was just saved is seen by the very next request.
  const store = getStore({ name: "shop", consistency: "strong" });
  return {
    get: (key) => store.get(key, { type: "json" }),
    set: (key, value) => store.setJSON(key, value),
    delete: (key) => store.delete(key),
    list: async (prefix) => (await store.list({ prefix })).blobs.map((b) => b.key).sort(),
  };
}

export default async function handler(req, context) {
  const url = new URL(req.url);
  let body = {};
  if (req.method === "POST") {
    const text = await req.text();
    if (text.length > MAX_BODY) return json(413, { error: "too_big", message: { th: "ข้อมูลยาวเกินไป", en: "Request too large." } });
    try { body = text ? JSON.parse(text) : {}; } catch (e) { body = null; }
  }
  const api = createApi({ shop, store: blobStore(), adminKey: Netlify.env.get("ADMIN_KEY") || "" });
  const result = await api({
    method: req.method,
    path: url.pathname.replace(/^\/api/, "") || "/",
    query: Object.fromEntries(url.searchParams),
    body,
    ip: context.ip,
    key: req.headers.get("x-admin-key") || "",
  });
  return json(result.status, result.body);
}

const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });

export const config = { path: "/api/*" };
