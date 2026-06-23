import { createCoreAuthClient } from "@offbeatport/auth/client";

export const authClient = createCoreAuthClient();

export const { signIn, signOut, signUp, useSession, getSession } = authClient;
