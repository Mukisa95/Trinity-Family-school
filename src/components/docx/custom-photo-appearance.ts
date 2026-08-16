import type { CSSProperties } from 'react';
import type { FrameShape, LayerAppearance, LayerPaint } from './custom-photo-types';

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function rgba(color: string, opacity: number) {
  const alpha = clamp(opacity, 0, 1);
  const hex = color.trim().replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const [r, g, b] = hex.split('').map((part) => parseInt(part + part, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${alpha})`;
  }
  return color;
}

function normalizedStops(paint: LayerPaint) {
  return [...paint.stops]
    .slice(0, 8)
    .map((stop, index) => ({ color: stop.color || paint.color, position: clamp(Number(stop.position) || index / Math.max(1, paint.stops.length - 1), 0, 1) }))
    .sort((a, b) => a.position - b.position);
}

export function paintToCss(paint: LayerPaint) {
  if (paint.kind === 'solid') return paint.color;
  const stops = normalizedStops(paint).map((stop) => `${stop.color} ${Math.round(stop.position * 100)}%`).join(', ');
  if (paint.kind === 'radial') {
    return `radial-gradient(circle ${Math.round(paint.radius * 100)}% at ${Math.round(paint.centerX * 100)}% ${Math.round(paint.centerY * 100)}%, ${stops})`;
  }
  return `linear-gradient(${paint.angle}deg, ${stops})`;
}

export function createCanvasPaint(context: CanvasRenderingContext2D, paint: LayerPaint, width: number, height: number): string | CanvasGradient {
  if (paint.kind === 'solid') return paint.color;
  const stops = normalizedStops(paint);
  if (paint.kind === 'radial') {
    const centerX = width * clamp(paint.centerX, 0, 1);
    const centerY = height * clamp(paint.centerY, 0, 1);
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * clamp(paint.radius, 0.05, 2));
    stops.forEach((stop) => gradient.addColorStop(stop.position, stop.color));
    return gradient;
  }
  const radians = (paint.angle - 90) * Math.PI / 180;
  const halfLength = Math.sqrt(width ** 2 + height ** 2) / 2;
  const centerX = width / 2;
  const centerY = height / 2;
  const gradient = context.createLinearGradient(
    centerX - Math.cos(radians) * halfLength,
    centerY - Math.sin(radians) * halfLength,
    centerX + Math.cos(radians) * halfLength,
    centerY + Math.sin(radians) * halfLength,
  );
  stops.forEach((stop) => gradient.addColorStop(stop.position, stop.color));
  return gradient;
}

export function makeLayerShapePath(context: CanvasRenderingContext2D, shape: FrameShape, width: number, height: number, inset = 0) {
  const left = inset;
  const top = inset;
  const right = Math.max(left, width - inset);
  const bottom = Math.max(top, height - inset);
  const innerWidth = Math.max(1, right - left);
  const innerHeight = Math.max(1, bottom - top);
  context.beginPath();
  if (shape === 'circle' || shape === 'oval') {
    context.ellipse(width / 2, height / 2, innerWidth / 2, innerHeight / 2, 0, 0, Math.PI * 2);
  } else if (shape === 'diamond') {
    context.moveTo(width / 2, top);
    context.lineTo(right, height / 2);
    context.lineTo(width / 2, bottom);
    context.lineTo(left, height / 2);
    context.closePath();
  } else if (shape === 'hexagon') {
    context.moveTo(left + innerWidth * 0.25, top);
    context.lineTo(left + innerWidth * 0.75, top);
    context.lineTo(right, height / 2);
    context.lineTo(left + innerWidth * 0.75, bottom);
    context.lineTo(left + innerWidth * 0.25, bottom);
    context.lineTo(left, height / 2);
    context.closePath();
  } else if (shape === 'rounded') {
    context.roundRect(left, top, innerWidth, innerHeight, Math.min(innerWidth, innerHeight) * 0.12);
  } else {
    context.rect(left, top, innerWidth, innerHeight);
  }
}

function direction(angle: number) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

export function drawStyledShape(context: CanvasRenderingContext2D, shape: FrameShape, appearance: LayerAppearance, width: number, height: number) {
  const scale = Math.max(0.45, Math.min(width, height) / 180);
  const drawPath = (inset = 0) => makeLayerShapePath(context, shape, width, height, inset);
  const drawFill = (paint: LayerPaint, alpha = 1, offsetX = 0, offsetY = 0) => {
    context.save();
    context.translate(offsetX, offsetY);
    drawPath();
    context.globalAlpha = alpha;
    context.fillStyle = createCanvasPaint(context, paint, width, height);
    context.fill();
    context.restore();
  };

  if (appearance.extrusion.enabled && appearance.extrusion.depth > 0) {
    const vector = direction(appearance.extrusion.angle);
    const steps = Math.min(30, Math.max(1, Math.round(appearance.extrusion.depth * scale)));
    for (let step = steps; step >= 1; step -= 1) {
      drawFill({ ...appearance.fill, kind: 'solid', color: appearance.extrusion.color }, appearance.extrusion.opacity, vector.x * step, vector.y * step);
    }
  }

  context.save();
  if (appearance.shadow.enabled && appearance.shadow.kind === 'outer') {
    context.shadowColor = rgba(appearance.shadow.color, appearance.shadow.opacity);
    context.shadowBlur = appearance.shadow.blur * scale;
    context.shadowOffsetX = appearance.shadow.offsetX * scale;
    context.shadowOffsetY = appearance.shadow.offsetY * scale;
  }
  drawPath();
  context.fillStyle = createCanvasPaint(context, appearance.fill, width, height);
  context.fill();
  context.restore();

  if (appearance.shadow.enabled && appearance.shadow.kind === 'inner') {
    context.save();
    drawPath();
    context.clip();
    context.globalAlpha = appearance.shadow.opacity;
    context.shadowColor = appearance.shadow.color;
    context.shadowBlur = appearance.shadow.blur * scale;
    context.shadowOffsetX = appearance.shadow.offsetX * scale;
    context.shadowOffsetY = appearance.shadow.offsetY * scale;
    context.fillStyle = appearance.shadow.color;
    context.fillRect(-width, -height, width * 3, height * 3);
    context.restore();
  }

  if (appearance.bevel.enabled && appearance.bevel.depth > 0) {
    const vector = direction(appearance.bevel.angle);
    const depth = appearance.bevel.depth * scale;
    const lineWidth = Math.max(1, depth * 1.45);
    context.save();
    context.globalAlpha = appearance.bevel.opacity;
    context.translate(-vector.x * depth * 0.45, -vector.y * depth * 0.45);
    drawPath(lineWidth / 2);
    context.strokeStyle = appearance.bevel.highlightColor;
    context.lineWidth = lineWidth;
    context.stroke();
    context.restore();
    context.save();
    context.globalAlpha = appearance.bevel.opacity;
    context.translate(vector.x * depth * 0.45, vector.y * depth * 0.45);
    drawPath(lineWidth / 2);
    context.strokeStyle = appearance.bevel.shadowColor;
    context.lineWidth = lineWidth;
    context.stroke();
    context.restore();
  }

  if (appearance.stroke.enabled && appearance.stroke.width > 0) {
    context.save();
    context.globalAlpha = appearance.stroke.opacity;
    drawPath(appearance.stroke.width * scale / 2);
    context.strokeStyle = createCanvasPaint(context, appearance.stroke.paint, width, height);
    context.lineWidth = appearance.stroke.width * scale;
    context.stroke();
    context.restore();
  }

  if (appearance.shine.enabled) {
    const vector = direction(appearance.shine.angle);
    const center = (vector.x >= 0 ? width : 0) * appearance.shine.position + width * 0.5 * (1 - Math.abs(vector.x));
    const spread = Math.max(width, height) * appearance.shine.width;
    const gradient = context.createLinearGradient(center - vector.y * spread, height / 2 - vector.x * spread, center + vector.y * spread, height / 2 + vector.x * spread);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, `rgba(255,255,255,${appearance.shine.opacity})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.save();
    drawPath();
    context.clip();
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.restore();
  }
}

