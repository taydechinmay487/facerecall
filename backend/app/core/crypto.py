"""Optional at-rest protection for stored face embeddings.

Embeddings are biometric data. With `FACERECALL_ENCRYPTION_KEY` set they are
encrypted with Fernet (AES-128-CBC + HMAC) before touching the database. When
the key is absent we store plaintext and the API reports `encryption: disabled`
in `/status` and in the Settings -> Privacy screen. We never claim encryption
that is not configured.
"""

from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings

_PREFIX = b"enc:v1:"


class EncryptionError(RuntimeError):
    pass


@lru_cache(maxsize=4)
def _fernet(key: str) -> Fernet:
    try:
        return Fernet(key.encode("utf-8"))
    except (ValueError, TypeError) as exc:  # invalid key material
        raise EncryptionError(
            "FACERECALL_ENCRYPTION_KEY is not a valid Fernet key. "
            'Generate one with: python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        ) from exc


def encryption_enabled() -> bool:
    return bool(get_settings().encryption_key.strip())


def protect_bytes(raw: bytes) -> bytes:
    key = get_settings().encryption_key.strip()
    if not key:
        return raw
    return _PREFIX + _fernet(key).encrypt(raw)


def reveal_bytes(blob: bytes) -> bytes:
    if not blob.startswith(_PREFIX):
        return blob
    key = get_settings().encryption_key.strip()
    if not key:
        raise EncryptionError(
            "Stored embeddings are encrypted but FACERECALL_ENCRYPTION_KEY is not set."
        )
    try:
        return _fernet(key).decrypt(blob[len(_PREFIX) :])
    except InvalidToken as exc:
        raise EncryptionError(
            "Could not decrypt stored embeddings with the configured key."
        ) from exc


def reset_cache() -> None:
    """Used by tests after changing configuration."""
    _fernet.cache_clear()
