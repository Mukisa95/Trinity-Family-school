/* Audit the large colour migration independently: AST structure, data literals,
   handlers and numeric values must remain unchanged outside reviewed feature files. */
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base=process.argv[2]||'HEAD';
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
const featureFiles=new Set(['src/app/layout.tsx','src/components/providers/theme-provider.tsx','src/config/nav.ts','src/components/layout/sidebar-nav.tsx','src/components/layout/sidebar-user-footer.tsx','src/components/parent/parent-sidebar.tsx','src/components/parent/parent-bottom-navigation.tsx','src/components/parent/parent-layout.tsx','src/components/pupils/PupilTableRow.tsx','src/components/ui/button.tsx']);
function canonical(text){return text
 .replace(/\b(text|bg|border|ring|from|via|to|shadow|outline|decoration|fill|stroke|divide|placeholder|caret|accent)-(blue|indigo|purple|violet|brand-secondary-alt|brand-secondary|brand-alt|brand)(?:-ink|-surface)?-(\d+)(?![\w-])/g,(_,role,hue,shade)=>`${role}-${({blue:'brand',indigo:'brand-alt',purple:'brand-secondary',violet:'brand-secondary-alt'})[hue]||hue}-${[150,350,650,750,850].includes(Number(shade))?Number(shade)-50:shade}`)
 .replace(/\btext-primary(?![\w-])/g,'text-link')
 .replace(/rgb\(var\(--brand[^)]+\)(?:\s*\/\s*[\d.]+)?\)|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)|#[0-9a-f]{6}\b/gi,'COLOUR');}
function tree(file,text){const source=ts.createSourceFile(file,text.replaceAll('\r\n','\n'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),parts=[];if(source.parseDiagnostics.length)throw Error(`Invalid TSX: ${file}`);
 function visit(node){parts.push(node.kind);if([ts.SyntaxKind.StringLiteral,ts.SyntaxKind.NoSubstitutionTemplateLiteral,ts.SyntaxKind.TemplateHead,ts.SyntaxKind.TemplateMiddle,ts.SyntaxKind.TemplateTail].includes(node.kind)){parts.push(canonical(node.getText(source)));return;}if(!node.getChildCount(source))parts.push(node.getText(source));ts.forEachChild(node,visit);}visit(source);return JSON.stringify(parts);}
let checked=0;const failures=[];
for(const file of git(['diff','--name-only',base,'--','src']).trim().split('\n').filter(Boolean)){
 if(!/\.(ts|tsx)$/.test(file)||featureFiles.has(file))continue;
 const before=git(['show',`${base}:${file}`]),after=fs.readFileSync(path.join(root,file),'utf8');
 if(tree(file,before)!==tree(file,after)){
   failures.push(file);
   if(failures.length===1){const a=JSON.parse(tree(file,before)),b=JSON.parse(tree(file,after)),i=a.findIndex((v,j)=>v!==b[j]);console.error('First differing token:',file,JSON.stringify(a.slice(i,i+4)),JSON.stringify(b.slice(i,i+4)));}
 }else checked++;
}
if(failures.length){console.error('Non-style AST change requires review:\n'+failures.join('\n'));process.exitCode=1;}
else console.log(`THEME_MIGRATION_AUDIT_OK ${checked} files: unchanged AST, handlers and data; ${featureFiles.size} separately reviewed feature files.`);
