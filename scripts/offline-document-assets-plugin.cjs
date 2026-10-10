// Publish immutable document chunks for native offline caching, without running
// their JavaScript during startup. Next.js still owns ordinary route splitting.
class OfflineDocumentAssetsPlugin {
  constructor(webpack) { this.webpack = webpack; }
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('OfflineDocumentAssets', compilation => {
      compilation.hooks.processAssets.tap({ name: 'OfflineDocumentAssets', stage: this.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT }, () => {
        const assets = new Set();
        for (const chunk of compilation.chunks) {
          const modules = [...compilation.chunkGraph.getChunkModulesIterable(chunk)];
          const documentChunk = modules.some(module => {
            const source = (module.resource || module.identifier()).replace(/\\/g, '/');
            return /\/components\/pdf\/(?:pdf-workspace|pdf-document-viewer)\.tsx|\/node_modules\/(?:pdfjs-dist|jspdf|html2canvas|pdf-lib|@react-pdf)\//.test(source);
          });
          if (!documentChunk) continue;
          for (const group of chunk.groupsIterable) {
            if (group.isInitial()) continue; // Never prefetch unrelated application pages.
            for (const file of group.getFiles()) if (file.startsWith('static/')) assets.add(`/_next/${file}`);
          }
          for (const file of chunk.auxiliaryFiles) if (file.startsWith('static/')) assets.add(`/_next/${file}`);
        }
        compilation.emitAsset('static/offline-document-assets.json', new this.webpack.sources.RawSource(JSON.stringify([...assets].sort())));
      });
    });
  }
}
module.exports = OfflineDocumentAssetsPlugin;
