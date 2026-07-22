/**
 * Telegram Mini App initData verification.
 *
 * initData is a query string: user=...&auth_date=...&hash=...
 * To verify:
 * 1. Parse query string into key=value pairs
 * 2. Remove 'hash' from the data
 * 3. Sort remaining pairs alphabetically
 * 4. Create data_check_string: "key=value\nkey2=value2\n..."
 * 5. HMAC-SHA256(data_check_string, bot_token) -> hex
 * 6. Compare with hash from initData
 * 7. Check auth_date is not older than 24 hours
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string
): { valid: boolean; user?: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string }; error?: string } {
  try {
    // Parse initData as URL query string
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    const authDate = params.get("auth_date");

    if (!hash || !authDate) {
      return { valid: false, error: "Missing hash or auth_date" };
    }

    // Check auth_date is not older than 24 hours
    const authTimestamp = parseInt(authDate, 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authTimestamp > 86400) {
      return { valid: false, error: "InitData expired (>24 hours)" };
    }

    // Build data_check_string: sorted key=value pairs, excluding hash
    const pairs: string[] = [];
    for (const [key, value] of params.entries()) {
      if (key !== "hash") {
        pairs.push(`${key}=${value}`);
      }
    }
    pairs.sort();
    const dataCheckString = pairs.join("\n");

    // HMAC-SHA256 with bot token as key
    const computedHash = hmacSha256Hex(botToken, dataCheckString);

    if (!timingSafeEqual(computedHash, hash)) {
      return { valid: false, error: "Invalid hash" };
    }

    // Parse user from initData
    const userStr = params.get("user");
    let user: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string } | undefined;
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch {
        // User JSON is malformed
      }
    }

    return { valid: true, user };
  } catch (err) {
    return { valid: false, error: `Verification error: ${(err as Error).message}` };
  }
}

/**
 * Synchronous HMAC-SHA256 for use in non-async contexts.
 * Falls back to a simple hash for environments without SubtleCrypto.
 */
function hmacSha256Hex(key: string, message: string): string {
  // In Deno edge functions, we can use async but need to handle it
  // For now, use a synchronous approach with crypto module if available
  // This is a simplified version - in production, use proper HMAC

  // Actually, let's use the SubtleCrypto approach since Deno supports it
  // We'll make this work by using a sync wrapper

  // Simple approach: use the built-in crypto in Deno
  // Deno's crypto.subtle is available but async
  // For edge functions, we can use a workaround

  // Let's use a pure JS HMAC-SHA256 implementation
  return pureHmacSha256(key, message);
}

/**
 * Pure JavaScript HMAC-SHA256 implementation
 */
function pureHmacSha256(key: string, message: string): string {
  // SHA-256 constants
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  function sha256(msg: Uint8Array): Uint8Array {
    const l = msg.length;
    const bitLen = l * 8;

    // Padding
    const padLen = (l % 64 < 56) ? 56 - (l % 64) : 120 - (l % 64);
    const padded = new Uint8Array(l + padLen + 8);
    padded.set(msg);
    padded[l] = 0x80;

    // Length in bits (big-endian, 64-bit)
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 4, bitLen, false);
    view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

    let h0 = H[0], h1 = H[1], h2 = H[2], h3 = H[3];
    let h4 = H[4], h5 = H[5], h6 = H[6], h7 = H[7];

    for (let i = 0; i < padded.length; i += 64) {
      const w = new Uint32Array(64);
      for (let j = 0; j < 16; j++) {
        w[j] = view.getUint32(i + j * 4, false);
      }
      for (let j = 16; j < 64; j++) {
        const s0 = rot32(w[j - 15], 7) ^ rot32(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rot32(w[j - 2], 17) ^ rot32(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      let a = h0, b = h1, c = h2, d = h3;
      let e = h4, f = h5, g = h6, h = h7;

      for (let j = 0; j < 64; j++) {
        const S1 = rot32(e, 6) ^ rot32(e, 11) ^ rot32(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[j] + w[j]) | 0;
        const S0 = rot32(a, 2) ^ rot32(a, 13) ^ rot32(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;

        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }

      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }

    const result = new Uint8Array(32);
    const rv = new DataView(result.buffer);
    rv.setUint32(0, h0, false); rv.setUint32(4, h1, false);
    rv.setUint32(8, h2, false); rv.setUint32(12, h3, false);
    rv.setUint32(16, h4, false); rv.setUint32(20, h5, false);
    rv.setUint32(24, h6, false); rv.setUint32(28, h7, false);
    return result;
  }

  function rot32(x: number, n: number): number {
    return ((x << n) | (x >>> (32 - n))) >>> 0;
  }

  function hex(arr: Uint8Array): string {
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // HMAC: H((K' ^ opad) || H((K' ^ ipad) || message))
  const BLOCK_SIZE = 64;
  const keyBytes = new TextEncoder().encode(key);
  let keyPadded: Uint8Array;

  if (keyBytes.length > BLOCK_SIZE) {
    keyPadded = sha256(keyBytes);
  } else {
    keyPadded = new Uint8Array(BLOCK_SIZE);
    keyPadded.set(keyBytes);
  }

  const ipad = new Uint8Array(BLOCK_SIZE);
  const opad = new Uint8Array(BLOCK_SIZE);
  for (let i = 0; i < BLOCK_SIZE; i++) {
    ipad[i] = keyPadded[i] ^ 0x36;
    opad[i] = keyPadded[i] ^ 0x5c;
  }

  const msgBytes = new TextEncoder().encode(message);
  const innerMsg = new Uint8Array(BLOCK_SIZE + msgBytes.length);
  innerMsg.set(ipad);
  innerMsg.set(msgBytes, BLOCK_SIZE);
  const innerHash = sha256(innerMsg);

  const outerMsg = new Uint8Array(BLOCK_SIZE + 32);
  outerMsg.set(opad);
  outerMsg.set(innerHash, BLOCK_SIZE);
  const outerHash = sha256(outerMsg);

  return hex(outerHash);
}
