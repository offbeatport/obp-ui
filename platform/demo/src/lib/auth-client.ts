import { createCoreAuthClient } from "@offbeatport/microsaas-core/auth/client";

export const authClient = createCoreAuthClient();

export const { signIn, signOut, signUp, useSession, getSession } = authClient;
