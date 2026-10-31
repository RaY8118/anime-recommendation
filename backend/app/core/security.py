import json
import os
from urllib.request import urlopen

from authlib.jose import JsonWebKey, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
API_AUDIENCE = os.getenv("AUTH0_API_AUDIENCE")
ISSUER = f"https://{AUTH0_DOMAIN}/"
JWKS_URL = f"{ISSUER}.well-known/jwks.json"

_cached_public_keys = None


def get_public_keys():
    global _cached_public_keys
    if _cached_public_keys is None:
        try:
            with urlopen(JWKS_URL) as response:
                jwks = json.loads(response.read())
                _cached_public_keys = JsonWebKey.import_key_set(jwks)
        except Exception as e:
            print(f"Error fetching JWKS: {e}")
            raise HTTPException(
                status_code=500, detail="Could not verify authentication keys"
            )
    return _cached_public_keys


bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    token = credentials.credentials
    public_keys = get_public_keys()
    try:
        claims = jwt.decode(token, public_keys)
        claims.validate()
        aud = claims.get("aud")
        if isinstance(aud, list):
            if API_AUDIENCE not in aud:
                raise ValueError("Invalid audience")
        elif aud != API_AUDIENCE:
            raise ValueError("Invalid audience")

        # print("✅ TOKEN CLAIMS:", claims)
        return claims

    except Exception as e:
        # print("❌ TOKEN VALIDATION FAILED:", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    claims = get_current_user(credentials)
    user_id = claims.get("sub")
    # print("✅ USER ID:", user_id)
    return user_id
