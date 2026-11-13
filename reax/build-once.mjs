import { build, loadConfigFromFile } from 'vite';

// Share all production entries with the normal watcher; verification can direct
// outputs to a temporary folder without rewriting unrelated theme assets.
const { config } = await loadConfigFromFile({ command: 'build', mode: 'production' });
config.build.watch = null;
if (process.argv[2]) config.build.rollupOptions.output.dir = process.argv[2];
await build({ ...config, configFile: false });
