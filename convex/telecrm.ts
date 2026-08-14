import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const DEFAULT_ENTERPRISE_ID = "69a96e994a12451e894e4a38";

// Best-effort normalize to TeleCRM format: country code + number, digits only (e.g. 919999999999).
function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return "91" + d;
  if (d.length === 11 && d.startsWith("0")) return "91" + d.slice(1);
  if (d.length === 13 && d.startsWith("091")) return d.slice(1);
  return d;
}

export const _getCard = internalQuery({
  args: { cardId: v.id("cardLeads") },
  handler: (ctx, { cardId }) => ctx.db.get(cardId),
});

export const pushLead = internalAction({
  args: { cardId: v.id("cardLeads") },
  handler: async (ctx, { cardId }) => {
    const enterpriseId = process.env.TELECRM_ENTERPRISE_ID ?? DEFAULT_ENTERPRISE_ID;
    const token = process.env.TELECRM_TOKEN;
    if (!token) {
      console.error("TELECRM_TOKEN not set — skipping TeleCRM push");
      return;
    }

    const card = await ctx.runQuery(internal.telecrm._getCard, { cardId });
    if (!card) return;

    const contact = card.contacts[0];
    const rawPhone = contact?.phones?.[0];
    if (!rawPhone) {
      console.warn(`No phone on card ${cardId} — cannot match TeleCRM identifier, skipping`);
      return;
    }

    const fields: Record<string, string> = {
      name: contact?.name || card.company || "Unknown",
      phone: normalizePhone(rawPhone),
    };
    if (card.email) fields.email = card.email;
    if (card.company) fields.company = card.company;
    if (card.website) fields.website = card.website;
    const addrStr = card.addresses?.map((a) => a.value).filter(Boolean).join(", ");
    if (addrStr) fields.address = addrStr;
    if (card.gstin) fields.gstin = card.gstin;
    const servicesStr = card.services?.filter(Boolean).join(", ");
    if (servicesStr) fields.services = servicesStr;
    if (card.tagline) fields.tagline = card.tagline;

    const assigneeName = process.env.TELECRM_ASSIGNEE ?? "Komal";
    const assigneeEmail = process.env.TELECRM_ASSIGNEE_EMAIL ?? "sales8@kanuniversal.com";

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const pushOnce = (assignee: string) =>
      fetch(
        `https://next-api.telecrm.in/enterprise/${enterpriseId}/autoupdatelead`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ fields: { ...fields, "Assigned To": assignee } }),
        }
      );

    // Retry only transient failures (429 rate-limit, 5xx). Client errors (4xx) fail fast.
    const maxRetries = Number(process.env.TELECRM_MAX_RETRIES ?? 3);
    const pushWithAssignee = async (assignee: string) => {
      let res = await pushOnce(assignee);
      let attempt = 0;
      while ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(1000 * 2 ** attempt, 8000);
        console.warn(`TeleCRM ${res.status} for phone=${fields.phone} — retry ${attempt + 1}/${maxRetries} in ${backoff}ms`);
        await sleep(backoff);
        res = await pushOnce(assignee);
        attempt += 1;
      }
      return res;
    };

    // Try name first
    let res = await pushWithAssignee(assigneeName);
    const body1 = await res.text();
    console.log(`TeleCRM push [name="${assigneeName}"] status=${res.status} phone=${fields.phone} response=${body1}`);

    if (!res.ok) {
      console.error(`TeleCRM push failed with name (${res.status}) — retrying with email`);

      // Fallback: try email
      res = await pushWithAssignee(assigneeEmail);
      const body2 = await res.text();
      console.log(`TeleCRM push [email="${assigneeEmail}"] status=${res.status} phone=${fields.phone} response=${body2}`);

      if (!res.ok) {
        console.error(`TeleCRM push failed with email too (${res.status})`);
      } else {
        console.log(`TeleCRM assignment queued via email fallback — assigned to ${assigneeEmail}`);
      }
    } else {
      console.log(`TeleCRM lead push queued — assigned to ${assigneeName}`);
    }
  },
});
