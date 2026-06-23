import { createAuth } from "@offbeatport/microsaas-core/auth/server";
import { db } from "../db/client";

export const auth = createAuth({ db });

export type Auth = typeof auth;
