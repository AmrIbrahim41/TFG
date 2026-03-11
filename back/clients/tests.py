from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .models import Client, Subscription, ClientSubscription, TrainingSession


class TrainingSessionSecurityTest(TestCase):
    def setUp(self):
        self.client_api = APIClient()
        # إنشاء مدرب
        self.trainer = User.objects.create_user(
            username="trainer1", password="password"
        )
        self.client_api.force_authenticate(user=self.trainer)

        # إنشاء عميل واشتراكين مختلفين
        self.client_obj = Client.objects.create(name="Test Client", manual_id="001")
        self.plan = Subscription.objects.create(
            name="Plan A", units=10, duration_days=30
        )

        self.sub_1 = ClientSubscription.objects.create(
            client=self.client_obj, plan=self.plan, trainer=self.trainer
        )
        self.sub_2 = ClientSubscription.objects.create(
            client=self.client_obj, plan=self.plan, trainer=self.trainer
        )

        # إنشاء جلسة للاشتراك الأول، وجلسة للاشتراك الثاني
        self.session_sub_1 = TrainingSession.objects.create(
            subscription=self.sub_1, session_number=1, is_completed=True
        )
        self.session_sub_2 = TrainingSession.objects.create(
            subscription=self.sub_2, session_number=1, is_completed=True
        )

    def test_session_list_scoped_to_subscription(self):
        """التأكد من أن جلب جلسات اشتراك معين لا يُرجع جلسات اشتراكات أخرى"""
        # نطلب جلسات الاشتراك الأول فقط
        response = self.client_api.get(
            f"/api/training-sessions/?subscription_id={self.sub_1.id}&is_completed=true"
        )

        # التأكد من نجاح الطلب
        self.assertEqual(response.status_code, 200)

        # التأكد من أن الجلسة الراجعة هي الخاصة بالاشتراك الأول فقط
        if isinstance(response.data, dict) and "results" in response.data:
            returned_ids = [s["id"] for s in response.data["results"]]
        else:
            returned_ids = [s["id"] for s in response.data]
            self.assertIn(self.session_sub_1.id, returned_ids)

        # الاختبار الأهم: التأكد من أن جلسة الاشتراك الثاني لم تتسرب!
        self.assertNotIn(self.session_sub_2.id, returned_ids)
