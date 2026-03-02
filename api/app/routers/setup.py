from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import create_token, hash_password
from app.database import get_db
from app.models.user import User
from app.schemas.user import SetupRequest, SetupStatusResponse, TokenResponse

router = APIRouter(prefix="/setup", tags=["setup"])


@router.get("/status", response_model=SetupStatusResponse)
def setup_status(db: Session = Depends(get_db)):
    count = db.query(User).count()
    return SetupStatusResponse(setup_required=count == 0)


@router.post("", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def create_admin(req: SetupRequest, db: Session = Depends(get_db)):
    if db.query(User).count() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Setup already completed",
        )

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        is_admin=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token(user.id, user.username)
    return TokenResponse(access_token=token)
