import { components } from "./_generated/api";
import { createClient, convexAdapter } from "@convex-dev/better-auth";
import { betterAuth } from "better-auth/minimal";
import { convex } from "@convex-dev/better-auth/plugins";
import authConfig from "./auth.config";
import type { DataModel } from "./_generated/dataModel";

export const createAuth = (ctx: any) =>
  betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    database: convexAdapter(ctx, components.betterAuth),
    emailAndPassword: { enabled: true },
    plugins: [convex({ authConfig })],
    trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  });

export const { getAuthUser, safeGetAuthUser, registerRoutes } =
  createClient<DataModel>(components.betterAuth);
