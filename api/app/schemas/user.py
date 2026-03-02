from pydantic import BaseModel


class SetupRequest(BaseModel):
    username: str
    password: str


class SetupStatusResponse(BaseModel):
    setup_required: bool


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    is_admin: bool

    model_config = {"from_attributes": True}
