// Reference walking-skeleton — the exact artifact prompts/harness-system.md asks the
// coding agent to produce: a single-file Node signup app, no deps, listens on $PORT,
// binds 127.0.0.1, persists to ./data.json. It is the deploy target the HttpValidator
// checks, and FixtureHarness copies it verbatim so the whole spine (build → deploy →
// validate → ship) can be proven end-to-end at zero agent cost. Keep it CommonJS: a
// company workdir has no package.json, so `node server.js` runs it as CJS.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 3000;
const DATA = path.join(__dirname, "data.json");

function load() {
    try {
        return JSON.parse(fs.readFileSync(DATA, "utf8"));
    } catch {
        return [];
    }
}
function save(rows) {
    fs.writeFileSync(DATA, JSON.stringify(rows, null, 2));
}
function esc(s) {
    return String(s).replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
}

const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Sign up</title></head>
<body><h1>Join the waitlist</h1>
<form method="POST" action="/signup">
  <input type="email" name="email" placeholder="you@example.com" required>
  <button type="submit">Sign up</button>
</form></body></html>`);
        return;
    }

    if (req.method === "POST" && req.url === "/signup") {
        let body = "";
        req.on("data", (c) => {
            body += c;
            if (body.length > 1e6) req.destroy();
        });
        req.on("end", () => {
            const params = new URLSearchParams(body);
            const email = (params.get("email") || "").trim();
            if (email) {
                const rows = load();
                rows.push({ email, at: Date.now() });
                save(rows);
            }
            res.writeHead(303, { location: "/admin" });
            res.end();
        });
        return;
    }

    if (req.method === "GET" && req.url === "/admin") {
        const rows = load();
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Signups</title></head>
<body><h1>Signups (${rows.length})</h1><ul>${rows
            .map((r) => `<li>${esc(r.email)}</li>`)
            .join("")}</ul></body></html>`);
        return;
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`signup app listening on http://127.0.0.1:${PORT}`);
});
