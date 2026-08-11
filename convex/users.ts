import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUser, safeGetAuthUser } from "./auth";

export const getMyMeta = query({
  args: {},
  handler: async (ctx) => {
    const user = await safeGetAuthUser(ctx);
    if (!user) return null;
    return ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
  },
});

export const markPasswordChanged = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    const meta = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (meta) {
      await ctx.db.patch(meta._id, { mustChangePassword: false });
    }
  },
});

export const getUserMeta = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const createUserMeta = internalMutation({
  args: { userId: v.string(), isAdmin: v.optional(v.boolean()) },
  handler: async (ctx, { userId, isAdmin }) => {
    const existing = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!existing) {
      await ctx.db.insert("userMeta", {
        userId,
        mustChangePassword: true,
        isAdmin: isAdmin ?? false,
      });
    }
  },
});
