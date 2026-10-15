type Color = [number, number, number, number];
const backgroundImages = new Map<string, Promise<Color | null>>();

function parseColor(value: string): Color | null {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(/[,\s/]+/).filter(Boolean);
  const channel = (part: string) => parseFloat(part) * (part.endsWith("%") ? 2.55 : 1);
  const alpha = parts[3] ? parseFloat(parts[3]) / (parts[3].endsWith("%") ? 100 : 1) : 1;
  return [channel(parts[0]), channel(parts[1]), channel(parts[2]), alpha];
}

function over(base: Color, layer: Color): Color {
  return [base[0] * (1 - layer[3]) + layer[0] * layer[3], base[1] * (1 - layer[3]) + layer[1] * layer[3], base[2] * (1 - layer[3]) + layer[2] * layer[3], 1];
}

function luminance(color: Color) {
  const linear = color.slice(0, 3).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function paletteColor(style: CSSStyleDeclaration, variable: string, fallback: Color): Color {
  const channels = style.getPropertyValue(variable).trim().split(/\s+/).map(Number);
  return channels.length === 3 && channels.every(Number.isFinite) ? [channels[0], channels[1], channels[2], 1] : fallback;
}

/** Read a tiny cached sample of a CSS wallpaper locally, never page content. */
function imageColor(url: string) {
  let pending = backgroundImages.get(url);
  if (!pending) {
    if (backgroundImages.size >= 12) {
      const first = backgroundImages.keys().next().value;
      if (first) backgroundImages.delete(first);
    }
    pending = new Promise<Color | null>(resolve => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onerror = () => resolve(null);
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 8;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) return resolve(null);
          context.drawImage(image, 0, 0, 8, 8);
          const pixels = context.getImageData(0, 0, 8, 8).data;
          const sum = [0, 0, 0, 0];
          for (let i = 0; i < pixels.length; i += 4) {
            const alpha = pixels[i + 3] / 255;
            for (let c = 0; c < 3; c++) sum[c] += pixels[i + c] * alpha;
            sum[3] += alpha;
          }
          resolve(sum[3] ? [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3], sum[3] / 64] : null);
        } catch { resolve(null); }
      };
      image.src = url;
    });
    backgroundImages.set(url, pending);
  }
  return pending;
}

/** Samples the surfaces behind a portal dock, independently of the selected theme. */
export function observeNavigationContrast(surface: HTMLElement) {
  let disposed = false;
  let timer = 0;
  const images = new Map<string, Color | null>();
  const requested = new Set<string>();
  const supportsBlur = CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)");
  const schedule = () => { if (!disposed && !timer) timer = window.setTimeout(sample, 100); };
  const mutations = new MutationObserver(schedule);

  function sample() {
    timer = 0;
    if (disposed) return;
    const bounds = surface.getBoundingClientRect();
    const observed = new Set<Element>([document.documentElement, document.body]);
    const fallback: Color = document.documentElement.classList.contains("dark") ? [15, 23, 42, 1] : [255, 255, 255, 1];
    const colors = [0.12, 0.31, 0.5, 0.69, 0.88].map(position => {
      const x = Math.max(0, Math.min(innerWidth - 1, bounds.left + bounds.width * position));
      const y = Math.max(0, Math.min(innerHeight - 1, bounds.top + bounds.height / 2));
      const target = document.elementsFromPoint(x, y).find(element => !surface.contains(element) && !element.closest(".glass-navigation-floating"));
      const ancestors: Element[] = [];
      for (let element = target; element; element = element.parentElement ?? undefined) ancestors.unshift(element);
      let color = fallback;
      for (const element of ancestors) {
        observed.add(element);
        const style = getComputedStyle(element);
        const background = parseColor(style.backgroundColor);
        if (background) color = over(color, background);
        for (const match of style.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          const url = match[1];
          const image = images.get(url);
          if (image) color = over(color, image);
          if (!requested.has(url)) {
            requested.add(url);
            void imageColor(url).then(result => {
              if (!disposed) { images.set(url, result); if (result) schedule(); }
            });
          }
        }
        const stops = Array.from(style.backgroundImage.matchAll(/rgba?\([^)]+\)/g), match => parseColor(match[0])!).filter(Boolean);
        const alpha = stops.reduce((total, stop) => total + stop[3], 0);
        if (alpha) color = over(color, [stops.reduce((total, stop) => total + stop[0] * stop[3], 0) / alpha, stops.reduce((total, stop) => total + stop[1] * stop[3], 0) / alpha, stops.reduce((total, stop) => total + stop[2] * stop[3], 0) / alpha, alpha / stops.length]);
      }
      return color;
    });
    const brightness = colors.reduce((sum, color) => sum + luminance(color), 0) / colors.length;
    // Hysteresis prevents flickering when a card edge passes behind the bar.
    const threshold = surface.dataset.underlay === "light" ? 0.30 : 0.40;
    const brightPage = brightness >= threshold;
    surface.dataset.underlay = brightPage ? "light" : "dark";
    const style = getComputedStyle(surface);
    // A faint accent wash takes its hue directly from the selected preset or
    // Material You palette. Deep neutral pigment made bright pages look grey.
    const material = supportsBlur
      ? brightPage ? paletteColor(style, "--brand-400", [96, 165, 250, 1]) : paletteColor(style, "--brand-200", [191, 219, 254, 1])
      : paletteColor(style, "--brand-700", [29, 78, 216, 1]);
    // Preserve at least 88% backdrop transmission on bright pages. Foreground
    // contrast comes from theme accent tones, never an opaque dark scrim.
    const opacity = supportsBlur
      ? brightPage ? Math.min(.12, .08 + brightness * .04) : .14
      : .95;
    surface.style.setProperty("--navigation-material", material.slice(0, 3).map(Math.round).join(" "));
    surface.style.setProperty("--navigation-opacity", opacity.toFixed(2));
    mutations.disconnect();
    for (const element of observed) mutations.observe(element, { attributes: true, attributeFilter: ["class", "style", "data-app-theme", "data-device-colors"] });
    const devicePalette = document.getElementById("trinity-device-colors");
    if (devicePalette) mutations.observe(devicePalette, { childList: true, characterData: true, subtree: true });
  }

  const resize = new ResizeObserver(schedule);
  resize.observe(surface);
  resize.observe(document.documentElement);
  document.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("resize", schedule);
  sample();
  return () => {
    disposed = true;
    clearTimeout(timer);
    resize.disconnect();
    mutations.disconnect();
    document.removeEventListener("scroll", schedule, true);
    window.removeEventListener("resize", schedule);
  };
}
