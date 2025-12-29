// A simple secure wrapper using Web Crypto API would be ideal, 
// but for portability and strict file limits, we will use a rigorous 
// local storage + password implementation pattern.

export class CryptoService {
  
  // Encrypts a string (private key) with a password derived key
  static async encrypt(data: string, password: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    const key = await this.deriveKey(password, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedContent = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      dataBuffer
    );

    // Pack salt + iv + encrypted data into base64
    const buffer = new Uint8Array(salt.byteLength + iv.byteLength + encryptedContent.byteLength);
    buffer.set(salt, 0);
    buffer.set(iv, salt.byteLength);
    buffer.set(new Uint8Array(encryptedContent), salt.byteLength + iv.byteLength);
    
    return btoa(String.fromCharCode(...buffer));
  }

  static async decrypt(encryptedData: string, password: string): Promise<string> {
    try {
      const binaryString = atob(encryptedData);
      const buffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        buffer[i] = binaryString.charCodeAt(i);
      }

      const salt = buffer.slice(0, 16);
      const iv = buffer.slice(16, 28);
      const data = buffer.slice(28);

      const key = await this.deriveKey(password, salt);
      const decryptedContent = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        data
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedContent);
    } catch (e) {
      throw new Error("Failed to decrypt. Wrong password or corrupted data.");
    }
  }

  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }
}