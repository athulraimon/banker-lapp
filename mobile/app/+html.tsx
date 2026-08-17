import React from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// The HTML shell for every web page. This file is server-rendered at export
// time only — it never runs in the browser, so it cannot use hooks or state.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* viewport-fit=cover lets the app paint into the iPhone safe areas so
            it looks native rather than letterboxed; safe-area-context still
            keeps content clear of the notch and home indicator. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />

        <title>Banker Lapp</title>
        <meta name="description" content="Formula 1 Private Predictions Championship" />

        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0d0c09" />

        {/* iOS ignores the web manifest's display mode. These three tags are
            what actually make "Add to Home Screen" launch without Safari's
            address bar, which is the whole point of shipping a PWA for iPhone. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Banker Lapp" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        <link rel="icon" href="/favicon.png" />

        {/* Disables body scrolling on web so ScrollViews behave as on native. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: baseStyle }} />
        <script dangerouslySetInnerHTML={{ __html: registerServiceWorker }} />
        <script dangerouslySetInnerHTML={{ __html: dismissSplash }} />
      </head>
      <body>
        {/* Launch screen for the gap between the page painting and the JS bundle
            running. Without it the app shows flat carbon for as long as the
            bundle takes to parse, which on a cold mobile load reads as a hang.
            It is the same artwork PixelCarLoader draws, so when React takes over
            the picture does not change — only who is animating it. */}
        <div id="bl-splash" aria-hidden="true">
          <img src="/icons/loading-car.gif" alt="" width={224} height={68} />
        </div>
        {children}
      </body>
    </html>
  );
}

// Painting the background here, not just in React, avoids a white flash between
// the page loading and the first render — very visible on a dark app.
const baseStyle = `
html, body, #root {
  background-color: #0d0c09;
  height: 100%;
}
body {
  margin: 0;
  overscroll-behavior-y: none;
  -webkit-tap-highlight-color: transparent;
}
#bl-splash {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0d0c09;
  transition: opacity 260ms ease-out;
}
#bl-splash img {
  /* Nearest-neighbour scaling: smoothing pixel art is the one thing that
     destroys it, and browsers smooth by default. */
  image-rendering: pixelated;
  width: 224px;
  height: 68px;
}
#bl-splash.bl-done { opacity: 0; pointer-events: none; }
`;

// Clears the launch screen as soon as React has rendered anything into #root.
// The timeout is a backstop: if the bundle fails to boot, the user should end up
// looking at whatever error the page can show, not at a car driving forever.
const dismissSplash = `
document.addEventListener('DOMContentLoaded', function () {
  var splash = document.getElementById('bl-splash');
  var root = document.getElementById('root');
  if (!splash) return;
  var removed = false;
  function done() {
    if (removed) return;
    removed = true;
    splash.classList.add('bl-done');
    setTimeout(function () { splash.remove(); }, 300);
  }
  if (!root) return done();
  if (root.childElementCount > 0) return done();
  var observer = new MutationObserver(function () {
    if (root.childElementCount > 0) { observer.disconnect(); done(); }
  });
  observer.observe(root, { childList: true });
  setTimeout(done, 8000);
});
`;

const registerServiceWorker = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      // Registration fails on http:// origins and in private windows. The app
      // works fine without it; only offline launch and install are lost.
    });
  });
}
`;
