# Community Setup Guide

This guide walks you through setting up the community features we've prepared for you.

---

## ✅ Already Done

These files have been automatically created:

- ✅ Issue templates (`.github/ISSUE_TEMPLATE/`)
- ✅ Labels config (`.github/labels.json`)
- ✅ Stale issues workflow (`.github/workflows/close-stale-issues.yml`)
- ✅ Community guide (`.COMMUNITY.md`)
- ✅ Security policy (`.SECURITY.md`)

---

## 📝 Step 1: Create GitHub Labels

GitHub doesn't auto-import labels, so you'll need to create them manually. We've provided a script to help:

### Option A: Use the Provided Script (Automatic)

```bash
# Make script executable
chmod +x .github/create-labels.sh

# Run it
.github/create-labels.sh
```

**Requirements:**
- [GitHub CLI](https://cli.github.com) installed
- Authenticated: `gh auth login`
- Admin access to the repository

### Option B: Create Labels Manually (UI)

1. Go to your repo → **Settings** → **Labels**
2. Click **New label**
3. For each label in `.github/labels.json`, enter:
   - **Name**: `bug`, `enhancement`, `discussion`, etc.
   - **Color**: Copy from the JSON
   - **Description**: Copy from the JSON
4. Click **Create label**

The JSON has 15 labels. This takes ~5 minutes.

---

## 💬 Step 2: Enable GitHub Discussions

Discussions allow community conversations without creating issues.

1. Go to your repo → **Settings**
2. Scroll down to **Features**
3. Check the ✅ **Discussions** checkbox
4. Click **Save**

That's it! Users can now post in Discussions.

---

## 🗺️ Step 3: Create a Public Roadmap (GitHub Project)

Show the community what you're working on:

1. Go to your repo → **Projects** tab (top navigation)
2. Click **New project**
3. **Name**: "Road Map" or "Feature Roadmap"
4. **Description**: "Public view of planned features and bugs"
5. **Visibility**: **Public**
6. **Template**: Pick either blank or "Table"
7. Click **Create project**

**Set up columns:**

Blank projects give you freedom. Here's a suggested structure:

| Column | Purpose |
|--------|---------|
| **📋 Backlog** | Not yet started |
| **🔍 In Review** | Being evaluated |
| **⏳ Planned** | Approved, waiting to start |
| **🚀 In Progress** | Currently being built |
| **✅ Done** | Released or completed |

To create columns:
1. Click **+ Add column** in your project
2. Choose **Single select** for the type
3. Name it and add options (Backlog, Planned, In Progress, Done)
4. Use **Drag to rank** for priority

**Link issues to the project:**

1. Go to an issue
2. Scroll down → **Projects** section
3. Click **Add project**
4. Select your roadmap project
5. Set its status (Backlog, Planned, etc.)

---

## 📊 Step 4: Configure Auto-Close for Stale Issues (Optional)

The workflow is already created and will run automatically. It:

- Waits 30 days of inactivity
- Marks issues as "stale" with a warning comment
- Closes them 7 days later if still inactive
- Preserves issues labeled `pinned`, `security`, or `help-wanted`

To customize, edit `.github/workflows/close-stale-issues.yml`:

```yaml
days-before-stale: 30    # Change to your preference
days-before-close: 7     # Days to wait before closing
```

---

## 📚 Step 5: Update Repository Links (Documentation)

All these files are ready to go:

- **COMMUNITY.md** — Explains how to report bugs, request features, and contribute
- **SECURITY.md** — Instructions for reporting security vulnerabilities
- **README.md** — Now links to COMMUNITY.md

They're already integrated into the repo and linked from README.

---

## 🎯 What Community Members Will See

When someone visits your repo, they'll find:

1. **README.md** with links to COMMUNITY.md and SECURITY.md
2. **Issues** with clear templates for:
   - Bug reports
   - Feature requests
   - Discussions
3. **Labels** that organize issues by type, priority, and status
4. **Discussions** for Q&A and conversations
5. **Public Roadmap** showing what's being worked on

---

## 🚀 After Setup

### When You Get Issues:
1. Review the submission
2. Apply appropriate labels (`bug`, `enhancement`, `priority-*`)
3. Assign to the roadmap (if it's planned work)
4. Respond with next steps

### When Accepting PRs:
1. Use the existing PR template (already in place)
2. Require tests from contributors
3. Add `status-review` label during development
4. Close with `fixes #123` to link to the issue

### Maintaining the Roadmap:
1. Update project status as work progresses
2. Move issues between columns
3. Let community see what's coming next

---

## 📞 Questions?

- **Setup stuck?** Check GitHub's docs: https://docs.github.com/en/communities
- **Labels not matching?** Edit `.github/labels.json` and re-run script
- **Want to customize?** All files are editable—make them your own!

---

## Checklist

Make sure you've completed:

- [ ] Created labels (script or manual)
- [ ] Enabled Discussions
- [ ] Created public roadmap project
- [ ] Reviewed COMMUNITY.md
- [ ] Pushed all files to main

Then you're ready for community engagement! 🎉
