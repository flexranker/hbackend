#!/bin/bash
set -e

echo "🚀 Hackathon backend bootstrap"

# Copy env templates if not already present
[ ! -f .env ] && cp .env.example .env && echo "✅ Created backend .env"
[ ! -f fireconfig.json ] && cp fireconfig.example.json fireconfig.json && echo "✅ Created fireconfig.json (fill in credentials)"

# Optional: Handle frontend if it's in a sibling directory
# if [ -d "../hackathon-frontend" ]; then
#   [ ! -f ../hackathon-frontend/.env.local ] && cp ../hackathon-frontend/.env.example ../hackathon-frontend/.env.local && echo "✅ Created frontend .env.local"
# fi

echo ""
echo "⚠️  Next steps:"
echo "  1. Add your Firebase credentials to fireconfig.json"
echo "  2. Set ADMIN_UIDS in .env"
echo "  3. Run: docker-compose up"
echo ""
echo "📺 Emulator UI: http://localhost:4000"
echo "⚙️  Backend:     http://localhost:3001"
echo "🖥️  Frontend:    (See frontend README)"
