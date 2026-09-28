#!/usr/bin/env node
/** npm run build:setup-sql — writes supabase/setup-all.sql (every migration, then the seed). */
import { writeFileSync } from 'node:fs';
import { setupSql } from '../server/setupSql.ts';

writeFileSync(new URL('../supabase/setup-all.sql', import.meta.url), setupSql());
console.log('Wrote supabase/setup-all.sql');
