/* Exercise the actual navigation and permission handlers without school data. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function source(file){return ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);}
function find(file,predicate){const tree=source(file);let found;function visit(node){if(!found&&predicate(node,tree))found=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);assert.ok(found,`Missing handler in ${file}`);return found;}
const compile=code=>ts.transpileModule(code,{compilerOptions:{module:1,target:ts.ScriptTarget.ES2022}}).outputText;
const permission=find('src/components/layout/sidebar-nav.tsx',n=>ts.isFunctionDeclaration(n)&&n.name?.text==='checkItemPermission');
let checkedOther=0;
const checkFor=user=>new Function('user','isDevControlPath','GranularPermissionService','getRoutePagePermission',compile(permission)+';return checkItemPermission;')(user,p=>p.startsWith('/dev-control'),{canAccessInventoryWorkspace:()=>false,canAccessPage:()=>false},()=>{checkedOther++;return undefined;});
assert.equal(checkFor(null)('/settings/look-and-feel'),false);
for(const role of ['Admin','Teacher','Staff','Parent'])assert.equal(checkFor({role})('/settings/look-and-feel'),true);
assert.equal(checkedOther,0,'Personal settings must not query administrative grants');
assert.equal(checkFor({role:'Teacher'})('/settings/look-and-feel/other'),false,'The exception only applies to the personal settings page');
assert.equal(checkFor({role:'Teacher'})('/dev-control/deployment'),false,'Personal settings must not open administration');
const view=find('src/components/parent/parent-layout.tsx',n=>ts.isVariableDeclaration(n)&&n.name.getText()==='handleViewChange');
const pupil=find('src/components/parent/parent-layout.tsx',n=>ts.isVariableDeclaration(n)&&n.name.getText()==='handlePupilChange');
const routeEffect=find('src/components/parent/parent-layout.tsx',(n,s)=>ts.isCallExpression(n)&&n.expression.getText(s)==='useEffect'&&n.getText(s).includes("pathname === '/parent'"));
const changes=[],pushes=[];
const handlers=new Function('pathname','router','setCurrentView','setCurrentPupilId',compile(`const ${view};const ${pupil};return {handleViewChange,handlePupilChange};`))('/parent/settings/look-and-feel',{push:p=>pushes.push(p)},v=>changes.push(['view',v]),v=>changes.push(['pupil',v]));
handlers.handleViewChange('home');assert.equal(pushes.pop(),'/parent?view=home');
handlers.handleViewChange('dashboard');assert.equal(pushes.pop(),'/parent');
handlers.handlePupilChange('example-pupil');assert.equal(pushes.pop(),'/parent');assert.deepEqual(changes.at(-2),['pupil','example-pupil']);assert.deepEqual(changes.at(-1),['view','dashboard']);
const runEffect=compile(routeEffect);
new Function('useEffect','pathname','searchParams','setCurrentView',runEffect)(fn=>fn(),'/parent',new URLSearchParams('view=home'),v=>changes.push(['view',v]));assert.deepEqual(changes.at(-1),['view','home'],'Home navigation must remain Home after the route changes');
new Function('useEffect','pathname','searchParams','setCurrentView',runEffect)(fn=>fn(),'/parent',new URLSearchParams(),v=>changes.push(['view',v]));assert.deepEqual(changes.at(-1),['view','dashboard']);
for(const route of ['settings/look-and-feel','parent/settings/look-and-feel'])assert.match(fs.readFileSync(path.join(root,'src/app',route,'page.tsx'),'utf8'),/return <LookAndFeelSettings\s*\/>/);
console.log('LOOK_AND_FEEL_NAVIGATION_OK: authenticated personal access, administrative isolation, shared staff/parent settings and parent Home/pupil navigation out of settings.');
