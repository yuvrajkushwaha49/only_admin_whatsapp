const ALPHABET = '3k8XyW6mP2qZaB9vC4dE1fG5hJ7jK0nLpQrStUuVwTxYz';
const SALT = 'campaignflow_secure_salt_2026_x9k2p_aisency';
const MIN_LEN = 10;
const BASE = BigInt(ALPHABET.length);

function getSaltCheck(num) {
  let h = 0x811c9dc5;
  const str = SALT + ':' + num;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h % 997);
}

/**
 * Encodes a numeric database ID into a safe, salted, obfuscated hash string for URLs.
 * Pure standalone implementation (zero external npm dependencies).
 * @param {number|string} id 
 * @returns {string}
 */
export function encodeHashId(id) {
  if (id === null || id === undefined || id === '') return '';
  const num = Number(id);
  if (isNaN(num) || num < 0 || !Number.isInteger(num)) return '';
  const check = getSaltCheck(num);
  let val = BigInt(num) * 1000n + BigInt(check);
  let encoded = '';
  while (val > 0n) {
    const rem = Number(val % BASE);
    encoded = ALPHABET[rem] + encoded;
    val = val / BASE;
  }
  if (!encoded) encoded = ALPHABET[0];
  
  // Deterministic salted padding to achieve MIN_LEN
  let padCount = 0;
  let padChars = '';
  while ((encoded.length + padChars.length) < MIN_LEN - 1) {
    const pIdx = (padCount * 13 + check + num) % ALPHABET.length;
    padChars += ALPHABET[pIdx];
    padCount++;
  }
  const padChar = ALPHABET[padCount % ALPHABET.length];
  return padChar + padChars + encoded;
}

/**
 * Decodes a salted hash string from a URL into the original numeric database ID.
 * Direct numeric IDs (e.g. "80", "79") are strictly rejected unless allowDirectNumeric is true.
 * @param {string|number} hashOrId 
 * @param {boolean} [allowDirectNumeric=false]
 * @returns {number|null}
 */
export function decodeHashId(hashOrId, allowDirectNumeric = false) {
  if (hashOrId === null || hashOrId === undefined || hashOrId === '') return null;
  const s = String(hashOrId).trim();
  
  // Direct numeric IDs are blocked by default for security
  if (/^\d+$/.test(s)) {
    return allowDirectNumeric ? parseInt(s, 10) : null;
  }
  if (s.length < 2) return null;
  
  const padChar = s[0];
  const padIdx = ALPHABET.indexOf(padChar);
  if (padIdx === -1) return null;
  const padCount = padIdx;
  if (s.length < 1 + padCount) return null;
  
  const encoded = s.slice(1 + padCount);
  if (!encoded) return null;
  
  let val = 0n;
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) return null;
    val = val * BASE + BigInt(idx);
  }
  
  const num = Number(val / 1000n);
  const check = Number(val % 1000n);
  if (getSaltCheck(num) !== check) {
    return null;
  }
  return num;
}

export default {
  encodeHashId,
  decodeHashId
};
