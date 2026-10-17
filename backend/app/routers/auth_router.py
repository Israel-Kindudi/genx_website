# ============================================================
# backend/app/routers/auth_router.py  — GenX
# ============================================================
import json
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Plan, AuditLog
from ..schemas import (
    UserCreate, UserOut, Token, UserUpdate,
    UserAdminOut, UserAdminUpdate, UserActivityOut, PlanOut,
)
from ..auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_admin as _require_admin,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
require_admin = _require_admin


def _plan_out(p: Plan | None) -> PlanOut | None:
    if not p:
        return None
    d = {c.name: getattr(p, c.name) for c in p.__table__.columns}
    d["features"] = json.loads(p.features_json or "[]")
    return PlanOut(**{k: v for k, v in d.items() if k in PlanOut.model_fields})


# ---------------------------------------------------------------------------
# register / login / me
# ---------------------------------------------------------------------------
@router.post("/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)):
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
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


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