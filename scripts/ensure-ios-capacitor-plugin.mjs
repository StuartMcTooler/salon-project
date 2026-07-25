import fs from 'node:fs';
import path from 'node:path';

const configPath = path.resolve('ios/App/App/capacitor.config.json');
const pluginClass = 'App.StripeTapToPayPlugin';
const enableIosTapToPayPlugin = process.env.ENABLE_IOS_TAP_TO_PAY_PLUGIN === 'true';

if (!fs.existsSync(configPath)) {
  console.error(`[ensure-ios-capacitor-plugin] Missing config at ${configPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(raw);
const packageClassList = Array.isArray(config.packageClassList) ? config.packageClassList : [];

if (!enableIosTapToPayPlugin) {
  config.packageClassList = packageClassList.filter((className) => className !== pluginClass);
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`[ensure-ios-capacitor-plugin] Skipped ${pluginClass}; set ENABLE_IOS_TAP_TO_PAY_PLUGIN=true to include it`);
} else if (!packageClassList.includes(pluginClass)) {
  packageClassList.push(pluginClass);
  config.packageClassList = packageClassList;
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`[ensure-ios-capacitor-plugin] Added ${pluginClass} to packageClassList`);
} else {
  console.log(`[ensure-ios-capacitor-plugin] ${pluginClass} already present`);
}
