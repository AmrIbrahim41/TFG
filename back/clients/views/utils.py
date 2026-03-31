"""
views/utils.py — Pagination classes and shared view-level helper functions.
"""

from decimal import Decimal

from django.db.models import F, OuterRef, Subquery, DecimalField, ExpressionWrapper
from rest_framework.pagination import PageNumberPagination

from ..models import ClientSubscription, GroupSessionParticipant


# ---------------------------------------------------------------------------
# PAGINATION
# ---------------------------------------------------------------------------

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 100


class HistoryPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


# ---------------------------------------------------------------------------
# CLIENT DICT BUILDER
# ---------------------------------------------------------------------------

def _build_client_dict(sub: ClientSubscription, request) -> dict:
    """
    Converts a ClientSubscription instance to a standardised dict for API responses.
    Requires sub to be select_related with 'client' and 'plan'.
    """
    photo_url = None
    if sub.client.photo:
        try:
            photo_url = request.build_absolute_uri(sub.client.photo.url)
        except Exception:
            pass
    return {
        "id": sub.client.id,
        "subscription_id": sub.id,
        "name": sub.client.name,
        "manual_id": sub.client.manual_id,
        "is_child": sub.client.is_child,
        "plan": sub.plan.name if sub.plan else "No Plan",
        "sessions_used": sub.sessions_used,
        "total_sessions": sub.plan.units if sub.plan else 0,
        "photo": photo_url,
        "end_date": sub.end_date,
    }


# ---------------------------------------------------------------------------
# GROUP REVENUE ADJUSTMENT CALCULATOR
# ---------------------------------------------------------------------------

def _compute_group_adjustments(month: int, year: int) -> dict:
    """
    Returns { trainer_id: Decimal } representing net revenue adjustments for
    cross-trainer group-session completions in the given month/year.
    A positive value means the trainer gained revenue; negative means they lost it.

    Uses a correlated Subquery (one per annotated field) to guarantee exactly one
    result row per GroupSessionParticipant — no JOIN fan-out, no collapsing.
    """
    active_sub = ClientSubscription.objects.filter(
        client=OuterRef("client"),
        is_active=True,
        plan__units__gt=0,
        trainer__isnull=False,
    ).order_by("-start_date")

    qs = (
        GroupSessionParticipant.objects.filter(
            deducted=True,
            client__isnull=False,
            session__date__month=month,
            session__date__year=year,
            session__coach__isnull=False,
        )
        .annotate(
            coach_id_ann=F("session__coach_id"),
            owner_id_ann=Subquery(active_sub.values("trainer_id")[:1]),
            price_ann=Subquery(active_sub.values("plan__price")[:1]),
            units_ann=Subquery(active_sub.values("plan__units")[:1]),
        )
        .filter(
            owner_id_ann__isnull=False,
            price_ann__isnull=False,
            units_ann__isnull=False,
        )
        .exclude(coach_id_ann=F("owner_id_ann"))
        .values("id", "coach_id_ann", "owner_id_ann", "price_ann", "units_ann")
    )

    adjustments: dict = {}
    for row in qs:
        if not row["units_ann"]:
            continue
        session_value = Decimal(str(row["price_ann"])) / Decimal(str(row["units_ann"]))
        owner = row["owner_id_ann"]
        coach = row["coach_id_ann"]
        adjustments[owner] = adjustments.get(owner, Decimal(0)) - session_value
        adjustments[coach] = adjustments.get(coach, Decimal(0)) + session_value

    return adjustments


# ---------------------------------------------------------------------------
# LEGACY TYPE MAPPER
# ---------------------------------------------------------------------------

def _legacy_type_to_category(type_str: str) -> str:
    mapping = {
        "strength": "weight",
        "cardio": "time",
        "time": "time",
        "weight": "weight",
        "reps": "reps",
    }
    return mapping.get((type_str or "").lower(), "weight")
