// BUGGY variant of the reference app — used only by the flaky fixture harness to prove the
// iterate-to-green loop. The form renders and POST /signup is accepted, but the record is
// never persisted (the save() call is missing), so GET /admin stays empty and the
// HttpValidator's persistence check goes RED. The retry writes the correct signup-server.js.
const http = require("node:http");

const PORT = Number(process.env.PORT) || 3000;

function esc(s) {
    return String(s).replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
}

// BUG: in-memory only, and we never even push to it on POST — nothing persists.
const rows = [];

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
        // Accept the submission but (bug) drop it on the floor — no persistence.
        req.resume();
        req.on("end", () => {
            res.writeHead(303, { location: "/admin" });
            res.end();
        });
        return;
    }

    if (req.method === "GET" && req.url === "/admin") {
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
    console.log(`buggy signup app listening on http://127.0.0.1:${PORT}`);
});
