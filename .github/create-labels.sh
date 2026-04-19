#!/bin/bash
# Script to create GitHub labels from labels.json
# Requires: GitHub CLI (gh) installed and authenticated
# Run from repo root: bash .github/create-labels.sh

set -e

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
LABELS_FILE=".github/labels.json"

if [ ! -f "$LABELS_FILE" ]; then
    echo "❌ Error: $LABELS_FILE not found"
    exit 1
fi

echo "📝 Creating labels for $REPO..."
echo ""

# Parse JSON and create each label
jq -r '.[] | "\(.name)|\(.color)|\(.description)"' "$LABELS_FILE" | while IFS='|' read -r name color description; do
    # Check if label already exists
    if gh label list --repo "$REPO" | grep -q "^$name"; then
        echo "⏭️  Skipped: $name (already exists)"
    else
        gh label create "$name" \
            --repo "$REPO" \
            --color "$color" \
            --description "$description" 2>/dev/null
        echo "✅ Created: $name"
    fi
done

echo ""
echo "✨ Labels setup complete!"
echo "View them at: https://github.com/$REPO/labels"
