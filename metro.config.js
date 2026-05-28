const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;

const webModuleAliases = {
  'react-native-maps': path.resolve(__dirname, 'src/mocks/react-native-maps.web.js'),
  'expo-sensors': path.resolve(__dirname, 'src/mocks/expo-sensors.web.js'),
  'expo-location': path.resolve(__dirname, 'src/mocks/expo-location.web.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webModuleAliases[moduleName]) {
    return {
      filePath: webModuleAliases[moduleName],
      type: 'sourceFile',
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
