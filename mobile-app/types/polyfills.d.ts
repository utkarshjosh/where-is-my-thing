declare module '@ungap/structured-clone';
declare module 'react-native/Libraries/Utilities/PolyfillFunctions' {
    export function polyfillGlobal(name: string, factory: () => unknown): void;
}
declare module '@stardazed/streams-text-encoding' {
    export const TextEncoderStream: typeof globalThis.TextEncoderStream;
    export const TextDecoderStream: typeof globalThis.TextDecoderStream;
}
