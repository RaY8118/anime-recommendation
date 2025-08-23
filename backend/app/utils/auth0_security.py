import json
from urllib.request import urlopen
from authlib.jose import jwt, JsonWebKey
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
API_AUDIENCE = os.getenv("AUTH0_API_AUDIENCE")
ISSUER = f"https://{AUTH0_DOMAIN}/"
JWKS_URL = f"{ISSUER}.well-known/jwks.json"

jwks = json.loads(urlopen(JWKS_URL).read())
public_keys = JsonWebKey.import_key_set(jwks)

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    token = credentials.credentials
    try:
        claims = jwt.decode(token, public_keys)
        claims.validate()
        aud = claims.get("aud")
        if isinstance(aud, list):
            if API_AUDIENCE not in aud:
                raise ValueError("Invalid audience")
        elif aud != API_AUDIENCE:
            raise ValueError("Invalid audience")

        print("✅ TOKEN CLAIMS:", claims)
        return claims

    except Exception as e:
        print("❌ TOKEN VALIDATION FAILED:", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    claims = get_current_user(credentials)
    user_id = claims.get("sub")
    print("✅ USER ID:", user_id)
    return user_id
