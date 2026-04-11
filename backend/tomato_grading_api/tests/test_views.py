"""
tests/test_views.py
Run with:  python manage.py test tomato_grading_api.tests
"""
import io
from unittest.mock import patch, MagicMock
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

MOCK_PREDICTION = {
    "grade": "Grade A", "grade_code": "A", "confidence": 97.3,
    "confidence_level": "high", "description": "Premium quality.",
    "marketable": True, "color_hint": "#27ae60",
    "all_probabilities": {"Grade A": 97.3, "Grade B": 1.5, "Grade C": 0.8, "Reject": 0.4},
    "inference_time_ms": 42.1, "model_version": "1.0.0", "manual_review": False,
}

def _make_image():
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (100, 100), (200, 50, 50)).save(buf, format="JPEG")
    buf.seek(0); buf.name = "tomato.jpg"
    return buf

class HealthTest(TestCase):
    def test_health_public(self):
        with patch("tomato_grading_api.views._get_grader", return_value=None):
            resp = self.client.get("/api/v1/health/")
        self.assertIn(resp.status_code, [200, 503])

class AuthTest(TestCase):
    def setUp(self): self.client = APIClient()
    def test_register(self):
        resp = self.client.post("/api/v1/auth/register/",
            {"username": "farmer1", "email": "f@x.com", "password": "Pass12345"}, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertIn("access", resp.data["tokens"])
    def test_login(self):
        User.objects.create_user("u2", "u2@x.com", "Pass12345")
        resp = self.client.post("/api/v1/auth/login/",
            {"username": "u2", "password": "Pass12345"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)

class GradingTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user("g1", "g@x.com", "Pass12345")
        self.client.force_authenticate(user=self.user)
    def test_grade_success(self):
        with patch("tomato_grading_api.views._get_grader") as mg:
            mg.return_value = MagicMock(predict_from_bytes=MagicMock(return_value=MOCK_PREDICTION))
            resp = self.client.post("/api/v1/grade/", {"image": _make_image()}, format="multipart")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["grade"], "Grade A")
    def test_grade_no_auth(self):
        self.client.force_authenticate(user=None)
        resp = self.client.post("/api/v1/grade/", {"image": _make_image()}, format="multipart")
        self.assertEqual(resp.status_code, 401)
    def test_grade_no_file(self):
        resp = self.client.post("/api/v1/grade/", {}, format="multipart")
        self.assertEqual(resp.status_code, 400)
    def test_model_unavailable(self):
        with patch("tomato_grading_api.views._get_grader", return_value=None):
            resp = self.client.post("/api/v1/grade/", {"image": _make_image()}, format="multipart")
        self.assertEqual(resp.status_code, 503)

class HistoryTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user("h1", "h@x.com", "Pass12345")
        self.client.force_authenticate(user=self.user)
    def test_history_empty(self):
        resp = self.client.get("/api/v1/history/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["count"], 0)
    def test_analytics_empty(self):
        resp = self.client.get("/api/v1/analytics/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["total_graded"], 0)
