// PixiJS ships an eval-free polyfill module (no published types). Importing it
// runs selfInstall(), replacing Pixi's eval-based shader/uniform sync — required
// under the desktop Electron Content-Security-Policy (unsafe-eval blocked).
declare module "pixi.js/unsafe-eval";
