# 🍅 Tomato Grading API

REST API that grades tomatoes **A / B / C / Reject** according to Zimbabwean market standards.
Built with Django REST Framework + Random Forest ML model (99.17% accuracy).

---

## Folder Structure

```
tomato_api/
├── manage.py
├── requirements.txt
├── .env.example                    ← copy to .env
├── models/                         ← place .pkl files here
│   ├── tomato_grader_rf_pipeline.pkl
│   └── model_metadata.json
│
├── tomato_api/                     ← Django project config
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
│
├── tomato_grading_api/             ← main Django app
│   ├── models.py                   ← DB models
│   ├── serializers.py              ← input/output shapes
│   ├── views.py                    ← all API endpoints
│   ├── urls.py                     ← URL routing
│   ├── admin.py                    ← Django admin
│   ├── apps.py                     ← loads ML model at startup
│   ├── migrations/
│   ├── management/commands/
│   │   └── verify_model.py
│   └── tests/
│       └── test_views.py
│
├── ml_engine/                      ← ML feature extraction + predictor
│   └── predictor.py
│
├── scripts/
│   └── setup.sh
└── logs/
```

---

## Quick Start

```bash
# 1. Activate your conda environment
conda activate tomato_grading

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env — set MODEL_DIR to where your .pkl files are

# 4. Place model files
cp /path/to/tomato_grader_rf_pipeline.pkl  models/
cp /path/to/model_metadata.json            models/

# 5. Run migrations
python manage.py migrate

# 6. Verify model loads correctly
python manage.py verify_model

# 7. Create admin user
python manage.py createsuperuser

# 8. Start server
python manage.py runserver
```

---

## API Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| `POST` | `/api/v1/grade/` | ✅ | Grade one tomato image |
| `POST` | `/api/v1/grade/batch/` | ✅ | Grade up to 50 images |
| `GET`  | `/api/v1/history/` | ✅ | My grading history |
| `GET`  | `/api/v1/history/<id>/` | ✅ | Session detail |
| `DELETE` | `/api/v1/history/<id>/` | ✅ | Delete session |
| `POST` | `/api/v1/feedback/` | ✅ | Submit human correction |
| `GET`  | `/api/v1/analytics/` | ✅ | Aggregated stats |
| `POST` | `/api/v1/auth/register/` | ❌ | Create account |
| `POST` | `/api/v1/auth/login/` | ❌ | Get JWT tokens |
| `POST` | `/api/v1/auth/refresh/` | ❌ | Refresh access token |
| `POST` | `/api/v1/auth/logout/` | ✅ | Blacklist refresh token |
| `GET`  | `/api/v1/auth/me/` | ✅ | User profile + stats |
| `GET`  | `/api/v1/health/` | ❌ | System health check |

**Interactive docs:** http://localhost:8000/api/docs/

---

## Grading a Tomato (example)

```bash
# 1. Register
curl -X POST http://localhost:8000/api/v1/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"farmer1","email":"f@farm.com","password":"Pass12345"}'

# 2. Grade an image  (use the access token from step 1)
curl -X POST http://localhost:8000/api/v1/grade/ \
  -H "Authorization: Bearer <access_token>" \
  -F "image=@/path/to/tomato.jpg"
```
############################################
**Response:**
```json
{
  "session_id":        "uuid",
  "grade":             "Grade A",
  "grade_code":        "A",
  "confidence":        97.3,
  "confidence_level":  "high",
  "description":       "Premium quality. Deep red...",
  "marketable":        true,
  "color_hint":        "#27ae60",
  "all_probabilities": {"Grade A": 97.3, "Grade B": 1.5, "Grade C": 0.8, "Reject": 0.4},
  "inference_time_ms": 38.4,
  "manual_review":     false,
  "image_url":         "http://localhost:8000/media/grading/...",
  "created_at":        "2024-03-01T10:00:00Z"
}
```

---

## Running Tests

```bash
python manage.py test tomato_grading_api.tests
```

---

## Production Deployment

```bash
# Set DEBUG=False in .env
# Use PostgreSQL (set DB_* vars in .env)
# Collect static files
python manage.py collectstatic
# Run with gunicorn
gunicorn tomato_api.wsgi:application --workers 4 --bind 0.0.0.0:8000
```
