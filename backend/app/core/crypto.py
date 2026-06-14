import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

# AES-256 requires 32-byte key (256 bits)
_ENCODED_KEY = settings.MASTER_ENCRYPTION_KEY  # base64-encoded 32 bytes
_RAW_KEY: bytes | None = None


def _get_key() -> bytes:
    global _RAW_KEY
    if _RAW_KEY is None:
        if not _ENCODED_KEY:
            raise RuntimeError("MASTER_ENCRYPTION_KEY is not set")
        _RAW_KEY = base64.b64decode(_ENCODED_KEY)
        if len(_RAW_KEY) != 32:
            raise RuntimeError("MASTER_ENCRYPTION_KEY must be 32 bytes (base64-encoded)")
    return _RAW_KEY


def encrypt(plaintext: str) -> tuple[str, str]:
    """Returns (encrypted_b64, iv_b64)."""
    key = _get_key()
    iv = os.urandom(12)  # GCM standard nonce = 12 bytes
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
    return base64.b64encode(ciphertext).decode(), base64.b64encode(iv).decode()


def decrypt(encrypted_b64: str, iv_b64: str) -> str:
    """Decrypts using the master key. Returns plaintext string."""
    key = _get_key()
    ciphertext = base64.b64decode(encrypted_b64)
    iv = base64.b64decode(iv_b64)
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext, None)
    return plaintext.decode("utf-8")