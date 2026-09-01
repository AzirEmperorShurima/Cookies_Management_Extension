import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const filesToFix = ['rules_easylist.json', 'rules_easylist_1.json', 'rules_easylist_2.json'];

filesToFix.forEach(filename => {
    const filePath = path.join(ROOT_DIR, filename);
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    console.log(`Processing ${filename}...`);
    try {
        let rules = JSON.parse(content);
        let modified = false;
        rules.forEach(rule => {
            if (rule.condition && rule.condition.urlFilter) {
                const filter = rule.condition.urlFilter;
                if (filter === '||jwpcdn.com^' || filter === '||jwplayer.com^' || filter === '||entitlements.jwplayer.com^') {
                    if (rule.action.type === 'block') {
                        rule.action.type = 'allow';
                        modified = true;
                        console.log(`Updated rule ${rule.id} (${filter}) to 'allow'`);
                    }
                }
            }
        });
        
        if (modified) {
            fs.writeFileSync(filePath, JSON.stringify(rules, null, 2));
            console.log(`Saved ${filename}`);
        } else {
            console.log(`No changes needed for ${filename}`);
        }
    } catch(e) {
        console.error(`Error processing ${filename}:`, e);
    }
});
