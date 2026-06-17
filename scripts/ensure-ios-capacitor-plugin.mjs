import fs from 'node:fs';
import path from 'node:path';

const configPath = path.resolve('ios/App/App/capacitor.config.json');
const pluginClass = 'App.StripeTapToPayPlugin';

if (!fs.existsSync(configPath)) {
  console.error(`[ensure-ios-capacitor-plugin] Missing config at ${configPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(raw);
const packageClassList = Array.isArray(config.packageClassList) ? config.packageClassList : [];

if (!packageClassList.includes(pluginClass)) {
  packageClassList.push(pluginClass);
  config.packageClassList = packageClassList;
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`[ensure-ios-capacitor-plugin] Added ${pluginClass} to packageClassList`);
} else {
  console.log(`[ensure-ios-capacitor-plugin] ${pluginClass} already present`);
}
