export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportKeyToUrlFragment(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("jwk", key);
  return exported.k || "";
}

export async function importKeyFromUrlFragment(k: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "jwk",
    {
      kty: "oct",
      k: k,
      alg: "A256GCM",
      ext: true
    },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(message: string, key: CryptoKey): Promise<{ ciphertext: string, iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  const encryptedArr = Array.from(new Uint8Array(encryptedBuf));
  const ciphertextBase64 = btoa(String.fromCharCode(...encryptedArr));
  const ivBase64 = btoa(String.fromCharCode(...Array.from(iv)));
  
  return { ciphertext: ciphertextBase64, iv: ivBase64 };
}

export async function decryptMessage(ciphertextBase64: string, ivBase64: string, key: CryptoKey): Promise<string> {
  const ciphertextBytes = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  
  const decryptedBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    ciphertextBytes
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuf);
}

export async function encryptFile(file: File | Blob, key: CryptoKey): Promise<{ ciphertext: Blob, iv: string }> {
  const data = await file.arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  const ivBase64 = btoa(String.fromCharCode(...Array.from(iv)));
  return { ciphertext: new Blob([encryptedBuf]), iv: ivBase64 };
}

export async function decryptFile(ciphertextBlob: Blob, ivBase64: string, key: CryptoKey): Promise<Blob> {
  const ciphertextBytes = await ciphertextBlob.arrayBuffer();
  const ivBytes = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  
  const decryptedBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    ciphertextBytes
  );
  
  return new Blob([decryptedBuf]);
}
