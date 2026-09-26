import logging

from cryptography.fernet import Fernet

from config import settings

logger = logging.getLogger("interviewme.api")

_key = settings.token_encryption_key or Fernet.generate_key().decode()
if not settings.token_encryption_key:
    logger.warning("TOKEN_ENCRYPTION_KEY not set — generated an ephemeral key; stored tokens won't survive restarts")
_fernet = Fernet(_key.encode() if isinstance(_key, str) else _key)


def encrypt(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    return _fernet.decrypt(value.encode()).decode()
