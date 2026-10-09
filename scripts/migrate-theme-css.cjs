/* Preset-aware CSS and SVG decorations. PDF/document templates are excluded. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const colours = require('tailwindcss/colors');
const root = path.resolve(__dirname,'..');
const families = {blue:'brand',indigo:'brand-alt',purple:'brand-secondary',violet:'brand-secondary-alt'};
const known = new Map(Object.entries(families).flatMap(([hue,family])=>Object.entries(colours[hue]).map(([shade,hex])=>[hex.toLowerCase(),{family,shade}])));
function value(hex, role='fill') {
  const found=known.get(hex.toLowerCase()); if(!found)return hex;
  const suffix=role==='ink'?'-ink':role==='surface'?'-surface':'';
  return `rgb(var(--${found.family}${suffix}-${found.shade}))`;
}
function css(text) {
  return text.replace(/(\b(?:color|fill|stroke|background(?:-color)?|border(?:-color)?|box-shadow)\s*:\s*)([^;}]+)/g,(_,property,body)=>property+body.replace(/#[0-9a-f]{6}\b/gi,hex=>value(hex,/^color/.test(property)?'ink':/^background/.test(property)?'surface':'fill')))
    .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/g,(original,r,g,b,a)=>{
      const hex='#'+[r,g,b].map(n=>Number(n).toString(16).padStart(2,'0')).join('');
      const found=known.get(hex);return found?`rgb(var(--${found.family}-${found.shade})${a?' / '+a:''})`:original;
    });
}
let count=0;
function write(file, text, updated) {if(text===updated)return; fs.writeFileSync(file,updated);count++;}
for(const name of ['globals.css','theme.css']){const file=path.join(root,'src/app',name),text=fs.readFileSync(file,'utf8');write(file,text,css(text));}
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){if(!['api','reports','docx','pdf'].includes(entry.name))walk(file);continue;}
  if(!entry.name.endsWith('.tsx')||/pdf|print/i.test(entry.name))continue;
  const text=fs.readFileSync(file,'utf8'),source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edits=[];
  function visit(node){
   if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){
    const original=node.getText(source); let updated=original;
    if(ts.isJsxAttribute(node.parent)&&['fill','stroke','stopColor'].includes(node.parent.name.text))updated=original.replace(/#[0-9a-f]{6}\b/gi,hex=>value(hex));
    if(ts.isJsxExpression(node.parent)&&ts.isJsxElement(node.parent.parent)&&node.parent.parent.openingElement.tagName.getText(source)==='style')updated=css(original);
    if(ts.isJsxAttribute(node.parent)&&node.parent.name.text==='className')updated=original.replace(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/g,(raw,r,g,b,a)=>{
      const hex='#'+[r,g,b].map(n=>Number(n).toString(16).padStart(2,'0')).join('');const f=known.get(hex);return f?`rgb(var(--${f.family}-${f.shade})/${a})`:raw;
    });
    if(updated!==original)edits.push({start:node.getStart(source),end:node.end,updated});
   }
   ts.forEachChild(node,visit);
  }
  visit(source);let updated=text;for(const e of edits.sort((a,b)=>b.start-a.start))updated=updated.slice(0,e.start)+e.updated+updated.slice(e.end);
  if(ts.createSourceFile(file,updated,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length)throw new Error(`Invalid source ${file}`);
  write(file,text,updated);
 }
}
walk(path.join(root,'src/app'));walk(path.join(root,'src/components'));
console.log(`THEME_DECORATIONS_MIGRATED ${count} CSS/UI files; known brand shades only.`);
