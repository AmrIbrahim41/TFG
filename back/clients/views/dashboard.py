import calendar
from decimal import Decimal

from django.contrib.auth.models import User
from django.db.models import (
    Sum, Count, Q, F, Case, When, DecimalField, ExpressionWrapper,
)
from django.db.models.functions import TruncMonth
from django.utils import timezone

from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import ClientSubscription, TrainingSession, GroupSessionParticipant
from .utils import _build_client_dict, _compute_group_adjustments


class DashboardAnalyticsViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"])
    def stats(self, request):
        user = request.user
        now = timezone.now()
        is_rec = user.groups.filter(name="REC").exists()

        try:
            month = int(request.query_params.get("month", now.month))
            year = int(request.query_params.get("year", now.year))
        except (ValueError, TypeError):
            month, year = now.month, now.year

        # ── VIEW 1: TRAINER ───────────────────────────────────────────────
        if not user.is_superuser and not is_rec:
            base_revenue = ClientSubscription.objects.filter(
                trainer=user, created_at__month=month, created_at__year=year
            ).aggregate(total=Sum("plan__price"))["total"] or Decimal(0)

            _session_value_expr = ExpressionWrapper(
                F("subscription__plan__price") / F("subscription__plan__units"),
                output_field=DecimalField(max_digits=12, decimal_places=4),
            )

            deduction_amount = TrainingSession.objects.filter(
                subscription__trainer=user,
                is_completed=True,
                date_completed__month=month,
                date_completed__year=year,
                subscription__plan__units__gt=0,
            ).exclude(completed_by=user).exclude(completed_by=None).annotate(
                session_value=_session_value_expr
            ).aggregate(total=Sum("session_value"))["total"] or Decimal(0)

            addition_amount = TrainingSession.objects.filter(
                completed_by=user,
                is_completed=True,
                date_completed__month=month,
                date_completed__year=year,
                subscription__plan__units__gt=0,
            ).exclude(subscription__trainer=user).annotate(
                session_value=_session_value_expr
            ).aggregate(total=Sum("session_value"))["total"] or Decimal(0)

            group_adj = _compute_group_adjustments(month, year)
            my_group_adj = group_adj.get(user.id, Decimal(0))
            if my_group_adj > 0:
                addition_amount += my_group_adj
            else:
                deduction_amount += abs(my_group_adj)

            net_revenue = base_revenue - deduction_amount + addition_amount

            subs = ClientSubscription.objects.filter(
                trainer=user, is_active=True
            ).select_related("client", "plan")

            client_list = [_build_client_dict(sub, request) for sub in subs]

            return Response({
                "role": "trainer",
                "summary": {
                    "active_clients": len(client_list),
                    "base_revenue": round(base_revenue, 2),
                    "net_revenue": round(net_revenue, 2),
                    "deductions": round(deduction_amount, 2),
                    "additions": round(addition_amount, 2),
                },
                "clients": client_list,
            })

        # ── VIEW 2: RECEPTIONIST ──────────────────────────────────────────
        elif is_rec:
            active_members_count = ClientSubscription.objects.filter(is_active=True).count()
            current_month_qs = ClientSubscription.objects.filter(
                created_at__month=month, created_at__year=year
            )
            new_sales_count = current_month_qs.count()

            today = timezone.now().date()
            checkins_today = TrainingSession.objects.filter(
                is_completed=True, date_completed=today
            ).count()
            group_checkins_today = GroupSessionParticipant.objects.filter(
                session__date__date=today,
                deducted=True,
            ).count()

            recent_subs = current_month_qs.select_related(
                "client", "plan", "trainer"
            ).order_by("-created_at")[:10]
            recent_list = [
                {
                    "id": sub.id,
                    "client_name": sub.client.name,
                    "plan_name": sub.plan.name if sub.plan else "-",
                    "trainer_name": (
                        sub.trainer.first_name if sub.trainer else "Unassigned"
                    ),
                    "date": sub.created_at.date(),
                }
                for sub in recent_subs
            ]

            return Response({
                "role": "rec",
                "summary": {
                    "active_members": active_members_count,
                    "new_sales_this_month": new_sales_count,
                    "visits_today": checkins_today + group_checkins_today,
                },
                "recent_sales": recent_list,
            })

        # ── VIEW 3: ADMIN ─────────────────────────────────────────────────
        else:
            trainers = (
                User.objects.filter(is_superuser=False)
                .exclude(groups__name="REC")
                .annotate(
                    active_packages=Count(
                        "clientsubscription",
                        filter=Q(clientsubscription__is_active=True),
                    ),
                    inactive_packages=Count(
                        "clientsubscription",
                        filter=Q(clientsubscription__is_active=False),
                    ),
                    total_assigned=Count("clientsubscription"),
                    base_monthly_revenue=Sum(
                        Case(
                            When(
                                clientsubscription__created_at__month=month,
                                clientsubscription__created_at__year=year,
                                then=F("clientsubscription__plan__price"),
                            ),
                            default=0,
                            output_field=DecimalField(),
                        )
                    ),
                )
            )

            cross_session_value_expr = ExpressionWrapper(
                F("subscription__plan__price") / F("subscription__plan__units"),
                output_field=DecimalField(max_digits=12, decimal_places=4),
            )

            cross_base_qs = (
                TrainingSession.objects.filter(
                    date_completed__month=month,
                    date_completed__year=year,
                    is_completed=True,
                    subscription__plan__units__gt=0,
                )
                .exclude(completed_by=F("subscription__trainer"))
                .exclude(completed_by=None)
                .exclude(subscription__trainer=None)
            )

            deductions_qs = (
                cross_base_qs.annotate(session_value=cross_session_value_expr)
                .values("subscription__trainer")
                .annotate(total=Sum("session_value"))
                .values_list("subscription__trainer", "total")
            )

            additions_qs = (
                cross_base_qs.annotate(session_value=cross_session_value_expr)
                .values("completed_by")
                .annotate(total=Sum("session_value"))
                .values_list("completed_by", "total")
            )

            adjustments: dict = {}
            for trainer_id, total_lost in deductions_qs:
                if trainer_id is not None:
                    adjustments[trainer_id] = (
                        adjustments.get(trainer_id, Decimal(0)) - (total_lost or Decimal(0))
                    )
            for trainer_id, total_gained in additions_qs:
                if trainer_id is not None:
                    adjustments[trainer_id] = (
                        adjustments.get(trainer_id, Decimal(0)) + (total_gained or Decimal(0))
                    )

            group_adj = _compute_group_adjustments(month, year)
            for trainer_id, amount in group_adj.items():
                adjustments[trainer_id] = adjustments.get(trainer_id, Decimal(0)) + amount

            trainers_stats = []
            for trainer in trainers:
                base = trainer.base_monthly_revenue or Decimal(0)
                adjustment = adjustments.get(trainer.id, Decimal(0))
                net = base + adjustment
                trainers_stats.append({
                    "id": trainer.id,
                    "name": trainer.first_name or trainer.username,
                    "active_packages": trainer.active_packages,
                    "inactive_packages": trainer.inactive_packages,
                    "total_assigned": trainer.total_assigned,
                    "base_revenue": round(base, 2),
                    "adjustments": round(adjustment, 2),
                    "net_revenue": round(net, 2),
                })

            current_month_qs = ClientSubscription.objects.filter(
                created_at__month=month, created_at__year=year
            )
            total_sales = current_month_qs.count()
            total_revenue_sales = (
                current_month_qs.aggregate(total=Sum("plan__price"))["total"] or 0
            )

            chart_data = (
                ClientSubscription.objects.filter(created_at__year=year)
                .annotate(month=TruncMonth("created_at"))
                .values("month")
                .annotate(revenue=Sum("plan__price"))
                .order_by("month")
            )

            revenue_map = {item["month"].month: item["revenue"] for item in chart_data}
            formatted_chart = [
                {"name": calendar.month_name[i][:3], "revenue": revenue_map.get(i, 0)}
                for i in range(1, 13)
            ]

            return Response({
                "role": "admin",
                "trainers_overview": trainers_stats,
                "financials": {
                    "month": month,
                    "year": year,
                    "total_sales": total_sales,
                    "total_revenue": total_revenue_sales,
                    "chart_data": formatted_chart,
                },
            })
