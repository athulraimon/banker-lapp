export const isTokenExpired = (token: string): boolean => {
  try {
    const [, payload] = token.split('.');
    if (!payload) return true;

    // Replace base64url characters and add padding
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) {
      base64 += '='.repeat(4 - pad);
    }

    // Decode base64 string to binary string
    const decodedPayload = atob(base64);

    // Parse JSON
    const payloadJson = JSON.parse(decodedPayload);

    // Check expiration
    const exp = payloadJson.exp;
    const now = Math.floor(Date.now() / 1000);
    return now >= exp;
  } catch (e) {
    // If any step fails, treat as expired
    return true;
  }
};