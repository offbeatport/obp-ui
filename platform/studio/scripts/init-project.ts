/**
 * Initialize a v0 project from the base template.
 * Steps:
 *   1.  Load project + founder profile from DB
 *   2.  Validate gitOrg / gitToken
 *   3.  Compute slug
 *   4.  Create GitHub repo (org first, fallback to user)
 *   5.  Copy base template → .builds/{slug}-v0/
 *   6.  Emit [BUILD_DIR:{path}]
 *   7.  Patch package.json name → slug
 *   8.  Create .env from .env.example
 *   9.  pnpm install
 *   10. git init + commit + push
 *   11. Emit [REPO_URL:{url}]
 *   12. Insert project_versions v0 record
 *   13. Update project.repoUrl in DB
 *   14. Log success
 *
 * Usage: PRODUCT_ID=42 npx tsx scripts/init-project.ts
 */
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  cpSync,
  rmSync,
} from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

const PRODUCT_ID = parseInt(process.env.PRODUCT_ID || "0", 10);
if (!PRODUCT_ID) {
  console.error("PRODUCT_ID env var required");
  process.exit(1);
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Spawn a command and stream stdout/stderr to our stdout. Resolves with exit code. */
function spawnAndStream(cmd: string, args: string[], cwd: string): Promise<number> {
  return new Promise((res) => {
    const child = spawn(cmd, args, { cwd, env: process.env });
    child.stdout.on("data", (c: Buffer) => process.stdout.write(c));
    child.stderr.on("data", (c: Buffer) => process.stdout.write(c));
    child.on("close", (code) => res(code ?? 1));
    child.on("error", (err) => {
      console.error(`[spawn error] ${err.message}`);
      res(1);
    });
  });
}


// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

async function githubPost(url: string, token: string, body: object): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "burningdemand-init-project",
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n${"═".repeat(56)}`);
  console.log(`INIT PROJECT PIPELINE - Project #${PRODUCT_ID}`);
  console.log(`${"═".repeat(56)}\n`);

  // ── Step 1: Load project + founder profile ──────────────────────────────
  console.log(`[1/14] Loading project #${PRODUCT_ID} from DB...`);
  const { db, products, founderProfile } = await import("../src/db/index.js");

  const { eq } = await import("drizzle-orm");

  const [project] = await db.select().from(products).where(eq(products.id, PRODUCT_ID));
  if (!project) {
    console.error("  → Product not found");
    process.exit(1);
  }
  console.log(`  → "${project.name}"`);

  const [founder] = await db.select().from(founderProfile).limit(1);
  if (!founder) {
    console.error("  → No founder profile found");
    process.exit(1);
  }
  console.log(`  → Founder profile loaded`);

  // ── Step 2: Validate ────────────────────────────────────────────────────
  console.log(`\n[2/14] Validating founder git credentials...`);
  if (!founder.gitOrg || !founder.gitToken) {
    console.error("  → gitOrg and gitToken are required in founder_profile. Set them in Settings.");
    process.exit(1);
  }
  console.log(`  → gitOrg: ${founder.gitOrg}`);

  // ── Step 3: Compute slug ────────────────────────────────────────────────
  console.log(`\n[3/14] Computing slug...`);
  const slug =
    project.handle ||
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)
      .replace(/-$/, "");
  console.log(`  → slug: ${slug}`);

  // ── Step 4: Create GitHub repo (or reuse existing) ─────────────────────
  const repoName = `bd-${slug}`;
  console.log(`\n[4/13] Creating GitHub repo "${repoName}"...`);
  const repoPayload = { name: repoName, private: true, auto_init: false };
  const ghHeaders = {
    Authorization: `token ${founder.gitToken}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "burningdemand-init-project",
  };
  let cloneUrl = "";

  async function getExistingRepo(): Promise<string | null> {
    // Try org repo first, then user repo
    for (const url of [
      `https://api.github.com/repos/${founder.gitOrg}/${repoName}`,
      `https://api.github.com/repos/${(await fetch("https://api.github.com/user", { headers: ghHeaders }).then(r => r.json()) as any).login}/${repoName}`,
    ]) {
      const r = await fetch(url, { headers: ghHeaders });
      if (r.ok) {
        const d = await r.json() as { clone_url: string; html_url: string };
        return d.clone_url;
      }
    }
    return null;
  }

  try {
    // Try org endpoint first
    let resp = await githubPost(`https://api.github.com/orgs/${founder.gitOrg}/repos`, founder.gitToken, repoPayload);

    if (resp.status === 404) {
      // Not an org - fall back to user repos
      console.log(`  → Not an org, trying user account...`);
      resp = await githubPost("https://api.github.com/user/repos", founder.gitToken, repoPayload);
    }

    if (resp.status === 422) {
      // Repo already exists - fetch it instead of failing
      const body = await resp.json() as any;
      const alreadyExists = body.errors?.some((e: any) => e.message?.includes("already exists"));
      if (alreadyExists) {
        console.log(`  → Repo already exists, fetching existing repo...`);
        const existing = await getExistingRepo();
        if (!existing) {
          console.error(`  → Could not find existing repo "${slug}" under ${founder.gitOrg}`);
          process.exit(1);
        }
        cloneUrl = existing;
        console.log(`  → Using existing repo: ${existing.replace(/^https:\/\//, "https://github.com/").replace(".git", "")}`);
      } else {
        console.error(`  → GitHub API error 422: ${JSON.stringify(body)}`);
        process.exit(1);
      }
    } else if (!resp.ok) {
      const body = await resp.text();
      console.error(`  → GitHub API error ${resp.status}: ${body}`);
      process.exit(1);
    } else {
      const data = (await resp.json()) as { clone_url: string; html_url: string };
      cloneUrl = data.clone_url;
      console.log(`  → Repo created: ${data.html_url}`);
    }
  } catch (err: any) {
    console.error(`  → Failed to create GitHub repo: ${err.message}`);
    process.exit(1);
  }

  // ── Step 5: Copy template ───────────────────────────────────────────────
  console.log(`\n[5/13] Copying base template to .builds/${repoName}/...`);
  const templateDir = resolve(__dirname, "..", "templates", "base-template");
  const buildsRoot = resolve(__dirname, "..", ".builds");
  const buildDir = resolve(buildsRoot, repoName);

  mkdirSync(buildsRoot, { recursive: true });

  // Remove existing build dir from previous failed attempts before copying
  if (existsSync(buildDir)) {
    console.log(`  → Removing previous build dir...`);
    rmSync(buildDir, { recursive: true, force: true });
  }
  mkdirSync(buildDir, { recursive: true });

  try {
    cpSync(templateDir, buildDir, { recursive: true });
    console.log(`  → Copied to ${buildDir}`);
  } catch (err: any) {
    console.error(`  → Copy failed: ${err.message}`);
    process.exit(1);
  }

  // ── Step 6: Emit BUILD_DIR ──────────────────────────────────────────────
  console.log(`[BUILD_DIR:${buildDir}]`);

  // ── Step 7: Patch package.json ──────────────────────────────────────────
  console.log(`\n[7/14] Patching package.json name → "${slug}"...`);
  const pkgPath = resolve(buildDir, "package.json");
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    pkg.name = slug;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`  → Done`);
  } catch (err: any) {
    console.error(`  → Failed to patch package.json: ${err.message}`);
    process.exit(1);
  }

  // ── Step 8: Create .env from .env.example ──────────────────────────────
  console.log(`\n[8/14] Setting up .env...`);
  const envPath = resolve(buildDir, ".env");
  const envExamplePath = resolve(buildDir, ".env.example");
  if (!existsSync(envPath) && existsSync(envExamplePath)) {
    writeFileSync(envPath, readFileSync(envExamplePath, "utf8"));
    console.log(`  → Created .env from .env.example`);
  } else if (existsSync(envPath)) {
    console.log(`  → .env already exists, skipping`);
  } else {
    console.log(`  → No .env.example found, skipping`);
  }

  // ── Step 9: pnpm install ────────────────────────────────────────────────
  console.log(`\n[9/14] Running pnpm install...`);
  const installCode = await spawnAndStream("pnpm", ["install"], buildDir);
  if (installCode !== 0) {
    console.error(`  → pnpm install failed (exit ${installCode})`);
    process.exit(1);
  }
  console.log(`  → pnpm install complete`);

  // ── Step 10: Git init + push ───────────────────────────────────────────
  console.log(`\n[10/13] Initialising git and pushing to GitHub...`);

  // Build authenticated URL: https://{token}@github.com/{org}/{repo}.git
  // cloneUrl is like https://github.com/org/repo.git
  const authenticatedUrl = cloneUrl.replace(
    "https://",
    `https://${founder.gitToken}@`
  );

  const gitSteps: [string, string[]][] = [
    ["git", ["init"]],
    ["git", ["add", "."]],
    ["git", ["commit", "-m", `v0: initialize ${project.name} from base template`]],
    ["git", ["branch", "-M", "main"]],
    ["git", ["remote", "add", "origin", authenticatedUrl]],
    ["git", ["push", "-u", "origin", "main"]],
  ];

  for (const [cmd, args] of gitSteps) {
    const displayArgs = args.map((a) =>
      a === authenticatedUrl ? cloneUrl : a
    );
    console.log(`  → ${cmd} ${displayArgs.join(" ")}`);
    const code = await spawnAndStream(cmd, args, buildDir);
    if (code !== 0) {
      console.error(`  → git step failed: ${cmd} ${displayArgs.join(" ")} (exit ${code})`);
      process.exit(1);
    }
  }
  console.log(`  → Pushed to GitHub`);

  // ── Step 12: Emit REPO_URL (plain, no token) ────────────────────────────
  console.log(`[REPO_URL:${cloneUrl}]`);

  // ── Step 13: Insert project_versions v0 record ─────────────────────────
  console.log(`\n[12/13] Creating project_versions v0 record in DB...`);
  const { projectVersions } = await import("../src/db/index.js");
  const now = new Date();
  try {
    await db.insert(projectVersions).values({
      productId: PRODUCT_ID,
      versionNumber: 0,
      status: "shipped",
      startedAt: now,
      shippedAt: now,
    });
    console.log(`  → v0 version record inserted`);
  } catch (err: any) {
    console.error(`  → Failed to insert version record: ${err.message}`);
    process.exit(1);
  }

  // ── Step 14: Update project.repoUrl ────────────────────────────────────
  console.log(`\n[13/13] Updating project.repoUrl in DB...`);
  try {
    await db
      .update(products)
      .set({ repoUrl: cloneUrl, updatedAt: now })
      .where(eq(products.id, PRODUCT_ID));
    console.log(`  → repoUrl updated to ${cloneUrl}`);
  } catch (err: any) {
    console.error(`  → Failed to update project.repoUrl: ${err.message}`);
    process.exit(1);
  }

  // ── Done ────────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(56)}`);
  console.log(`✓ Project "${project.name}" initialised`);
  console.log(`  Build dir : ${buildDir}`);
  console.log(`  Repo      : ${cloneUrl}`);
  console.log(`${"═".repeat(56)}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
