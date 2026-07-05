export type StashItem = {
  id: string;
  name: string;
  imageDataUrl?: string;
  link?: string;
  notes?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
};

export type Stash = {
  id: string;
  name: string;
  items: StashItem[];
  createdAt: string;
  updatedAt: string;
};

export type CreateItemInput = Pick<StashItem, "x" | "y" | "width" | "height"> &
  Partial<Pick<StashItem, "name" | "imageDataUrl" | "link" | "notes">>;

export type UpdateItemInput = Partial<Omit<StashItem, "id" | "createdAt">>;

export const DEFAULT_ITEM_WIDTH = 220;
export const DEFAULT_ITEM_HEIGHT = 260;

export const MAX_ITEMS_PER_STASH = 50;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB, mirrors future server-side limit
