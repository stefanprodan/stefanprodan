import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  /* Flat files are legacy; new posts get a folder with images next to index.md */
  loader: glob({ base: './content/blog', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      slug: z.string(),
      hideToc: z.boolean().default(false),
      categories: z.array(z.string()).default([]),
      /* Social embed image; colocated path, takes precedence over body images */
      image: image().optional(),
    }),
});

export const collections = { blog };
