export type GoogleAuthResult =
  | { status: 'success'; idToken: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const NONCE_KEY = 'banker_lapp_google_nonce';
const STATE_KEY = 'banker_lapp_google_state';

// Web sign-in uses the OpenID Connect implicit flow with a full-page redirect
// rather than Google's popup/One Tap widget.
//
// The reason is iOS: when the PWA is launched from the home screen it runs in a
// standalone window where popups and cross-origin iframes are unreliable and
// often silently blocked. A top-level redirect always works, in the browser and
// in the installed app alike. We ask only for `id_token`, which is exactly what
// the Go backend already verifies for the native flow — no backend change.

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// The redirect URI must match an Authorized redirect URI on the Web OAuth
// client exactly. We always return to the site root so a single registered URI
// covers every route.
function redirectUri(): string {
  return `${window.location.origin}/`;
}

export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  const clientId = process.env.EXPO_PUBLIC_WEB_CLIENT_ID;
  if (!clientId) {
    return { status: 'error', message: 'EXPO_PUBLIC_WEB_CLIENT_ID is not set for this build.' };
  }

  const nonce = randomToken();
  const state = randomToken();

  // sessionStorage is right here: these are single-redirect values, and scoping
  // them to the tab stops a stale nonce from a previous attempt being reused.
  try {
    sessionStorage.setItem(NONCE_KEY, nonce);
    sessionStorage.setItem(STATE_KEY, state);
  } catch {
    return { status: 'error', message: 'Browser storage is blocked, so sign-in cannot continue.' };
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce,
    state,
    prompt: 'select_account',
  });

  window.location.assign(`${AUTH_ENDPOINT}?${params.toString()}`);

  // Navigation is underway; this promise never settles.
  return new Promise<GoogleAuthResult>(() => {});
}

// Google returns the token in the URL fragment, which is never sent to a server,
// so reading it client-side is the intended mechanism.
//
// This is captured at module load — deliberately, and before React renders.
// The redirect lands on "/", the router immediately replaces that with the login
// route, and a client-side navigation drops the fragment. Reading it inside a
// component effect would therefore be a race we would sometimes lose. Grabbing
// it here, once, removes the race entirely.
const pendingRedirect: GoogleAuthResult | null = captureRedirectResult();

function captureRedirectResult(): GoogleAuthResult | null {
  if (typeof window === 'undefined' || !window.location.hash) return null;

  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const idToken = fragment.get('id_token');
  const error = fragment.get('error');
  const returnedState = fragment.get('state');

  // Not our fragment — leave it alone (it may be an app route anchor).
  if (!idToken && !error) return null;

  let expectedState: string | null = null;
  try {
    expectedState = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(NONCE_KEY);
  } catch {
    // Storage unavailable; handled by the state check below.
  }

  // Strip the fragment so a refresh doesn't replay the token and so it never
  // lingers in the address bar or browser history.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);

  if (error) {
    return error === 'access_denied'
      ? { status: 'cancelled' }
      : { status: 'error', message: `Google returned "${error}".` };
  }
  if (!returnedState || returnedState !== expectedState) {
    return { status: 'error', message: 'Sign-in response did not match this session. Please try again.' };
  }

  return { status: 'success', idToken: idToken as string };
}

let consumed = false;

// Returns the captured result exactly once, so React's development double-mount
// of effects cannot submit the same ID token to the backend twice.
export async function completeGoogleRedirect(): Promise<GoogleAuthResult | null> {
  if (consumed) return null;
  consumed = true;
  return pendingRedirect;
}
