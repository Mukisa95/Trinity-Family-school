import type { CustomPhotoTemplate } from './custom-photo-types';

export type DocXFontCategory = 'System' | 'Sans serif' | 'Serif' | 'Handwriting' | 'Display' | 'Decorative';

interface DocXFontFace {
  file: string;
  weight?: number;
  style?: 'normal' | 'italic';
  format?: 'truetype' | 'opentype' | 'woff';
}

export interface DocXFontOption {
  family: string;
  label: string;
  category: DocXFontCategory;
  faces: DocXFontFace[];
}

const font = (
  label: string,
  category: DocXFontCategory,
  faces: DocXFontFace[] = [],
  family = faces.length > 0 ? `DocX ${label}` : label,
): DocXFontOption => ({ family, label, category, faces });

export const DOCX_FONT_OPTIONS: DocXFontOption[] = [
  font('Arial', 'System'),
  font('Georgia', 'System'),
  font('Trebuchet MS', 'System'),
  font('Verdana', 'System'),
  font('Times New Roman', 'Serif', [
    { file: 'times-new-roman.ttf', weight: 400 },
    { file: 'times-new-roman-bold.ttf', weight: 700 },
  ], 'Times New Roman'),

  font('Comic Relief', 'Sans serif', [{ file: 'ComicRelief-Regular.ttf' }]),
  font('Humanist', 'Sans serif', [{ file: 'Humanist.ttf' }]),
  font('Josefin Sans', 'Sans serif', [
    { file: 'JosefinSans-Thin.ttf', weight: 100 },
    { file: 'JosefinSans-ThinItalic.ttf', weight: 100, style: 'italic' },
    { file: 'JosefinSans-Light.ttf', weight: 300 },
    { file: 'JosefinSans-LightItalic.ttf', weight: 300, style: 'italic' },
    { file: 'JosefinSans-Regular.ttf', weight: 400 },
    { file: 'JosefinSans-Italic.ttf', weight: 400, style: 'italic' },
    { file: 'JosefinSans-SemiBold.ttf', weight: 600 },
    { file: 'JosefinSans-SemiBoldItalic.ttf', weight: 600, style: 'italic' },
    { file: 'JosefinSans-Bold.ttf', weight: 700 },
    { file: 'JosefinSans-BoldItalic.ttf', weight: 700, style: 'italic' },
  ]),
  font('Montserrat', 'Sans serif', [
    { file: 'Montserrat-Regular.ttf', weight: 400 },
    { file: 'Montserrat-Bold.ttf', weight: 700 },
  ]),
  font('Raleway', 'Sans serif', [
    { file: 'Raleway-Thin.ttf', weight: 100 },
    { file: 'Raleway-ExtraLight.ttf', weight: 200 },
    { file: 'Raleway-Light.ttf', weight: 300 },
    { file: 'Raleway-Regular.ttf', weight: 400 },
    { file: 'Raleway-Medium.ttf', weight: 500 },
    { file: 'Raleway-SemiBold.ttf', weight: 600 },
    { file: 'Raleway-Bold.ttf', weight: 700 },
    { file: 'Raleway-ExtraBold.ttf', weight: 800 },
    { file: 'Raleway-Heavy.ttf', weight: 900 },
  ]),
  font('Roboto', 'Sans serif', [
    { file: 'Roboto/roboto-light.ttf', weight: 300 },
    { file: 'Roboto/roboto-regular.ttf', weight: 400 },
  ]),
  font('Vonique 64', 'Sans serif', [
    { file: 'Vonique 64.ttf', weight: 400 },
    { file: 'Vonique 64 Italic.ttf', weight: 400, style: 'italic' },
    { file: 'Vonique 64 Bold.ttf', weight: 700 },
    { file: 'Vonique 64 Bold Italic.ttf', weight: 700, style: 'italic' },
  ]),

  font('Alex Brush', 'Handwriting', [{ file: 'AlexBrush-Regular.ttf' }]),
  font('Ballpoint', 'Handwriting', [{ file: 'Ballpoint.ttf' }]),
  font('Beautiful Handmade', 'Handwriting', [{ file: 'Beautiful Handmade.ttf' }]),
  font('California Sun', 'Handwriting', [
    { file: 'California sun/California sun.ttf' },
    { file: 'California sun Italic/California sun Italic.ttf', style: 'italic' },
  ]),
  font('Hello Jasmine', 'Handwriting', [{ file: 'Hello Jasmine.ttf' }]),
  font('Monday Himalayan', 'Handwriting', [{ file: 'Monday Himalayan.otf', format: 'opentype' }]),
  font('Monday Himalayan Script', 'Handwriting', [{ file: 'Monday Himalayan Script.otf', format: 'opentype' }]),
  font('Party Wedding', 'Handwriting', [{ file: 'Party Wedding.ttf' }]),
  font('Special Homemade', 'Handwriting', [{ file: 'Special Homemade.ttf' }]),

  font('Afterkilly', 'Display', [{ file: 'Afterkilly - Demo.ttf' }]),
  font('Agent Orange', 'Display', [{ file: 'AgentOrange.ttf' }]),
  font('Baby Chunky', 'Display', [{ file: 'Baby Chunky.ttf' }]),
  font('Back to School', 'Display', [{ file: 'Back to School.woff', format: 'woff' }]),
  font('Cantate Beveled', 'Display', [{ file: 'Cantate Beveled.ttf' }]),
  font('Carta Magna Line', 'Display', [{ file: 'Carta_Magna-line-demo-FFP.ttf' }]),
  font('Coco Gothic', 'Display', [{ file: 'Coco Gothic.ttf' }]),
  font('Creative Designer', 'Display', [{ file: 'Creative Desinger.otf', format: 'opentype' }]),
  font('Germania One', 'Display', [{ file: 'GermaniaOne-Regular.ttf' }]),
  font('History', 'Display', [{ file: 'History.otf', format: 'opentype' }]),
  font('Kingthings Spikeless', 'Display', [{ file: 'Kingthings Spikeless.ttf' }]),
  font('Labrit', 'Display', [{ file: 'LABRIT__.ttf' }]),
  font('New Rocker', 'Display', [{ file: 'NewRocker-Regular.ttf' }]),
  font('No More Justice', 'Display', [{ file: 'No More Justice.otf', format: 'opentype' }]),
  font('Nopia', 'Display', [{ file: 'NOPIA DEMO.ttf' }]),
  font('Primitive', 'Display', [{ file: 'Primitive.ttf' }]),
  font('Recovery', 'Display', [{ file: 'Recovery.ttf' }]),
  font('Special', 'Display', [{ file: 'Special.ttf' }]),
  font('Thempo New St', 'Display', [{ file: 'Thempo New St.ttf' }]),
  font('Happy Monogram', 'Decorative', [{ file: 'Happy Monogram.ttf' }]),
  font('Outline Designer', 'Decorative', [{ file: 'Outline Designer.ttf' }]),
  font('Proclamate Embossed', 'Decorative', [{ file: 'proclamate embossed.ttf' }]),
  font('Proclamate Heavy', 'Decorative', [{ file: 'proclamate heavy.ttf' }]),
  font('Proclamate Incised', 'Decorative', [{ file: 'proclamate incised.ttf' }]),
  font('Proclamate Light', 'Decorative', [{ file: 'proclamate light.ttf' }]),
  font('Proclamate Outline', 'Decorative', [{ file: 'proclamate Outline.ttf' }]),
  font('Proclamate Ribbon', 'Decorative', [{ file: 'proclamate ribbon.ttf' }]),
  font('Southland Bubble', 'Decorative', [{ file: 'Southland Bubble.otf', format: 'opentype' }]),
  font('Walk Da Walk One', 'Decorative', [{ file: 'WalkDaWalkOne.ttf' }]),
  font('Walk Da Walk Two', 'Decorative', [{ file: 'WalkDaWalkTwo.ttf' }]),
  font('Walk Da Walk Three', 'Decorative', [{ file: 'WalkDaWalkThree.ttf' }]),
];

