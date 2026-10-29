# backend/app/routers/auth_router.py
import os
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from itsdangerous import URLSafeTimedSerializer, BadSignature

from ..database import get_db
from ..models import User, Plan, Subscription
from ..schemas import (
    UserCreate, UserLogin, UserOut, UserUpdate,
    UserAdminOut, UserAdminUpdate, UserActivityOut,
    GoogleAuthIn, PlanOut, Token, InvoiceOut, SubscriptionOut,
)
from ..auth import get_current_user, create_access_token, verify_password, hash_password, ACCESS_TOKEN_EXPIRE_MINUTES, require_admin,get_current_user, create_access_token, verify_password,hash_password, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Setup verification serializer
SECRET = os.getenv("JWT_SECRET", "fallback-secret")
serializer = URLSafeTimedSerializer(SECRET, salt="email-verify")

def send_verification_email(email: str, token: str):
    """Send email. If SMTP is not configured, print to console for testing."""
    verify_url = f"https://genx.vortech.markets/verify-email?token={token}"
    
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    
    if not smtp_user or not smtp_pass:
        print(f"\n[EMAIL VERIFY] URL: {verify_url}\n")
        return
        
    msg = MIMEText(f"Welcome to GenX! Please verify your email by clicking here: {verify_url}")
    msg["Subject"] = "Verify your GenX Account"
    msg["From"] = smtp_user
    msg["To"] = email
    
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
    except Exception as e:
        print(f"Failed to send email: {e}")
        print(f"[EMAIL VERIFY FALLBACK] URL: {verify_url}")

# --- 1. Registration ---
@router.post("/register", response_model=UserOut)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password) if user_in.password else None,
        full_name=user_in.full_name,
        phone_number=user_in.phone_number,
        country=user_in.country,
        is_verified=False, # Must verify
        terms_accepted_at=datetime.utcnow() if user_in.terms_accepted else None,
        terms_accepted_version=user_in.terms_version
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Send verify email
    token = serializer.dumps({"email": user.email})
    send_verification_email(user.email, token)
    
    return user

# --- 2. Email Verification ---
@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    try:
        data = serializer.loads(token, max_age=86400) # 24 hours
    except BadSignature:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
        
    user = db.query(User).filter(User.email == data["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_verified = True
    db.commit()
    return {"message": "Email verified successfully"}

# --- 3. Google Login ---
@router.post("/google-login")
def google_login(payload: GoogleAuthIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    
    if not user:
        # Create new user from Google
        user = User(
            email=payload.email,
            full_name=payload.full_name,
            auth_provider="google",
            is_verified=True, # Google emails are pre-verified
            hashed_password=None
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Generate standard JWT
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

# --- 4. Login (Add is_verified check) ---
@router.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your email before logging in")

    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    access_token = create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}


def _plan_out(p: Plan | None) -> PlanOut | None:
    if not p:
        return None
    d = {c.name: getattr(p, c.name) for c in p.__table__.columns}
    d["features"] = json.loads(p.features_json or "[]")
    return PlanOut(**{k: v for k, v in d.items() if k in PlanOut.model_fields})


# ---------------------------------------------------------------------------
# register / login / me
# ---------------------------------------------------------------------------
@router.post("/register", response_model=Token)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user and immediately return a JWT token.
    
    Frontend contract: the client calls /register once, receives {access_token},
    saves it, and redirects to /dashboard — no separate /token call needed.
    """
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(400, "Email already registered")

    is_first_user = db.query(User).count() == 0
    trial_plan = db.query(Plan).filter(Plan.code == "trial").first()

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name or "",
        role="admin" if is_first_user else "user",
        is_active=True,
        plan_id=trial_plan.id if trial_plan else None,
        terms_accepted_at=datetime.utcnow() if payload.terms_accepted else None,
        terms_accepted_version=payload.terms_version if payload.terms_accepted else None,
    )
    db.add(user)
    db.flush()  # get user.id before audit log

    # audit trail — the frontend doesn't see this, but admins can
    db.add(AuditLog(
        user_id=user.id,
        actor_id=user.id,
        action="user.register",
        detail=f"role={'admin' if is_first_user else 'user'} terms={payload.terms_accepted} version={payload.terms_version}",
    ))

    db.commit()
    db.refresh(user)

    # Issue token immediately (matches frontend expectation)
    token = create_access_token({"sub": user.email, "role": user.role})
    return Token(access_token=token, token_type="bearer")

@router.post("/token", response_model=Token)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(403, "Account is disabled")

    user.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": user.email, "role": user.role})
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# admin — user management
# ---------------------------------------------------------------------------
@router.get("/users", response_model=List[UserAdminOut])
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id.asc()).all()
    return [
        UserAdminOut(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            is_active=u.is_active,
            plan=_plan_out(u.plan),
            last_login=u.last_login,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.patch("/users/{user_id}", response_model=UserAdminOut)
def update_user(
    user_id: int,
    payload: UserAdminUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")

    changes = []

    if payload.role is not None and payload.role != u.role:
        if payload.role not in ("admin", "user", "viewer"):
            raise HTTPException(400, "Invalid role")
        changes.append(f"role {u.role}→{payload.role}")
        u.role = payload.role

    if payload.is_active is not None and payload.is_active != u.is_active:
        changes.append(f"active {u.is_active}→{payload.is_active}")
        u.is_active = payload.is_active

    if payload.full_name is not None:
        u.full_name = payload.full_name

    if payload.plan_code is not None:
        plan = db.query(Plan).filter(Plan.code == payload.plan_code).first()
        if not plan:
            raise HTTPException(400, f"Unknown plan {payload.plan_code}")
        changes.append(f"plan→{plan.code}")
        u.plan_id = plan.id

    if changes:
        db.add(AuditLog(
            user_id=u.id,
            actor_id=admin.id,
            action="user.update",
            detail="; ".join(changes),
        ))
    db.commit()
    db.refresh(u)

    return UserAdminOut(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        role=u.role,
        is_active=u.is_active,
        plan=_plan_out(u.plan),
        last_login=u.last_login,
        created_at=u.created_at,
    )


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == admin.id:
        raise HTTPException(400, "Cannot delete yourself")
    db.delete(u)
    db.add(AuditLog(
        actor_id=admin.id,
        action="user.delete",
        detail=f"Deleted {u.email}",
    ))
    db.commit()
    return {"ok": True}


@router.get("/users/{user_id}/activity", response_model=List[UserActivityOut])
def user_activity(
    user_id: int,
    limit: int = 50,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return (
        db.query(AuditLog)
          .filter(AuditLog.user_id == user_id)
          .order_by(AuditLog.created_at.desc())
          .limit(limit)
          .all()
    )