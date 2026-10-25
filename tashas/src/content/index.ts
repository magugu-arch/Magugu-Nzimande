import type { Content } from '../domain/content.ts';
import { brandAssets } from './assets.ts';
import { branches } from './branches.ts';
import { campaignPages, events, menuCategories, menuItems, rewardRules } from './catalogue.ts';

/** The content bundle the services read. Swap for a CMS client when Tashas approves data. */
export const content: Content = {
  branches,
  menuCategories,
  menuItems,
  events,
  campaignPages,
  rewardRules,
  assets: brandAssets,
};
