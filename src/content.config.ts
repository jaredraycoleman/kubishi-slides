import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const decks = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/decks" }),
  schema: z.object({
    title: z.string(),
    paiuteTitle: z.string().optional(),
    description: z.string().optional(),
    order: z.number().optional(),
    tags: z.array(z.string()).default([]),
    group: z.enum(["vocab", "grammar", "phrases", "other"]).default("other"),
  }),
});

export const collections = { decks };