export function drawStyledText(
  context: CanvasRenderingContext2D,
  appearance: LayerAppearance,
  width: number,
  height: number,
  drawFill: (context: CanvasRenderingContext2D) => void,
  drawStroke: (context: CanvasRenderingContext2D) => void,
) {
  const scale = Math.max(0.45, Math.min(width, height) / 180);
  if (appearance.extrusion.enabled && appearance.extrusion.depth > 0) {
    const vector = direction(appearance.extrusion.angle);
    const steps = Math.min(30, Math.max(1, Math.round(appearance.extrusion.depth * scale)));
    context.save();
    context.fillStyle = appearance.extrusion.color;
    context.globalAlpha = appearance.extrusion.opacity;
    for (let step = steps; step >= 1; step -= 1) {
      context.save();
      context.translate(vector.x * step, vector.y * step);
      drawFill(context);
      context.restore();
    }
    context.restore();
  }

  context.save();
  if (appearance.shadow.enabled && appearance.shadow.kind === 'outer') {
    context.shadowColor = rgba(appearance.shadow.color, appearance.shadow.opacity);
    context.shadowBlur = appearance.shadow.blur * scale;
    context.shadowOffsetX = appearance.shadow.offsetX * scale;
    context.shadowOffsetY = appearance.shadow.offsetY * scale;
  }
  context.fillStyle = createCanvasPaint(context, appearance.fill, width, height);
  drawFill(context);
  context.restore();

  if (appearance.bevel.enabled && appearance.bevel.depth > 0) {
    const vector = direction(appearance.bevel.angle);
    const depth = appearance.bevel.depth * scale;
    context.save();
    context.globalAlpha = appearance.bevel.opacity;
    context.translate(-vector.x * depth * 0.45, -vector.y * depth * 0.45);
    context.strokeStyle = appearance.bevel.highlightColor;
    context.lineWidth = Math.max(1, depth * 1.25);
    drawStroke(context);
    context.restore();
    context.save();
    context.globalAlpha = appearance.bevel.opacity;
    context.translate(vector.x * depth * 0.45, vector.y * depth * 0.45);
    context.strokeStyle = appearance.bevel.shadowColor;
    context.lineWidth = Math.max(1, depth * 1.25);
    drawStroke(context);
    context.restore();
  }

  if (appearance.stroke.enabled && appearance.stroke.width > 0) {
    context.save();
    context.globalAlpha = appearance.stroke.opacity;
    context.strokeStyle = createCanvasPaint(context, appearance.stroke.paint, width, height);
    context.lineWidth = Math.max(1, appearance.stroke.width * scale);
    drawStroke(context);
    context.restore();
  }

  if (appearance.shine.enabled) {
    const maskCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (maskCanvas) {
      maskCanvas.width = Math.max(2, Math.ceil(width));
      maskCanvas.height = Math.max(2, Math.ceil(height));
      const maskContext = maskCanvas.getContext('2d');
      if (maskContext) {
        maskContext.font = context.font;
        maskContext.textAlign = context.textAlign;
        maskContext.textBaseline = context.textBaseline;
        maskContext.fillStyle = '#ffffff';
        drawFill(maskContext);
        const vector = direction(appearance.shine.angle);
        const span = Math.max(width, height) * appearance.shine.width;
        const offset = (appearance.shine.position - 0.5) * Math.max(width, height);
        const gradient = maskContext.createLinearGradient(
          width / 2 - vector.y * span + vector.x * offset,
          height / 2 + vector.x * span + vector.y * offset,
          width / 2 + vector.y * span + vector.x * offset,
          height / 2 - vector.x * span + vector.y * offset,
        );
        gradient.addColorStop(0, 'rgba(255,255,255,0)');
        gradient.addColorStop(0.5, `rgba(255,255,255,${appearance.shine.opacity})`);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        maskContext.globalCompositeOperation = 'source-in';
        maskContext.fillStyle = gradient;
        maskContext.fillRect(0, 0, width, height);
        context.drawImage(maskCanvas, 0, 0, width, height);
      }
    }
  }
}

