module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            ['transform-import-meta'], // Handle import.meta for libraries like 'ai'
            'react-native-reanimated/plugin', // Must be last
        ],
    };
};
