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
        <meta name="theme-color" content="#0b0c10" />

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
      </head>
      <body>{children}</body>
    </html>
  );
}

// Painting the background here, not just in React, avoids a white flash between
// the page loading and the first render — very visible on a dark app.
const baseStyle = `
html, body, #root {
  background-color: #0b0c10;
  height: 100%;
}
body {
  margin: 0;
  overscroll-behavior-y: none;
  -webkit-tap-highlight-color: transparent;
}
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
