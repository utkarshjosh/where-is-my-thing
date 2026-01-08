import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Warm up the browser for OAuth flows on Android.
 * This improves UX by reducing the time to open the auth browser.
 * Should be called at the top of OAuth sign-in components.
 */
export const useWarmUpBrowser = () => {
    useEffect(() => {
        if (Platform.OS !== 'android') return;
        void WebBrowser.warmUpAsync();
        return () => {
            void WebBrowser.coolDownAsync();
        };
    }, []);
};

// Complete any pending auth sessions when the component loads
WebBrowser.maybeCompleteAuthSession();
