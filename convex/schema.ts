import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userMeta: defineTable({
    userId: v.string(),
    mustChangePassword: v.boolean(),
    isAdmin: v.optional(v.boolean()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  telecrmThrottle: defineTable({
    nextPushAt: v.number(),
  }),

  cardLeads: defineTable({
    userId: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
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
    scannedAt: v.number(),
  }).index("by_user", ["userId"]),
});

