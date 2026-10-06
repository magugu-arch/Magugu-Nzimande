import { Album, Pillar, PressKit, SiteSettings, Story, Video } from '../schema';
import { albums, videos } from './catalogue';
import { pillars, pressKit, siteSettings } from './institution';
import { stories } from './journal';

export type SeedContent = {
  albums: Album[];
  videos: Video[];
  stories: Story[];
  pillars: Pillar[];
  pressKit: PressKit;
  settings: SiteSettings;
};

/** The designed starting content, validated once at load so a bad edit fails loudly. */
export const seed: SeedContent = {
  albums: Album.array().parse(albums),
  videos: Video.array().parse(videos),
  stories: Story.array().parse(stories),
  pillars: Pillar.array().parse(pillars),
  pressKit: PressKit.parse(pressKit),
  settings: SiteSettings.parse(siteSettings),
};
