import type { PersonItem } from '../../entity/PersonItem';

export type JsonRecord = Record<string, unknown>;

export type MessageContextOptions = {
  entityHandle: string;
  itemHandle?: string | number;
  currentUser?: PersonItem;
  draftValues?: Record<string, unknown>;
  relations?: string[];
};

export type MessageTemplateRenderOptions = {
  entityHandle?: string;
  locale?: string;
  timeZone?: string;
  currentUser?: PersonItem;
};

export type PlaceholderFormatter = {
  name: string;
  args: string[];
};
