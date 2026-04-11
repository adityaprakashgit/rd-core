export type BrandPaletteSuggestion = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (value: number) => value.toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function lighten(hex: string, amount: number) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return rgbToHex(
    clamp(r + (255 - r) * amount),
    clamp(g + (255 - g) * amount),
    clamp(b + (255 - b) * amount),
  );
}

function darken(hex: string, amount: number) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return rgbToHex(clamp(r * (1 - amount)), clamp(g * (1 - amount)), clamp(b * (1 - amount)));
}

function saturationScore(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min;
}

export async function extractLogoColorSuggestions(file: File): Promise<BrandPaletteSuggestion[]> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
      img.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("CANVAS_NOT_AVAILABLE");
    }

    const targetWidth = 96;
    const ratio = image.height / image.width;
    canvas.width = targetWidth;
    canvas.height = Math.max(1, Math.round(targetWidth * ratio));
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const buckets = new Map<string, { count: number; sat: number }>();

    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3];
      if (alpha < 80) {
        continue;
      }
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const quantizedR = Math.floor(r / 24) * 24;
      const quantizedG = Math.floor(g / 24) * 24;
      const quantizedB = Math.floor(b / 24) * 24;
      const key = `${quantizedR}-${quantizedG}-${quantizedB}`;
      const current = buckets.get(key);
      const sat = saturationScore(quantizedR, quantizedG, quantizedB);
      if (current) {
        current.count += 1;
        current.sat += sat;
      } else {
        buckets.set(key, { count: 1, sat });
      }
    }

    const ranked = Array.from(buckets.entries())
      .map(([key, value]) => {
        const [r, g, b] = key.split("-").map((part) => Number.parseInt(part, 10));
        return {
          hex: rgbToHex(r, g, b),
          score: value.count * 1.2 + value.sat,
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);

    if (ranked.length === 0) {
      return [];
    }

    const primary = ranked[0].hex;
    const secondary = ranked[1]?.hex ?? lighten(primary, 0.22);
    const accent = ranked[2]?.hex ?? darken(primary, 0.18);

    return [
      {
        primaryColor: primary,
        secondaryColor: secondary,
        accentColor: accent,
      },
      {
        primaryColor: darken(primary, 0.14),
        secondaryColor: secondary,
        accentColor: lighten(accent, 0.14),
      },
    ];
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
