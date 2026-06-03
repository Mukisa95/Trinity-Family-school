const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        if (fs.statSync(file).isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx')) results.push(file);
        }
    });
    return results;
}

const files = walk(path.join(__dirname, 'src/app'));
let fixedFiles = [];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    if (content.includes('<SmartBackButton')) {
        let originalContent = content;
        
        // Remove ANY existing import to clean up bad ones
        content = content.replace(/^[ \t]*import[ \t]+\{[ \t]*SmartBackButton[ \t]*\}[ \t]+from[ \t]+["']@\/components\/common\/SmartBackButton["'];?[ \t]*\r?\n?/gm, '');
        
        // Find the last import statement to append our import safely after all other imports.
        // We look for lines starting with 'import ' that end with ';' or '"' or '''.
        // To be absolutely safe and avoid injecting inside a multiline block, 
        // we'll find the highest index of a line that STARTS with 'import ' but DOES NOT end with a comma,
        // OR simply put it at the very beginning of the first import block.
        
        if (!content.includes('import { SmartBackButton }')) {
            // Find the position to insert. Right after "use client";
            if (content.includes('"use client";')) {
                content = content.replace(/"use client";\r?\n/, '"use client";\nimport { SmartBackButton } from "@/components/common/SmartBackButton";\n');
            } else if (content.includes("'use client';")) {
                content = content.replace(/'use client';\r?\n/, "'use client';\nimport { SmartBackButton } from \"@/components/common/SmartBackButton\";\n");
            } else {
                // If no use client, put it at the top
                content = 'import { SmartBackButton } from "@/components/common/SmartBackButton";\n' + content;
            }
        }
        
        if (content !== originalContent) {
            fs.writeFileSync(file, content);
            fixedFiles.push(file);
        }
    }
});

console.log('Fixed files:\\n' + fixedFiles.join('\\n'));
