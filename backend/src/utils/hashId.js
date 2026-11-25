import Hashids from 'hashids';

const HASH_SALT = process.env.HASH_SALT || 'campaignflow_secure_salt_2026_x9k2p_aisency';
const hashids = new Hashids(HASH_SALT, 10);

/**
 * Encodes a numeric database ID into a safe, salted, obfuscated hash string for URLs.
 * @param {number|string} id 
 * @returns {string}
 */
export function encodeHashId(id) {
  if (id === null || id === undefined || id === '') return '';
  const num = Number(id);
  if (isNaN(num) || num < 0) return String(id);
  return hashids.encode(num);
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
  const str = String(hashOrId).trim();
  
  // Direct numeric IDs are blocked by default for security
  if (/^\d+$/.test(str)) {
    if (allowDirectNumeric) {
      return parseInt(str, 10);
    }
    return null;
  }

  try {
    const decoded = hashids.decode(str);
    if (decoded && decoded.length > 0) {
      return Number(decoded[0]);
    }
  } catch (e) {
    return null;
  }
  return null;
}

export default {
  encodeHashId,
  decodeHashId
};
