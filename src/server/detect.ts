import { execFile } from "node:child_process";
import { constants, accessSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

// Discover coding-agent CLIs installed on the host (self-host only). execFile ONLY (no shell),
// fixed argv from a hardcoded registry (zero injection), hard per-probe timeout + SIGKILL, run
// under Promise.all so the synchronous better-sqlite3 web loop never stalls.
const run = promisify(execFile);
const SEMVER = /(\d+\.\d+\.\d+)/;

export type AuthState = "authed" | "unauthed" | "unknown";
export type DetectedAgent = {
    id: string;
    name: string;
    installed: boolean;
    version?: string;
    authState: AuthState;
    drivable: boolean; // v1 executor can drive it as the builder
};

function searchDirs(): string[] {
    const h = homedir();
    return [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        join(h, ".local/bin"),
        join(h, ".bun/bin"),
        join(h, ".deno/bin"),
        join(h, ".volta/bin"),
        join(h, ".opencode/bin"),
        join(h, ".local/share/opencode/bin"),
        join(h, ".grok/bin"),
        ...(process.env.PATH?.split(":") ?? []),
    ];
}

const PROBE_ENV = { ...process.env, PATH: searchDirs().join(":"), NO_COLOR: "1", CI: "1" };
const OPTS = {
    timeout: 4000,
    killSignal: "SIGKILL" as const,
    maxBuffer: 1 << 20,
    cwd: tmpdir(),
    env: PROBE_ENV,
};

function whichPath(bin: string): string | undefined {
    for (const dir of searchDirs()) {
        const p = join(dir, bin);
        try {
            accessSync(p, constants.X_OK);
            return p;
        } catch {
            /* not here */
        }
    }
    return undefined;
}

function fileExists(p: string): boolean {
    try {
        accessSync(p, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}
const H = homedir();

type RegEntry = {
    id: string;
    name: string;
    bin: string;
    versionArgs: string[];
    drivable: boolean;
    auth: (bin: string) => Promise<AuthState>;
};

const REGISTRY: RegEntry[] = [
    {
        id: "claude",
        name: "Claude Code",
        bin: "claude",
        versionArgs: ["--version"],
        drivable: true,
        auth: async (bin) => {
            try {
                const { stdout } = await run(bin, ["auth", "status", "--json"], OPTS);
                // whitelist only non-PII fields
                const j = JSON.parse(stdout) as { loggedIn?: boolean };
                return j.loggedIn ? "authed" : "unauthed";
            } catch {
                return process.env.ANTHROPIC_API_KEY ? "authed" : "unknown";
            }
        },
    },
    {
        id: "codex",
        name: "Codex CLI",
        bin: "codex",
        versionArgs: ["--version"],
        drivable: false,
        auth: async (bin) => {
            try {
                const { stdout } = await run(bin, ["login", "status"], OPTS);
                return /logged in/i.test(stdout) ? "authed" : "unauthed";
            } catch {
                return "unknown";
            }
        },
    },
    {
        id: "gemini",
        name: "Gemini CLI",
        bin: "gemini",
        versionArgs: ["--version"],
        drivable: false,
        auth: async () =>
            fileExists(join(H, ".gemini/google_accounts.json")) || !!process.env.GEMINI_API_KEY
                ? "authed"
                : "unauthed",
    },
    {
        id: "opencode",
        name: "opencode",
        bin: "opencode",
        versionArgs: ["--version"],
        drivable: false,
        auth: async () =>
            fileExists(join(H, ".local/share/opencode/auth.json")) ? "authed" : "unauthed",
    },
    {
        id: "grok",
        name: "Grok CLI",
        bin: "grok",
        versionArgs: ["--version"],
        drivable: false,
        auth: async () =>
            fileExists(join(H, ".grok/config.toml")) ||
            !!process.env.XAI_API_KEY ||
            !!process.env.GROK_API_KEY
                ? "authed"
                : "unauthed",
    },
    {
        id: "aider",
        name: "Aider",
        bin: "aider",
        versionArgs: ["--version"],
        drivable: false,
        auth: async () =>
            process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY ? "authed" : "unauthed",
    },
];

export async function detectAgents(): Promise<DetectedAgent[]> {
    return Promise.all(
        REGISTRY.map(async (e): Promise<DetectedAgent> => {
            const path = whichPath(e.bin);
            if (!path) {
                return {
                    id: e.id,
                    name: e.name,
                    installed: false,
                    authState: "unknown",
                    drivable: e.drivable,
                };
            }
            let version: string | undefined;
            try {
                const { stdout } = await run(path, e.versionArgs, OPTS);
                version = SEMVER.exec(stdout)?.[1];
            } catch {
                /* installed but version probe failed */
            }
            let authState: AuthState = "unknown";
            try {
                authState = await e.auth(path);
            } catch {
                authState = "unknown";
            }
            return {
                id: e.id,
                name: e.name,
                installed: true,
                version,
                authState,
                drivable: e.drivable,
            };
        }),
    );
}
