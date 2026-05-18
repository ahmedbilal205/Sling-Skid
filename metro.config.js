const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const reactThreeFiberEntry = path.resolve(
  __dirname,
  'node_modules/@react-three/fiber/dist/react-three-fiber.cjs.js'
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return context.resolveRequest(context, 'three/webgpu', platform);
  }

  if (platform !== 'web' && moduleName === '@react-three/fiber') {
    return {
      filePath: reactThreeFiberEntry,
      type: 'sourceFile',
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
