import { loadConfig } from './config.js';
import { attachLiveWsUpgrade, createServer } from './createServer.js';

const config = loadConfig();
const server = createServer(config);
attachLiveWsUpgrade(server, config);

server.listen(config.port, '0.0.0.0', () => {
  console.log(`API server listening on port ${config.port}`);
});
