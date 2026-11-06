"""H18 decision-support adapter.

This module deliberately does not approve/reject credit or invent loan terms.
It only converts the frozen H12/H16 review threshold into a human-review signal.
"""

DECISION_SUPPORT_VERSION = "finrisk_h18_review_adapter_v1"


def build_decision_support(score_result, release_metadata=None):
    if score_result.get("status") != "ok":
        raise ValueError("Decision support requires a successful model score.")

    review = bool(score_result.get("review_recommended"))
    threshold = score_result.get("decision_threshold")
    policy_version = score_result.get("threshold_policy_version")
    signal = "MANUAL_REVIEW_RECOMMENDED" if review else "NO_REVIEW_SIGNAL"

    return {
        "decision_support_version": DECISION_SUPPORT_VERSION,
        "signal": signal,
        "review_recommended": review,
        "risk_score": score_result.get("risk_score"),
        "decision_threshold": threshold,
        "threshold_policy_version": policy_version,
        "policy_basis": "frozen_model_threshold_only",
        "automatic_credit_decision": False,
        "business_policy_status": "NOT_APPROVED",
        "recommended_amount": None,
        "recommended_term_months": None,
        "interest_rate": None,
        "monthly_payment": None,
        "scenario_changes_model_score": False,
        "h16_release_stage": (release_metadata or {}).get("release_stage"),
        "formal_gk_review": (release_metadata or {}).get("formal_GK_review", "PENDING"),
        "notes": [
            "The H12 threshold is a demo review threshold selected on validation, not a bank approval policy.",
            "Loan amount/term scenarios are separate from the frozen model score.",
            "A human reviewer remains responsible for any credit decision.",
        ],
    }
