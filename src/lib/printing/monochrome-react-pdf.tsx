import React from 'react';
import { Page as PDFPage, Text as PDFText, View as PDFView, Image as PDFImage, type TextProps } from '@react-pdf/renderer';
import { monochromeStyle } from './monochrome';
import { monochromeImage } from './monochrome-image';

// These primitives are imported only by list/statement generators, never report cards.
export { Document, StyleSheet, Font, pdf, PDFDownloadLink, Link } from '@react-pdf/renderer';
export function Page(props: React.ComponentProps<typeof PDFPage>) {
  const style = monochromeStyle(props.style || {});
  return <PDFPage {...props} style={[{ backgroundColor: '#ffffff', color: '#000000' }, ...(Array.isArray(style) ? style : [style])]} />;
}
export function Text(props: React.PropsWithChildren<TextProps>) {
  return <PDFText {...props} style={monochromeStyle(props.style)} />;
}
export function View(props: React.ComponentProps<typeof PDFView>) {
  return <PDFView {...props} style={monochromeStyle(props.style)} />;
}
export function Image(props: React.ComponentProps<typeof PDFImage>) {
  const source = 'src' in props ? props.src : props.source;
  const converted = async () => {
    const resolved = await (typeof source === 'function' ? source() : source);
    if (!resolved) return undefined;
    if (typeof resolved === 'string' || resolved instanceof Blob) return monochromeImage(resolved);
    if ('uri' in resolved) {
      const response = await fetch(resolved.uri, resolved);
      if (!response.ok) throw new Error('Could not load a document image.');
      return monochromeImage(await response.blob());
    }
    const data = 'data' in resolved ? resolved.data : resolved;
    return monochromeImage(new Blob([new Uint8Array(data)]));
  };
  return <PDFImage {...props} source={undefined} src={converted} style={monochromeStyle(props.style)} />;
}

/** Only pupil photos may opt into colour. Logos and other form artwork stay monochrome. */
export function Photo({ color = false, ...props }: React.ComponentProps<typeof PDFImage> & { color?: boolean }) {
  return color ? <PDFImage {...props} style={monochromeStyle(props.style)} /> : <Image {...props} />;
}
