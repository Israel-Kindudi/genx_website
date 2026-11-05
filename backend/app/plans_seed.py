# ============================================================
# backend/app/plans_seed.py  — GenX 5-tier plan catalogue
# ============================================================
import json
from sqlalchemy.orm import Session
from .models import Plan


DEFAULT_PLANS = [
    # ------------------------------------------------------------------
    # TRIAL
    # ------------------------------------------------------------------
    {
        "code": "trial",
        "name": "Trial",
        "description": "Try the platform risk-free.",
        "price_monthly": 0.0,
        "price_yearly": 0.0,
        "currency": "USD",

        "max_cycles": 500,
        "cycles_expire": True,
        "trial_days": None,

        "max_mt5_accounts": 1,
        "max_symbols": 2,
        "max_strategies": 2,
        "all_symbols_visible": True,
        "all_strategies_visible": True,

        "max_account_equity": 1000.0,

        "max_live_sessions": 1,
        "max_backtests_per_day": 50,
        "max_mining_runs": 3,

        "allow_ml_filter": False,
        "allow_regime_detection": False,
        "allow_api_access": False,
        "allow_multi_terminal": False,

        "support_response_hours": 72,
        "latency_tier": "best_effort",
        "api_access": "none",
        "custom_risk_rails": False,
        "early_access_symbols": False,
        "signal_channel": False,
        "custom_hub": False,
        "white_label": False,
        "dedicated_infrastructure": False,

        "features_json": json.dumps([
            "500 cycles (one-time)",
            "1 MT5 account",
            "All symbols & strategies visible",
            "Mirror 2 symbols at a time",
            "3 strategy mining runs",
            "Community support",
        ]),
        "sort_order": 0,
    },

    # ------------------------------------------------------------------
    # STARTER
    # ------------------------------------------------------------------
    {
        "code": "starter",
        "name": "Starter",
        "description": "For individual traders getting serious.",
        "price_monthly": 49.0,
        "price_yearly": 490.0,
        "currency": "USD",

        "max_cycles": 3840,
        "cycles_expire": True,
        "trial_days": None,

        "max_mt5_accounts": 1,
        "max_symbols": 5,
        "max_strategies": 3,
        "all_symbols_visible": True,
        "all_strategies_visible": True,

        "max_account_equity": 5000.0,

        "max_live_sessions": 1,
        "max_backtests_per_day": 200,
        "max_mining_runs": 5,

        "allow_ml_filter": False,
        "allow_regime_detection": False,
        "allow_api_access": False,
        "allow_multi_terminal": False,

        "support_response_hours": 48,
        "latency_tier": "standard",
        "api_access": "none",
        "custom_risk_rails": False,
        "early_access_symbols": False,
        "signal_channel": False,
        "custom_hub": False,
        "white_label": False,
        "dedicated_infrastructure": False,

        "features_json": json.dumps([
            "3,840 cycles per month",
            "1 MT5 account",
            "Mirror 5 symbols",
            "Mirror 3 strategies",
            "5 strategy mining runs",
            "Standard latency",
            "Email support",
        ]),
        "sort_order": 1,
    },

    # ------------------------------------------------------------------
    # PRO  ⭐ featured
    # ------------------------------------------------------------------
    {
        "code": "pro",
        "name": "Pro",
        "description": "The full GenX research engine.",
        "price_monthly": 119.0,
        "price_yearly": 1190.0,
        "currency": "USD",

        "max_cycles": 9600,
        "cycles_expire": True,
        "trial_days": None,

        "max_mt5_accounts": 3,
        "max_symbols": 999,
        "max_strategies": 99,
        "all_symbols_visible": True,
        "all_strategies_visible": True,

        "max_account_equity": 200000.0,

        "max_live_sessions": 3,
        "max_backtests_per_day": 1000,
        "max_mining_runs": 20,

        "allow_ml_filter": True,
        "allow_regime_detection": True,
        "allow_api_access": False,
        "allow_multi_terminal": True,

        "support_response_hours": 24,
        "latency_tier": "priority",
        "api_access": "read_only",
        "custom_risk_rails": True,
        "early_access_symbols": False,
        "signal_channel": False,
        "custom_hub": False,
        "white_label": False,
        "dedicated_infrastructure": False,

        "features_json": json.dumps([
            "9,600 cycles per month",
            "Up to 3 MT5 accounts",
            "All symbols, all strategies",
            "20 strategy mining runs",
            "Priority latency",
            "Priority support",
            "Read-only API",
            "Custom risk rails",
        ]),
        "sort_order": 2,
    },

    # ------------------------------------------------------------------
    # FIRM
    # ------------------------------------------------------------------
    {
        "code": "firm",
        "name": "Firm",
        "description": "For funded traders and small desks.",
        "price_monthly": 299.0,
        "price_yearly": 2990.0,
        "currency": "USD",

        "max_cycles": 28800,
        "cycles_expire": True,
        "trial_days": None,

        "max_mt5_accounts": 10,
        "max_symbols": 999,
        "max_strategies": 99,
        "all_symbols_visible": True,
        "all_strategies_visible": True,

        "max_account_equity": 0.0,

        "max_live_sessions": 10,
        "max_backtests_per_day": 999999,
        "max_mining_runs": 999999,

        "allow_ml_filter": True,
        "allow_regime_detection": True,
        "allow_api_access": True,
        "allow_multi_terminal": True,

        "support_response_hours": 4,
        "latency_tier": "priority",
        "api_access": "full",
        "custom_risk_rails": True,
        "early_access_symbols": True,
        "signal_channel": True,
        "custom_hub": True,
        "white_label": False,
        "dedicated_infrastructure": False,

        "features_json": json.dumps([
            "28,800 cycles per month",
            "Up to 10 MT5 accounts",
            "All symbols + early access",
            "Unlimited strategy mining",
            "Dedicated signal channel",
            "Full API",
            "Priority support",
            "Custom hub available",
        ]),
        "sort_order": 3,
    },

    # ------------------------------------------------------------------
    # FIRM XL  🏛 enterprise
    # ------------------------------------------------------------------
    {
        "code": "firm_xl",
        "name": "Firm XL",
        "description": "White-label infrastructure with dedicated resources.",
        "price_monthly": 1299.0,
        "price_yearly": 12990.0,
        "currency": "USD",

        "max_cycles": 48000,
        "cycles_expire": True,
        "trial_days": None,

        "max_mt5_accounts": 999,
        "max_symbols": 999,
        "max_strategies": 99,
        "all_symbols_visible": True,
        "all_strategies_visible": True,

        "max_account_equity": 0.0,

        "max_live_sessions": 999,
        "max_backtests_per_day": 999999,
        "max_mining_runs": 999999,

        "allow_ml_filter": True,
        "allow_regime_detection": True,
        "allow_api_access": True,
        "allow_multi_terminal": True,

        "support_response_hours": 1,
        "latency_tier": "dedicated",
        "api_access": "full",
        "custom_risk_rails": True,
        "early_access_symbols": True,
        "signal_channel": True,
        "custom_hub": True,
        "white_label": True,
        "dedicated_infrastructure": True,

        "features_json": json.dumps([
            "48,000 cycles per month (25 days of shared active engine time)",
            "Unlimited MT5 accounts",
            "White-label option",
            "Dedicated infrastructure",
            "Full API + webhooks",
            "Dedicated account manager",
            "Custom hub",
            "Custom volume pricing",
        ]),
        "sort_order": 4,
    },
]


def seed_plans(db: Session) -> None:
    """Idempotent — creates missing plans, updates existing ones."""
    for spec in DEFAULT_PLANS:
        existing = db.query(Plan).filter(Plan.code == spec["code"]).first()
        if not existing:
            db.add(Plan(**spec))
        else:
            for k, v in spec.items():
                if hasattr(existing, k):
                    setattr(existing, k, v)
    db.commit()