import hvac
import os
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

class KMSManager:
    def __init__(self):
        self.client = hvac.Client(url=os.getenv('VAULT_URL'), token=os.getenv('VAULT_TOKEN'))
        self.master_key = self._get_production_master_key()

    def _get_production_master_key(self):
        """Retrieves or initializes the Master Key from Vault's KV store."""
        secret_path = 'well-repository/master-key'
        try:
            # Try to read the existing Master Key from Vault
            read_response = self.client.secrets.kv.v2.read_secret_version(path=secret_path)
            key_hex = read_response['data']['data']['key']
            return bytes.fromhex(key_hex)
        except:
            # If it doesn't exist, generate a new one and store it in Vault
            new_key = os.urandom(32)
            self.client.secrets.kv.v2.create_or_update_secret(
                path=secret_path,
                secret=dict(key=new_key.hex())
            )
            return new_key

    def derive_key(self, context: str):
        """Derives a context-specific key using HKDF (RFC 5869)."""
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=context.encode(),
            backend=default_backend()
        )
        return hkdf.derive(self.master_key)