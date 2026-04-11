#!/usr/bin/env bash
# setup.sh — First-time project setup
# Run once:  bash scripts/setup.sh
set -e
echo ""
echo "════════════════════════════════════════"
echo "  🍅  Tomato Grading API — Setup"
echo "════════════════════════════════════════"

source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate tomato_grading

echo "➤ Installing dependencies..."
pip install -r requirements.txt

if [ ! -f .env ]; then
    cp .env.example .env
    echo "➤ .env created — edit MODEL_DIR before starting"
fi

mkdir -p models logs media staticfiles
echo "➤ Directories: models/ logs/ media/ staticfiles/"

echo "➤ Running migrations..."
python manage.py migrate

echo "➤ Verifying ML model..."
python manage.py verify_model || echo "⚠️  Add .pkl files to models/ and rerun"

echo ""
echo "════════════════════════════════════════"
echo "  ✅  Setup complete!"
echo "  Next:"
echo "    1. Copy .pkl files → models/"
echo "    2. python manage.py createsuperuser"
echo "    3. python manage.py runserver"
echo "    4. http://localhost:8000/api/docs/"
echo "════════════════════════════════════════"
