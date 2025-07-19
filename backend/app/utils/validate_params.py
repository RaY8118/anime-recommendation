from fastapi import Request, HTTPException

def validate_query_params(request: Request, allowed_params: set):
    incoming_params = set(request.query_params.keys())
    invalid_params = incoming_params - allowed_params
    if invalid_params: 
        raise HTTPException(
            status_code=400,
            detail="Invalid query paramters"
        )