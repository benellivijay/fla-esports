const fs = require('fs');

try {
  let c = fs.readFileSync('node_modules/@discordjs/voice/dist/index.js', 'utf8');

  // Replace stream.destroy(error) with safe drop
  c = c.replace(/stream\.destroy\(error\);/g, '/* safe packet drop */');

  // Replace DAVE session WebAssembly call
  c = c.replace(/if \(daveSession\) packet = daveSession\.decrypt\(packet, userId\);/g, '/* safe dave pass */');

  // Replace methods & secretboxLoadPromise
  const idx = c.indexOf('var methods =');
  const idxEnd = c.indexOf('var RTP_OPUS_PAYLOAD_TYPE');
  if (idx !== -1 && idxEnd !== -1) {
    const replacement = `var _sodiumNative = require("sodium-native");
var methods = {
  crypto_aead_xchacha20poly1305_ietf_encrypt: (plaintext, additionalData, nonce, key) => {
    const cipherText = Buffer.alloc(plaintext.length + _sodiumNative.crypto_aead_xchacha20poly1305_ietf_ABYTES);
    _sodiumNative.crypto_aead_xchacha20poly1305_ietf_encrypt(cipherText, plaintext, additionalData, null, nonce, key);
    return cipherText;
  },
  crypto_aead_xchacha20poly1305_ietf_decrypt: (cipherText, additionalData, nonce, key) => {
    const message = Buffer.alloc(cipherText.length - _sodiumNative.crypto_aead_xchacha20poly1305_ietf_ABYTES);
    _sodiumNative.crypto_aead_xchacha20poly1305_ietf_decrypt(message, null, cipherText, additionalData, nonce, key);
    return message;
  }
};
var secretboxLoadPromise = Promise.resolve();

`;
    c = c.slice(0, idx) + replacement + c.slice(idxEnd);
  }

  fs.writeFileSync('node_modules/@discordjs/voice/dist/index.js', c);
  console.log('Successfully patched @discordjs/voice/dist/index.js with native C++ crypto!');
} catch (e) {
  console.error('Failed to patch @discordjs/voice:', e);
}
