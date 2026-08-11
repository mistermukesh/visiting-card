"use server";

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const cardSchema = z.object({
  company: z.string().nullable().describe("Company or business name"),
  contacts: z
    .array(
      z.object({
        name: z.string(),
        phones: z.array(z.string()).describe("All phone numbers for this person"),
      })
    )
    .describe("People listed on the card, each with all their phone numbers"),
  email: z.string().nullable(),
  website: z.string().nullable(),
  addresses: z
    .array(
      z.object({
        type: z.string().describe("e.g. Office, Workshop, Branch, or empty string if unlabelled"),
        value: z.string(),
      })
    )
    .describe("All addresses on the card, each with its label"),
  gstin: z.string().nullable().describe("GST Identification Number if present"),
  services: z
    .array(z.string())
    .describe("Products or services listed on the card"),
  tagline: z.string().nullable().describe("Slogan or one-line business description"),
});

export type CardInfo = z.infer<typeof cardSchema>;

export async function extractCardInfo(ocrText: string): Promise<CardInfo> {
  const { output } = await generateText({
    model: openai("gpt-4o-mini"),
    output: Output.object({ schema: cardSchema }),
    prompt: `Extract ALL structured information from this business card OCR text. Rules:
- Fix obvious OCR errors ("0" vs "O", garbled chars, semicolons vs colons)
- One contact entry per unique person; collect ALL their phone numbers in the phones array
- Capture every address with its label (Office, Workshop, etc.)
- List every product/service mentioned
- Return empty arrays [] (not null) for array fields when nothing found
- Return null for scalar fields not present

OCR TEXT:
${ocrText}`,
  });

  return output;
}