function publicFontUrl(file: string) {
  return `/fonts/${file.split('/').map(encodeURIComponent).join('/')}`;
}

export const DOCX_FONT_FACE_CSS = DOCX_FONT_OPTIONS.flatMap((option) =>
  option.faces.map((face) => `
@font-face {
  font-family: "${option.family}";
  src: url("${publicFontUrl(face.file)}") format("${face.format || 'truetype'}");
  font-style: ${face.style || 'normal'};
  font-weight: ${face.weight || 400};
  font-display: swap;
}`),
).join('\n');

export function getDocXFontOption(family: string) {
  return DOCX_FONT_OPTIONS.find((option) => option.family === family);
}

function quoteFontFamily(family: string) {
  return `"${family.replaceAll('"', '\\"')}"`;
}

export async function ensureDocXTemplateFontsLoaded(template: CustomPhotoTemplate) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const requests = new Set<string>();
  template.pages.forEach((page) => {
    page.layers.forEach((layer) => {
      if (layer.kind === 'text' && !layer.hidden) {
        requests.add(`${layer.fontStyle || 'normal'} ${layer.fontWeight || 400} 48px ${quoteFontFamily(layer.fontFamily || 'Arial')}`);
      }
    });
  });
  await Promise.allSettled(Array.from(requests, (request) => document.fonts.load(request)));
  await document.fonts.ready;
}
