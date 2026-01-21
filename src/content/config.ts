import { defineCollection, z } from 'astro:content';

const episodes = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    episodeNumber: z.number(),
    publishDate: z.coerce.date(),
    description: z.string(),
    audioUrl: z.string().url(),
    featuredStory: z.object({
      title: z.string(),
      author: z.string(),
      year: z.number().optional(),
    }),
    duration: z.string().optional(),
  }),
});

export const collections = { episodes };
