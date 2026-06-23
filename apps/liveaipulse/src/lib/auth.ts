import { createAuth } from "@offbeatport/auth/server";
import { db } from "../db/client";

export const auth = createAuth({
  db,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },
});

export type Auth = typeof auth;
