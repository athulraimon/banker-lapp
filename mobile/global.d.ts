// Lets TypeScript accept `import './global.css'`. Expo/Metro turns CSS imports
// into a web stylesheet and a no-op on native.
declare module '*.css';
