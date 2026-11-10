import { color } from './color';
import { radius, space } from './layout';
import { fontStack } from './type';

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * The tokens as CSS custom properties, for the web admin. Generated from the
 * same source as the mobile theme so the two can never drift.
 */
export function tokensAsCss(selector = ':root'): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(color)) lines.push(`  --kc-color-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(space)) lines.push(`  --kc-space-${kebab(k)}: ${v}px;`);
  for (const [k, v] of Object.entries(radius)) lines.push(`  --kc-radius-${kebab(k)}: ${v}px;`);
  for (const [k, v] of Object.entries(fontStack)) lines.push(`  --kc-font-${kebab(k)}: ${v};`);
  return `${selector} {\n${lines.join('\n')}\n}\n`;
}
