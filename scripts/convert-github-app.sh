#!/usr/bin/env bash
set -euo pipefail
: "${1:?Usage: scripts/convert-github-app.sh CODE}"
gh api --method POST "/app-manifests/$1/conversions" > app-credentials.json
jq -r '.pem' app-credentials.json > private-key.pem
chmod 600 private-key.pem app-credentials.json
printf '\nGitHub App ID: %s\nClient ID: %s\n' "$(jq -r '.id' app-credentials.json)" "$(jq -r '.client_id' app-credentials.json)"
printf 'Add the client ID and client secret from app-credentials.json to Vercel as GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.\n'
