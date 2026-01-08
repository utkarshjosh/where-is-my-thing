// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package exports for Expo SDK 53+
config.resolver.unstable_enablePackageExports = true;

// Workaround for zustand's ESM bundle using import.meta (Metro doesn't support it)
// Force Metro to resolve the CommonJS version of zustand only
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'zustand' || moduleName.startsWith('zustand/')) {
        // Resolve to its CommonJS entry (fallback to main/index.js)
        return {
            type: 'sourceFile',
            // require.resolve will pick up the CJS entry (index.js) since "exports" is bypassed
            filePath: require.resolve(moduleName),
        };
    }

    return context.resolveRequest(context, moduleName, platform);
};

config.resolver.sourceExts.push('mjs');
config.resolver.sourceExts.push('cjs');

module.exports = config;
