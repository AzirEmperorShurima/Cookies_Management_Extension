const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const FILTER_SOURCES = [
  { id: 'easylist', url: 'https://easylist.to/easylist/easylist.txt' },
  { id: 'easyprivacy', url: 'https://easylist.to/easylist/easyprivacy.txt' }
];

const DYNAMIC_RULE_ID_OFFSET = 100000;
const ROOT_DIR = path.join(__dirname, '..');

async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseResourceTypeOptions(optionsStr) {
  const map = {
    script: 'script', image: 'image', stylesheet: 'stylesheet',
    xmlhttprequest: 'xmlhttprequest', subdocument: 'sub_frame', font: 'font'
  };
  const types = [];
  const options = optionsStr.replace(/^\$/, '').split(',');
  for (const opt of options) {
    if (map[opt]) types.push(map[opt]);
  }
  return types;
}

const EXCLUDED_DOMAINS = ['jwpcdn.com', 'jwplayer.com', 'entitlements.jwplayer.com'];

function convertLineToDNRRule(line, id) {
  if (line.includes('##') || line.includes('#@#')) return null;

  const isException = line.startsWith('@@');
  const pattern = isException ? line.slice(2) : line;

  const domainMatch = pattern.match(/^\|\|([a-zA-Z0-9.-]+)\^?(\$.*)?$/);
  if (!domainMatch) return null;

  const domain = domainMatch[1];
  const options = domainMatch[2] || '';

  if (EXCLUDED_DOMAINS.includes(domain)) {
      return null;
  }

  const resourceTypes = parseResourceTypeOptions(options);

  return {
    id,
    priority: isException ? 2 : 1,
    action: { type: isException ? 'allow' : 'block' },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: resourceTypes.length ? resourceTypes : undefined
    }
  };
}

function parseFilterListToDNRRules(rawText, idOffset) {
  const lines = rawText.split('\n').filter((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('!') && !trimmed.startsWith('[');
  });

  const rules = [];
  let id = idOffset;

  for (const line of lines) {
    const rule = convertLineToDNRRule(line.trim(), id);
    if (rule) {
      rules.push(rule);
      id++;
    }
  }
  return rules;
}

function updateSpoofSeed() {
  const spoofInjectPath = path.join(ROOT_DIR, 'modules', 'spoof-inject.js');
  if (fs.existsSync(spoofInjectPath)) {
    let content = fs.readFileSync(spoofInjectPath, 'utf8');
    const newSeed = 'DEFAULT_FALLBACK_SEED_' + crypto.randomBytes(8).toString('hex').toUpperCase();
    content = content.replace(/DEFAULT_FALLBACK_SEED_[A-Z0-9]+/, newSeed);
    fs.writeFileSync(spoofInjectPath, content);
    console.log(`Updated activeNoise seed in spoof-inject.js to: ${newSeed}`);
  } else {
    console.warn('modules/spoof-inject.js not found, skipping seed update.');
  }
}

async function main() {
  updateSpoofSeed();

  for (let i = 0; i < FILTER_SOURCES.length; i++) {
    const source = FILTER_SOURCES[i];
    console.log(`Downloading ${source.id}...`);
    try {
      const rawText = await downloadFile(source.url);
      const idOffset = DYNAMIC_RULE_ID_OFFSET + (i * 100000);
      const rules = parseFilterListToDNRRules(rawText, idOffset);

      const outputPath = path.join(ROOT_DIR, `rules_${source.id}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(rules));
      console.log(`Generated ${rules.length} rules for ${source.id}`);
    } catch (e) {
      console.error(`Error processing ${source.id}:`, e);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseFilterListToDNRRules,
  convertLineToDNRRule
};
