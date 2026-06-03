const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
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
    if (content.includes('<SmartBackButton') && (!content.includes('import { SmartBackButton') && !content.includes('import SmartBackButton'))) {
        const lines = content.split('\n');
        let lastImportIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('import ')) {
                lastImportIndex = i;
            }
        }
        
        if (lastImportIndex !== -1) {
            lines.splice(lastImportIndex + 1, 0, 'import { SmartBackButton } from "@/components/common/SmartBackButton";');
            fs.writeFileSync(file, lines.join('\n'));
            fixedFiles.push(file);
        }
    }
});

console.log('Fixed files:\\n' + fixedFiles.join('\\n'));
