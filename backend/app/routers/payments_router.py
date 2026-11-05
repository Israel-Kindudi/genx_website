# backend/app/routers/payments_router.py
from fastapi import APIRouter, Depends, HTTPException
import re
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Literal

from ..database import get_db
from ..models import User, Plan
from ..auth import get_current_user

router = APIRouter(prefix="/api/payments", tags=["payments"])


class CheckoutIn(BaseModel):
    plan_code: str
    billing_cycle: Literal["monthly", "yearly"]
    payment_method: Literal["card", "mobile_money"]
    provider: Literal["stripe", "flutterwave"]
    email: str
    phone_number: Optional[str] = None
    country_code: Optional[str] = None  # ISO 3166-1 alpha-2
    dial_code: Optional[str] = None  # calling code digits, e.g. "243"
    mobile_money_provider: Optional[str] = None


E164_RE = re.compile(r"^\+\d{8,15}$")
ISO_COUNTRY_RE = re.compile(r"^[A-Z]{2}$")
MOBILE_PROVIDERS = {"MPESA", "AIRTEL", "ORANGE", "MTN", "AFRIMONEY"}


def _validate_mobile_money(payload: CheckoutIn) -> None:
    country = (payload.country_code or "").upper()
    dial = (payload.dial_code or "").lstrip("+")
    phone = (payload.phone_number or "").replace(" ", "")

    if not ISO_COUNTRY_RE.match(country):
        raise HTTPException(400, "Invalid country code")
    if not dial.isdigit() or not 1 <= len(dial) <= 4:
        raise HTTPException(400, "Invalid dial code")
    if not E164_RE.match(phone) or not phone.startswith(f"+{dial}"):
        raise HTTPException(400, "Phone number must be in international format and match the country dial code")
    if (payload.mobile_money_provider or "").upper() not in MOBILE_PROVIDERS:
        raise HTTPException(400, "Unsupported mobile money provider")

    payload.country_code = country
    payload.dial_code = dial
    payload.phone_number = phone


@router.post("/checkout")
async def create_checkout(
    payload: CheckoutIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.code == payload.plan_code).first()
    if not plan:
        raise HTTPException(404, "Plan not found")

    amount = plan.price_yearly if payload.billing_cycle == "yearly" else plan.price_monthly
    if amount <= 0:
        raise HTTPException(400, "Free plan — no checkout needed")

    # STUB — replace with real Stripe/Flutterwave integration
    # For now, just return a placeholder URL that shows what would happen
    if payload.payment_method == "card":
        if not ISO_COUNTRY_RE.match((payload.country_code or "").upper()):
            raise HTTPException(400, "Billing country required")
        return {
            "checkout_url": f"/dashboard?checkout=stub&provider=stripe&amount={amount}",
            "stub": True,
        }
    else:
        _validate_mobile_money(payload)
        return {
            "checkout_url": f"/dashboard?checkout=stub&provider=flutterwave&phone={payload.phone_number}",
            "stub": True,
        }