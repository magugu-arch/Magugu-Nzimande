/**
 * Approved content as the services see it. The data itself lives in
 * src/content/ (the CMS seam); admin overrides from the database are layered
 * on top here so staff change behaviour without touching UI components.
 */

import type { Ctx } from './context.ts';
import type {
  BookingPolicy,
  BrandImageAsset,
  Branch,
  CampaignPage,
  EventListing,
  MenuCategory,
  MenuItem,
  RewardRules,
} from './types.ts';
import { DomainError } from './util/core.ts';

export interface Content {
  branches: Branch[];
  menuCategories: MenuCategory[];
  menuItems: MenuItem[];
  events: EventListing[];
  campaignPages: CampaignPage[];
  rewardRules: RewardRules;
  assets: BrandImageAsset[];
}

export function branchById(content: Content, id: string): Branch {
  const branch = content.branches.find((b) => b.id === id);
  if (!branch) throw new DomainError('unknown_branch', `No published branch ${id}`);
  return branch;
}

export function effectivePolicy(ctx: Ctx, branchId: string): BookingPolicy {
  const base = branchById(ctx.content, branchId).policy;
  const override = ctx.db.get('branchOverrides', branchId);
  return override ? { ...base, ...override.policy } : base;
}
