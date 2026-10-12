import { getStore } from "@netlify/blobs";

const COLS = ["pds", "tickets"];
const bad = (m = "bad", s = 400) => new Response(m, { status: s });

export default async (req) => {
  const key = Netlify.env.get("STAFF_KEY");
  if (!key || req.headers.get("x-staff-key") !== key) return bad("unauthorized", 401);

  const store = getStore("staff");
  const all = async (c) => {
    const { blobs } = await store.list({ prefix: c + "/" });
    const rows = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    return rows.filter(Boolean);
  };

  if (req.method === "GET") {
    const c = new URL(req.url).searchParams.get("c");
    if (!COLS.includes(c)) return bad();
    return Response.json(await all(c));
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return bad(); }
    const { c, op, id, data } = body;
    if (!COLS.includes(c) || !/^[a-z0-9]{4,40}$/i.test(String(id))) return bad();

    if (op === "del") {
      await store.delete(`${c}/${id}`);
      return Response.json({ ok: true });
    }
    if (op === "set" && data && typeof data === "object") {
      if (c === "pds" && data.status !== "Cancelada") {
        const s = Number(data.start), e = s + Number(data.dur);
        if (!(s > 0 && e > s)) return bad();
        const clash = (await all("pds")).find(
          (p) => p.id !== id && p.status !== "Cancelada" && s < p.start + p.dur && p.start < e
        );
        if (clash) return bad("conflict", 409);
      }
      await store.setJSON(`${c}/${id}`, { ...data, id });
      return Response.json({ ok: true });
    }
  }
  return bad();
};

export const config = { path: "/api" };
