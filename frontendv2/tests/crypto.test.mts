// Run: node --experimental-strip-types tests/crypto.test.mts
import assert from 'node:assert/strict'
import { generateEncryptionKey, exportKeyToUrlFragment, importKeyFromUrlFragment, encryptMessage, decryptMessage, encryptFile, decryptFile } from '../lib/encryption.ts'

const key = await generateEncryptionKey()
const frag = await exportKeyToUrlFragment(key)
assert.ok(frag.length >= 42, 'fragment key present (256-bit base64url)')

const msg = 'Test message ✓ unicode — ' + 'x'.repeat(9000)
const { ciphertext, iv } = await encryptMessage(msg, key)
assert.ok(!ciphertext.includes('Test message'), 'ciphertext does not contain plaintext')
const key2 = await importKeyFromUrlFragment(frag)
assert.equal(await decryptMessage(ciphertext, iv, key2), msg, 'message round trip via fragment key')

const wrong = await generateEncryptionKey()
await assert.rejects(() => decryptMessage(ciphertext, iv, wrong), 'wrong key must fail')

const bytes = new Uint8Array(200000).map((_, i) => i % 251)
const enc = await encryptFile(new Blob([bytes]), key)
const dec = new Uint8Array(await (await decryptFile(enc.ciphertext, enc.iv, key2)).arrayBuffer())
assert.deepEqual(dec, bytes, 'file round trip')
console.log('crypto tests passed (5 assertions)')
