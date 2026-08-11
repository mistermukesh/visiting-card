import { action } from "./_generated/server";
import { v } from "convex/values";
import { createAuth } from "./auth";
import { getAuthUser } from "./auth";
import { internal } from "./_generated/api";

// CLI only — used once to bootstrap the first admin user
export const createUser = action({
  args: {
    adminKey: v.string(),
    email: v.string(),
    name: v.string(),
    password: v.string(),
    isAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, { adminKey, email, name, password, isAdmin }) => {
    if (adminKey !== process.env.ADMIN_KEY) {
      throw new Error("Unauthorized");
    }
    const auth = createAuth(ctx);
    const result = await auth.api.signUpEmail({
      body: { email, name, password },
    });
    await ctx.runMutation(internal.users.createUserMeta, {
      userId: result.user.id,
      isAdmin: isAdmin ?? false,
    });
    return { userId: result.user.id, email: result.user.email };
  },
});

// Called from the admin UI — caller must be an admin
export const createUserAsAdmin = action({
  args: {
    email: v.string(),
    name: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, name, password }) => {
    const caller = await getAuthUser(ctx);
    const callerMeta = await ctx.runQuery(internal.users.getUserMeta, {
      userId: caller._id,
    });
    if (!callerMeta?.isAdmin) {
      throw new Error("Unauthorized");
    }
    const auth = createAuth(ctx);
    const result = await auth.api.signUpEmail({
      body: { email, name, password },
    });
    await ctx.runMutation(internal.users.createUserMeta, {
      userId: result.user.id,
      isAdmin: false,
    });
    return { userId: result.user.id, email: result.user.email };
  },
});
