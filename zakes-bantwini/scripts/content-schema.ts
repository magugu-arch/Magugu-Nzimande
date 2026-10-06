/**
 * Export the content model as JSON Schema, for whichever CMS management
 * chooses (Sanity, Contentful, Payload, Strapi…).
 *
 *   npm run content:schema   → content-model.schema.json
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { Album, Pillar, PressKit, SiteSettings, Story, Video } from '../src/content/schema';

const out = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'content-model.schema.json');
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Zakes Bantwini — content model',
  description: 'Generated from src/content/schema.ts. Every editorial entry carries approval: approved | pending | placeholder.',
  $defs: {
    Album: z.toJSONSchema(Album, { io: 'input' }),
    Video: z.toJSONSchema(Video, { io: 'input' }),
    Story: z.toJSONSchema(Story, { io: 'input' }),
    Pillar: z.toJSONSchema(Pillar, { io: 'input' }),
    PressKit: z.toJSONSchema(PressKit, { io: 'input' }),
    SiteSettings: z.toJSONSchema(SiteSettings, { io: 'input' }),
  },
};
await writeFile(out, JSON.stringify(schema, null, 2) + '\n');
console.log(`wrote ${path.relative(process.cwd(), out)}`);
