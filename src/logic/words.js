// The dictionaries, as packed integer codes so the solver can test a row in one Set lookup.
// ENABLE (every 3-5 letter word, public domain) decides what counts as a word on the sheet.
// The curated list (common, friendly words) is the only source of target rows.
// Both lists are copied unchanged from Rungs (src/data); see AGENTS.md before touching them.
import { GUESS } from '../data/guess.js'
import { PUZZLE } from '../data/puzzle.js'
import { isBlocked } from './blocklist.js'

export const LENGTHS = [3, 4, 5]
const unpack = (s, n) => { const out = []; for (let i = 0; i + n <= s.length; i += n) out.push(s.slice(i, i + n)); return out }

/** Integer code of a lowercase word: letter i (a = 0) times 26^i. Unique per word of a given length. */
export function wordCode(w) { let c = 0, m = 1; for (let i = 0; i < w.length; i++) { c += (w.charCodeAt(i) - 97) * m; m *= 26 } return c }
export function codeWord(c, n) { let s = ''; for (let i = 0; i < n; i++) { s += String.fromCharCode(97 + (c % 26)); c = Math.floor(c / 26) } return s }

/** enable[n]: codes of every ENABLE word of length n that is not blocklisted. curated[n]: codes of curated words. */
export const enable = {}, curated = {}
/** targets[n]: curated words we are happy to put on a sheet as an answer row (sorted, no blocklisted words,
 *  and no word that is just a shorter curated word plus -s, so headlines read BOLT GEAR, not BOLTS GEARS). */
export const targets = {}
const curatedWords = {}
for (const n of LENGTHS) {
  enable[n] = new Set(unpack(GUESS[n], n).filter((w) => !isBlocked(w)).map(wordCode))
  curatedWords[n] = unpack(PUZZLE[n], n).filter((w) => !isBlocked(w))
  curated[n] = new Set(curatedWords[n].map(wordCode))
}
for (const n of LENGTHS) {
  const shorter = new Set(curatedWords[n - 1] || [])
  targets[n] = curatedWords[n].filter((w) => !(w.endsWith('s') && shorter.has(w.slice(0, -1))) && enable[n].has(wordCode(w)))
}

/** Bitsets over word codes (26^n bits) for the solver's hot loop: bit set = ENABLE word / curated word. */
export const enableBits = {}, curatedBits = {}
for (const n of LENGTHS) {
  const size = Math.ceil(26 ** n / 32)
  enableBits[n] = new Uint32Array(size); curatedBits[n] = new Uint32Array(size)
  for (const c of enable[n]) enableBits[n][c >>> 5] |= 1 << (c & 31)
  for (const c of curated[n]) curatedBits[n][c >>> 5] |= 1 << (c & 31)
}

export const isWord =(w) => typeof w === 'string' && !!enable[w.length] && enable[w.length].has(wordCode(w))
export const isCurated = (w) => typeof w === 'string' && !!curated[w.length] && curated[w.length].has(wordCode(w))
