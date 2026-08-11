import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { getAuthUser } from "./auth";
import { internal } from "./_generated/api";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getAuthUser(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const saveCard = mutation({
  args: {
    company: v.union(v.string(), v.null()),
    contacts: v.array(
      v.object({
        name: v.string(),
        phones: v.array(v.string()),
      })
    ),
    email: v.union(v.string(), v.null()),
    website: v.union(v.string(), v.null()),
    addresses: v.array(
      v.object({
        type: v.string(),
        value: v.string(),
      })
    ),
    gstin: v.union(v.string(), v.null()),
    services: v.array(v.string()),
    tagline: v.union(v.string(), v.null()),
    rawText: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const cardId = await ctx.db.insert("cardLeads", {
      userId: user._id,
      ...args,
      scannedAt: Date.now(),
    });

    // Space TeleCRM pushes globally so bulk imports don't burst the API.
    // Mutations are serializable, so reserving the next slot is race-free.
    const intervalMs = Number(process.env.TELECRM_PUSH_INTERVAL_MS ?? 600);
    const throttle = await ctx.db.query("telecrmThrottle").first();
    const slot = Math.max(Date.now(), throttle?.nextPushAt ?? 0);
    if (throttle) await ctx.db.patch(throttle._id, { nextPushAt: slot + intervalMs });
    else await ctx.db.insert("telecrmThrottle", { nextPushAt: slot + intervalMs });
    await ctx.scheduler.runAt(slot, internal.telecrm.pushLead, { cardId });

    return cardId;
  },
});

export const getCard = query({
  args: { id: v.id("cardLeads") },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const card = await ctx.db.get(args.id);
    if (!card || card.userId !== user._id) return null;
    const imageUrl = card.imageStorageId
      ? await ctx.storage.getUrl(card.imageStorageId)
      : null;
    return { ...card, imageUrl };
  },
});

export const listCards = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    return ctx.db
      .query("cardLeads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
