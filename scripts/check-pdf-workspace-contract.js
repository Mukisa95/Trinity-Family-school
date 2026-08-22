const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const requireText = (source, expected, label) => {
  if (!source.includes(expected)) {
    throw new Error(`PDF workspace contract failed: ${label}`);
  }
};

const layout = read('src/app/layout.tsx');
const context = read('src/lib/pdf/pdf-workspace-context.tsx');
const workspace = read('src/components/pdf/pdf-workspace.tsx');
const documentViewer = read('src/components/pdf/pdf-document-viewer.tsx');
const viewerHook = read('src/lib/hooks/use-pdf-viewer.tsx');
const legacyViewer = read('src/components/pdf/pdf-viewer.tsx');
const packageJson = read('package.json');
const collectSourceFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  if (entry.isDirectory()) return collectSourceFiles(target);
  return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
});
const sourceFiles = collectSourceFiles(path.join(root, 'src'));
const sourceText = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const workspaceLaunchCount = sourceText.match(/(?:\.runPDFJob\(|pdfViewer\.openPDF\()/g)?.length || 0;

requireText(layout, '<PDFWorkspaceProvider>', 'the provider must live in the persistent root layout');
requireText(layout, '<PDFWorkspace />', 'the workspace window must be mounted globally');
requireText(context, 'documents: PDFWorkspaceDocument[]', 'the workspace must support multiple documents');
requireText(context, 'await waitForWorkspacePaint()', 'the loading window must paint before rendering starts');
requireText(context, 'setMode("minimized")', 'the workspace must support minimized background operation');
requireText(context, 'controllersRef.current.get(id)?.abort()', 'closing a generating tab must cancel or ignore its job');
requireText(workspace, 'role="tablist"', 'open documents must be exposed as accessible tabs');
requireText(workspace, 'fixed bottom-3 right-3', 'the minimized workspace must dock at the bottom-right');
requireText(workspace, 'Generation continues if this window is minimized', 'background-generation behavior must be communicated');
requireText(workspace, 'previousStatuses.get(document.id) === "generating"', 'completion notifications must be driven by a real generating-to-ready transition');
requireText(workspace, 'mode === "minimized" && newlyCompleted.length > 0', 'completion notifications must only appear while minimized');
requireText(workspace, 'Your PDF is ready', 'the minimized workspace must tell the user when generation completes');
requireText(workspace, 'View PDF', 'the completion notification must restore the completed PDF');
requireText(workspace, '<PDFDocumentViewer', 'ready documents must use the application-owned PDF viewer');
requireText(documentViewer, 'await import("pdfjs-dist")', 'the viewer must render PDFs through PDF.js');
requireText(documentViewer, 'aria-label="Page thumbnails"', 'the viewer must provide page thumbnail navigation');
requireText(documentViewer, 'aria-label="Zoom out"', 'the viewer must provide zoom controls');
requireText(documentViewer, 'aria-label="Fit page width"', 'the viewer must support fit-width mode');
requireText(documentViewer, 'aria-label="Fit whole page"', 'the viewer must support fit-page mode');
requireText(documentViewer, 'placeholder="Search this PDF"', 'the viewer must provide full-document search');
requireText(documentViewer, 'Page {pageNumber} of {totalPages}', 'the viewer must expose the current and total page count');
requireText(documentViewer, 'aria-label="Rotate page clockwise"', 'the viewer must support page rotation');
requireText(documentViewer, 'rounded-full', 'the modern viewer must use rounded controls');
requireText(packageJson, '"pdfjs-dist"', 'the PDF.js rendering dependency must be declared');
if (/\bdark:|bg-slate-9\d\d/.test(`${workspace}\n${documentViewer}`)) {
  throw new Error('PDF workspace contract failed: the redesigned PDF workspace must remain light');
}
requireText(viewerHook, 'workspace.runPDFJob', 'legacy React-PDF callers must enter the global job pipeline');
requireText(viewerHook, 'updateProgress(8, \'Loading PDF renderer…\')', 'the preview must open before React-PDF rendering');
requireText(legacyViewer, 'if (workspace) return null', 'legacy page viewers must not duplicate the global workspace');

if (workspaceLaunchCount < 40) {
  throw new Error(`PDF workspace contract failed: expected at least 40 consolidated launch paths, found ${workspaceLaunchCount}`);
}
if (/\bdoc\.save\s*\(/.test(sourceText)) {
  throw new Error('PDF workspace contract failed: PDF renderers must return blobs instead of saving directly');
}

console.log(`PDF_WORKSPACE_CONTRACT_OK ${workspaceLaunchCount}_LAUNCH_PATHS`);