export function getLayerPreviewStyle(appearance: LayerAppearance, mode: 'text' | 'shape' | 'frame'): CSSProperties {
  const shadow = appearance.shadow.enabled && appearance.shadow.kind === 'outer'
    ? `${appearance.shadow.offsetX}px ${appearance.shadow.offsetY}px ${appearance.shadow.blur}px ${rgba(appearance.shadow.color, appearance.shadow.opacity)}`
    : undefined;
  const bevel = appearance.bevel.enabled
    ? `${Math.cos((appearance.bevel.angle - 90) * Math.PI / 180) * appearance.bevel.depth * -0.35}px ${Math.sin((appearance.bevel.angle - 90) * Math.PI / 180) * appearance.bevel.depth * -0.35}px ${appearance.bevel.softness}px ${rgba(appearance.bevel.highlightColor, appearance.bevel.opacity)}, ${Math.cos((appearance.bevel.angle - 90) * Math.PI / 180) * appearance.bevel.depth * 0.35}px ${Math.sin((appearance.bevel.angle - 90) * Math.PI / 180) * appearance.bevel.depth * 0.35}px ${appearance.bevel.softness}px ${rgba(appearance.bevel.shadowColor, appearance.bevel.opacity)}`
    : undefined;
  const extrusion = appearance.extrusion.enabled && appearance.extrusion.depth > 0 && mode === 'text'
    ? Array.from({ length: Math.min(12, Math.max(1, Math.round(appearance.extrusion.depth))) }, (_, index) => {
      const step = index + 1;
      const vector = direction(appearance.extrusion.angle);
      return `${(vector.x * step).toFixed(1)}px ${(vector.y * step).toFixed(1)}px 0 ${rgba(appearance.extrusion.color, appearance.extrusion.opacity)}`;
    }).join(', ')
    : undefined;
  const shadows = [extrusion, shadow, bevel].filter(Boolean).join(', ') || undefined;
  if (mode === 'text') {
    const gradient = appearance.fill.kind !== 'solid' || appearance.shine.enabled;
    const fill = paintToCss(appearance.fill);
    const shine = appearance.shine.enabled
      ? `linear-gradient(${appearance.shine.angle}deg, transparent ${Math.max(0, appearance.shine.position * 100 - appearance.shine.width * 50)}%, rgba(255,255,255,${appearance.shine.opacity}) ${appearance.shine.position * 100}%, transparent ${Math.min(100, appearance.shine.position * 100 + appearance.shine.width * 50)}%), `
      : '';
    return {
      color: gradient ? 'transparent' : appearance.fill.color,
      backgroundImage: gradient ? `${shine}${fill}` : undefined,
      WebkitBackgroundClip: gradient ? 'text' : undefined,
      backgroundClip: gradient ? 'text' : undefined,
      WebkitTextStroke: appearance.stroke.enabled && appearance.stroke.width > 0 ? `${appearance.stroke.width}px ${appearance.stroke.paint.color}` : undefined,
      textShadow: shadows,
    };
  }
  return {
    background: mode === 'shape' ? paintToCss(appearance.fill) : undefined,
    boxShadow: shadows,
  };
}
