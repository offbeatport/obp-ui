import { createServerFn } from "@tanstack/react-start";
import { getConfig } from "~/config/store";
import { deploymentMode } from "~/lib/deployment";

// The AUTH SEAM (read side) — the ONE place "who is the user?" is answered.
//
//  self-host: a fixed local principal. There's a single tenant (you), so there's no
//             login; the display name comes from app_config['account.name'] (edited in
//             Settings → Account). Settings live at scope='global'.
//  hosted   : resolve the better-auth session → its user; per-tenant settings key off
//             scope = userId. (Wired when hosting lands — TODO below.)
export type Identity = {
    userId: string;
    name: string;
    initial: string; // avatar letter
    deployment: "self-host" | "hosted";
    authed: boolean; // hosted: real session present; self-host: always true (implicit local principal)
};

export const getIdentity = createServerFn({ method: "GET" }).handler(
    async (): Promise<Identity> => {
        const deployment = deploymentMode();
        // TODO(hosted): read the better-auth session here and return the session user;
        // fall through to the local principal only for self-host.
        const name = (getConfig<string>("account.name") ?? "You").trim() || "You";
        return {
            userId: "local",
            name,
            initial: (name[0] ?? "C").toUpperCase(),
            deployment,
            authed: true,
        };
    },
);
