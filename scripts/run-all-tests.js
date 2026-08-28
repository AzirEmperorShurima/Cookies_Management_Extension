const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testsDir = path.join(__dirname, '..', 'tests');
const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js'));

console.log(`\n🚀 Running ${files.length} Thanus Unit Test Suites...\n${'='.repeat(60)}`);

let passed = 0;
let failed = 0;

for (const file of files) {
    const fullPath = path.join(testsDir, file);
    try {
        console.log(`\n▶ Suite: ${file}`);
        execSync(`node "${fullPath}"`, { stdio: 'inherit' });
        passed++;
    } catch (e) {
        console.error(`❌ Suite Failed: ${file}`);
        failed++;
    }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`📊 Test Results: ${passed} passed, ${failed} failed out of ${files.length} suites.`);

if (failed > 0) {
    process.exit(1);
} else {
    console.log(`✨ All test suites passed with 100% success!\n`);
}
