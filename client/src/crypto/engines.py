from phe import paillier
from cryptography.hazmat.primitives import hashes, hmac
from cryptography.hazmat.backends import default_backend

class CryptoEngine:
    def __init__(self, derivation_key):
        self.key = derivation_key
        self.phe_public_key = None
        self.phe_private_key = None

    def encrypt_sse(self, plaintext: str):
        """Searchable Symmetric Encryption using deterministic HMAC-SHA256."""
        h = hmac.HMAC(self.key, hashes.SHA256(), backend=default_backend())
        h.update(str(plaintext).encode())
        return h.finalize().hex()

    def encrypt_phe(self, value: float):
        """Partially Homomorphic Encryption using Paillier."""
        if self.phe_public_key is None:
            self.phe_public_key, self.phe_private_key = paillier.generate_paillier_keypair()
        
        encrypted_number = self.phe_public_key.encrypt(value)
        return encrypted_number

    def decrypt_phe(self, encrypted_number):
        """Decrypts a Paillier encrypted number using the stored private key."""
        if self.phe_private_key is None:
            raise ValueError("Private key not initialized. Encrypt something first.")
        return self.phe_private_key.decrypt(encrypted_number)