# ============================================================
# backend/app/schemas.py  — GenX
# ============================================================
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


# ============================================================================
# AUTH — TOKENS
# ============================================================================
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None


# ============================================================================
# AUTH — USERS
# ============================================================================
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "user"
    is_active: bool = True
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    full_name: Optional[str] = None


# ============================================================================
# PLANS
# ============================================================================
class PlanOut(BaseModel):
    id: int
    code: str
    name: str
    description: str = ""

    price_monthly: float = 0.0
    price_yearly: float = 0.0
    currency: str = "USD"

    # cycle-based
    max_cycles: int = 100
    cycles_expire: bool = True
    trial_days: Optional[int] = None

    # broker / mirroring
    max_mt5_accounts: int = 1
    max_symbols: int = 2
    max_strategies: int = 1
    all_symbols_visible: bool = True
    all_strategies_visible: bool = True

    # equity
    max_account_equity: float = 0.0

    # legacy limits
    max_live_sessions: int = 1
    max_backtests_per_day: int = 50
    max_mining_runs: int = 0

    # feature flags
    allow_ml_filter: bool = False
    allow_regime_detection: bool = False
    allow_api_access: bool = False
    allow_multi_terminal: bool = False

    # extras
    support_response_hours: int = 72
    latency_tier: str = "best_effort"
    api_access: str = "none"
    custom_risk_rails: bool = False
    early_access_symbols: bool = False
    signal_channel: bool = False
    custom_hub: bool = False
    white_label: bool = False
    dedicated_infrastructure: bool = False

    features: List[str] = []
    sort_order: int = 0

    class Config:
        from_attributes = True


class PlanCreate(BaseModel):
    code: str
    name: str
    description: str = ""
    price_monthly: float = 0.0
    price_yearly: float = 0.0
    currency: str = "USD"
    max_cycles: int = 100
    cycles_expire: bool = True
    trial_days: Optional[int] = None
    max_mt5_accounts: int = 1
    max_symbols: int = 2
    max_strategies: int = 1
    all_symbols_visible: bool = True
    all_strategies_visible: bool = True
    max_account_equity: float = 0.0
    max_live_sessions: int = 1
    max_backtests_per_day: int = 50
    max_mining_runs: int = 0
    allow_ml_filter: bool = False
    allow_regime_detection: bool = False
    allow_api_access: bool = False
    allow_multi_terminal: bool = False
    support_response_hours: int = 72
    latency_tier: str = "best_effort"
    api_access: str = "none"
    custom_risk_rails: bool = False
    early_access_symbols: bool = False
    signal_channel: bool = False
    custom_hub: bool = False
    white_label: bool = False
    dedicated_infrastructure: bool = False
    features: List[str] = []
    sort_order: int = 0


# ============================================================================
# SUBSCRIPTIONS
# ============================================================================
class SubscriptionOut(BaseModel):
    id: int
    status: str
    started_at: datetime
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    plan: Optional[PlanOut] = None

    class Config:
        from_attributes = True


class ChangePlanIn(BaseModel):
    plan_code: str
    billing_cycle: str = "monthly"


# ============================================================================
# USAGE
# ============================================================================
class UsageOut(BaseModel):
    live_sessions: int = 0
    backtests: int = 0
    mining_runs: int = 0
    optimizations: int = 0


class UsageRecordIn(BaseModel):
    kind: str
    units: int = 1
    detail: str = ""


# ============================================================================
# SUBSCRIPTION / ME
# ============================================================================
class MeSubscriptionOut(BaseModel):
    user_id: int
    email: EmailStr
    role: str
    is_active: bool
    plan: Optional[PlanOut] = None
    subscription: Optional[SubscriptionOut] = None
    usage: UsageOut = UsageOut()


# ============================================================================
# ADMIN — USER MANAGEMENT
# ============================================================================
class UserAdminOut(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    is_active: bool
    plan: Optional[PlanOut] = None
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserAdminUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    plan_code: Optional[str] = None
    full_name: Optional[str] = None


class UserActivityOut(BaseModel):
    id: int
    action: str
    detail: str = ""
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# INVOICES
# ============================================================================
class InvoiceOut(BaseModel):
    id: int
    amount: float
    currency: str = "USD"
    status: str
    description: str = ""
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    issued_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# DOMAIN — permissive stubs so existing routers don't break
# ============================================================================
class DNAProfile(BaseModel):
    symbol: str
    timeframe: str
    chromosomes: dict = {}
    extracted_at: Optional[datetime] = None


class StrategyInfo(BaseModel):
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    best_timeframes: List[str] = []


class OptimizedParams(BaseModel):
    symbol: str
    strategy: str
    timeframe: Optional[str] = None
    params: dict = {}
    score: Optional[float] = None
    generated_at: Optional[datetime] = None


class BacktestSummary(BaseModel):
    symbol: str
    strategy: str
    timeframe: Optional[str] = None
    trades: int = 0
    win_rate: float = 0.0
    net_pnl: float = 0.0
    sharpe: Optional[float] = None
    max_drawdown: Optional[float] = None
    generated_at: Optional[datetime] = None


class LiveSessionOut(BaseModel):
    session_id: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    symbols: List[str] = []
    strategies: List[str] = []
    trades: int = 0
    net_pnl: float = 0.0
    status: Optional[str] = None


class MiningRunOut(BaseModel):
    run_id: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    symbols: int = 0
    regimes: int = 0
    status: Optional[str] = None


class AuditReportOut(BaseModel):
    report_id: str
    level: Optional[str] = None
    generated_at: Optional[datetime] = None
    passed: Optional[bool] = None
    summary: Optional[str] = None