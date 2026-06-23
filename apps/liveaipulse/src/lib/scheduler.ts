let started = false;

export function scheduleDailyRun() {
  if (started || typeof process === "undefined") return;
  started = true;

  import("node-cron").then(({ default: cron }) => {
    // Run at 02:00 UTC every Monday
    cron.schedule("0 2 * * 1", async () => {
      console.log("[scheduler] Starting weekly run...");
      try {
        const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3002";
        const secret = process.env.CRON_SECRET ?? "dev-cron-secret";
        await fetch(`${baseURL}/api/cron/daily`, {
          method: "POST",
          headers: { "x-cron-secret": secret },
        });
      } catch (err) {
        console.error("[scheduler] Daily run failed:", err);
      }
    });

    console.log("[scheduler] Daily run scheduled at 02:00 UTC");

    // Weekly digest: every Monday at 08:00 UTC
    cron.schedule("0 8 * * 1", async () => {
      console.log("[scheduler] Starting weekly digest...");
      try {
        const { sendWeeklyDigests } = await import("./digest-email");
        await sendWeeklyDigests();
        console.log("[scheduler] Weekly digest complete.");
      } catch (err) {
        console.error("[scheduler] Weekly digest failed:", err);
      }
    });

    console.log("[scheduler] Weekly digest scheduled at 08:00 UTC on Mondays");
  });
}
