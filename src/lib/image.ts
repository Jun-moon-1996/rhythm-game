import { CatType, PreloadedCatImage } from '../types';

export async function preloadCatImage(type: CatType, url: string): Promise<PreloadedCatImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (!tempCtx) {
        reject(new Error('Failed to create canvas context'));
        return;
      }

      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      tempCtx.drawImage(img, 0, 0);

      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
      const data = imageData.data;

      let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
      let found = false;

      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const alpha = data[(y * img.width + x) * 4 + 3];
          if (alpha > 0) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
            found = true;
          }
        }
      }

      if (found) {
        const bounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        resolve({ img, bounds });
      } else {
        // Fallback to full image if no alpha found
        resolve({ img, bounds: { x: 0, y: 0, w: img.width, h: img.height } });
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
  });
}
