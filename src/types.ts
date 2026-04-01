export type CatType = 'tuxedo_cat' | 'orange_tabby' | 'siamese' | 'calico';

export interface PreloadedCatImage {
  img: HTMLImageElement;
  bounds: { x: number; y: number; w: number; h: number };
}
