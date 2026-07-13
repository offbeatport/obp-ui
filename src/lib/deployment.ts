// Where cslopslop is running. Self-host (OSS default) probes local coding-agent CLIs and
// gates first-run onboarding; hosted is managed multi-tenant (no host probing, managed credits).
export type Deployment = "self-host" | "hosted";

export function deploymentMode(): Deployment {
    return process.env.CSLOP_DEPLOYMENT === "hosted" ? "hosted" : "self-host";
}
