---
name: README Marketplace Enhancement
overview: Enhance the README.md file to improve VS Code Marketplace conversion rates by adding GIFs, better visual hierarchy, and clearer value proposition. This is a draft plan open for discussion and refinement.
todos: []
---

# README Marketplace Enhancement (Draft - Open for Discussion)

## Problem Statement

The current README is text-heavy and lacks visual demonstrations. It doesn't quickly communicate the extension's value, which may be limiting marketplace installs. Top VS Code extensions use GIFs, clear hero sections, and visual demonstrations to drive conversions.

**Key Insight:** Based on user experience, seeing a solid GIF at the start of a README significantly increases install likelihood. Static PNG screenshots don't show interactions and don't convert as well. Therefore, we're adopting a **GIF-first approach** - drop PNGs entirely and lead with compelling animated demonstrations.

## Current State Analysis

**What exists:**

- README.md with comprehensive content but poor visual hierarchy
- Static PNG screenshots in `marketplace-assets/screenshots/` (7 images)
- Good feature descriptions but buried in text
- Installation instructions are detailed but not immediately visible
- No GIFs showing interactions

**Pain points:**

- Users can't quickly see what the extension does
- Static screenshots don't show interactions (drag-drop, table editing, etc.)
- Value proposition isn't immediately obvious
- First impression on marketplace may not be compelling

## Proposed Solution

### 1. Structure Changes

**New README Layout (Critical Features First - GIF-First Approach):**

1. **Hero Section** (centered, above fold)

- Title + tagline
- Badges row
- Quick action links (Install, Docs, Report Bug, Request Feature)
- **Decision:** Drop all PNG screenshots from main README - GIFs only

2. **Critical Feature Demos** (GIFs organized by priority - PRIMARY CONTENT)

- **Feature Demo #1: WYSIWYG Editing** (FIRST GIF - most critical)
  - Large GIF showing real-time formatting as you type
  - This is the core value proposition - must be first
- **Feature Demo #2: Advanced Table Editing** (SECOND GIF)
  - Drag-to-resize, context menus, toolbar controls
- **Feature Demo #3: Drag & Drop Images** (THIRD GIF)
  - Drag images, resize handles, metadata overlay
- **Feature Demo #4: Link Dialog** (FOURTH GIF)
  - Insert/edit links, URL validation, auto-linking
- **Feature Demo #5: Outline View in Sidebar** (FIFTH GIF)
  - Document navigation, heading tree, quick jump to sections
- **Feature Demo #6: Mermaid Diagrams** (SIXTH GIF)
  - Templates, double-click editing, live preview
- Each GIF with clear title and brief description
- **Rationale:** One focused GIF per critical feature is clearer than one "hero" GIF trying to show everything

3. **Value Proposition** (after feature demos)

- "What Makes This Different?" section
- Bullet points with emojis highlighting key benefits
- Free forever message

4. **Quick Start** (3 clear steps)

- Simplified from current detailed installation
- Visual flow: Install → Open → Write

5. **Before vs After** (comparison table)

- Side-by-side comparison of traditional markdown vs Markdown for Humans

6. **Key Features** (reorganized, text-based)

- Keep existing feature descriptions
- Add emojis for visual hierarchy
- Group related features
- **No screenshots** - GIFs above handle visual demonstration

7. **Documentation** (keep existing)

- Maintain current documentation links

**Removed:**

- Screenshots Gallery section (PNGs removed from main README)
- All static PNG images from feature sections

### 2. GIF Requirements (Critical Features - Priority Order)

**6 GIFs to create (organized by critical feature priority):**

1. **`wysiwyg-editing.gif`** (8-12 seconds) - **FIRST GIF - MOST CRITICAL**

- **This is the first GIF users see** - must be compelling and clear
- Show typing markdown text with real-time formatting
- Click multiple toolbar buttons (bold, italic, heading, list)
- Show smooth transitions and formatting changes
- Toggle source view to show both modes
- **Purpose:** Immediately demonstrate core value - "this is WYSIWYG editing"
- **Priority:** Highest - this is the main differentiator

2. **`table-editing.gif`** (6-10 seconds) - **SECOND GIF**

- Drag column border to resize (show smooth interaction)
- Right-click menu (add row, delete row)
- Toolbar dropdown (add column)
- **Priority:** High - advanced table editing is a key feature

3. **`drag-drop-images.gif`** (5-7 seconds) - **THIRD GIF**

- Drag image from desktop/finder
- Drop into editor
- Show resize handles appearing
- Resize image with handles
- Show metadata overlay on hover
- **Priority:** High - image handling is important for writers

4. **`link-dialog.gif`** (5-7 seconds) - **FOURTH GIF**

- Select text and click link button (or Ctrl+K L / Cmd+K L)
- Show link dialog appearing
- Enter URL and link text
- Show link being created and clickable
- Edit existing link (click on link, edit dialog)
- Auto-linking (paste URL, becomes clickable)
- **Priority:** High - links are essential for markdown writing

5. **`outline-view.gif`** (5-7 seconds) - **FIFTH GIF**

- Show sidebar with "Markdown for Humans: Outline" panel
- Show document headings tree structure
- Click heading in outline → jump to that section in editor
- Show outline updating as headings are added/modified
- Filter/search headings in outline
- **Priority:** High - navigation is important for long documents

6. **`mermaid-diagrams.gif`** (8-12 seconds) - **SIXTH GIF**

- Click Mermaid button in toolbar
- Show template dropdown (15 templates visible)
- Select template (e.g., flowchart)
- Show diagram render
- Double-click to edit
- **Priority:** Medium - nice-to-have feature, but less critical than core editing

**GIF Organization Rationale:**
- Each GIF focuses on ONE clear feature (not trying to show everything)
- Ordered by importance: WYSIWYG (core) → Tables → Images → Links → Outline → Mermaid
- First GIF (WYSIWYG) is the conversion driver - shows main value immediately
- Subsequent GIFs demonstrate advanced features in priority order
- Link dialog and outline view are important UX features that show VS Code integration

**GIF Specifications:**

- Location: `marketplace-assets/gifs/` (new directory)
- Size: Each <5MB (optimized for web)
- Format: GIF (autoplay, no controls needed)
- Dimensions: 1280x720 or 1920x1080 (consistent)
- Frame rate: 30fps (record at 60fps, export at 30fps)

**Content Quality Requirements - CRITICAL:**

- **Use realistic, high-quality markdown content** - not placeholder text or lorem ipsum
- Content should look like real-world usage - professional, authentic, relatable
- **Why:** Real content makes the demo more compelling and shows the extension in actual use cases
- Users can better imagine themselves using it when they see realistic examples

**Content Guidelines for Each GIF:**

1. **WYSIWYG Editing GIF:**
   - Use actual article/blog post content (e.g., "Getting Started with Markdown" tutorial)
   - Include real headings, paragraphs, lists, and formatting
   - Show a complete thought or section, not random text
   - Example: Write a short guide about a real topic (productivity, coding, etc.)

2. **Table Editing GIF:**
   - Use a realistic table (e.g., project timeline, feature comparison, budget breakdown)
   - Include meaningful column headers and data
   - Show actual use case (not "Column 1, Column 2, Data 1, Data 2")
   - Example: Feature comparison table, project roadmap, expense tracking

3. **Drag & Drop Images GIF:**
   - Use a real image (screenshot, diagram, or photo)
   - Show it in context of actual content (not empty document)
   - Image should be relevant to the surrounding text
   - Example: Screenshot of a feature, diagram explaining a concept, product photo

4. **Link Dialog GIF:**
   - Use real URLs (GitHub repos, documentation sites, blog posts)
   - Show links in context of actual content
   - Link text should be meaningful (not "click here")
   - Example: Link to documentation, reference articles, related resources

5. **Outline View GIF:**
   - Use a document with realistic structure (multiple sections, subsections)
   - Headings should form a logical document outline
   - Show a document that would actually benefit from outline navigation
   - Example: Technical documentation, article with multiple sections, project plan

6. **Mermaid Diagrams GIF:**
   - Use a diagram that makes sense in context
   - Show a real use case (workflow, architecture, process)
   - Diagram should be relevant to surrounding content
   - Example: Development workflow, system architecture, decision tree

**Content Creation Tips:**

- **Prepare content beforehand** - Don't create content while recording (pauses look unprofessional)
- **Use a real document** - Start with an existing markdown file or create a complete one before recording
- **Make it relatable** - Content should resonate with target audience (writers, developers, technical writers)
- **Show variety** - Different GIFs can use different content types (tutorial, documentation, article, etc.)
- **Keep it clean** - Remove any personal/sensitive information from demo content
- **Test content** - Ensure content looks good in the editor (proper formatting, readable, professional)

### 3. Content Changes

**Hero Section:**

- Center-align title and tagline (no GIF here - keep it clean)
- Badges row
- Quick action links (Install, Docs, Report Bug, Request Feature)
- Make "100% free" message more prominent
- **No PNG screenshots** - GIFs come immediately after in feature demos

**Critical Feature Demos Section (GIF-First):**

- **First GIF: WYSIWYG Editing** - Large, prominent, first thing after hero
- Each feature demo has its own GIF with clear title
- GIFs ordered by priority: WYSIWYG → Tables → Images → Mermaid
- Each GIF focuses on one feature (clear, not overwhelming)

**Quick Start:**

- Reduce from detailed multi-option installation to 3 simple steps
- Keep detailed installation in collapsible section if needed

**Before/After Table:**

- New comparison table showing benefits
- Columns: "Before (Traditional Markdown)" vs "After (Markdown for Humans)"
- Rows: Preview, Tables, Images, Commands, etc.

**Feature Descriptions:**

- Add emojis to feature headings for visual hierarchy
- Keep existing detailed descriptions
- Group related features together

### 4. Technical Implementation

**Files to modify:**

- `README.md` - Complete restructure with new sections
- Create `marketplace-assets/gifs/` directory
- Add 4 GIF files to repository

**No code changes needed:**

- Pure Markdown content
- GIFs hosted in repository (GitHub raw URLs)
- Badges already working (shields.io)

**Testing requirements:**

- Test README rendering on VS Code Marketplace (preview)
- Test README rendering on GitHub
- Verify all links work
- Check GIF loading speed
- Verify badges display correctly

## GIF Creation Tooling Guide

### Recommended Workflow

**Step 1: Record Screen (Video)**

- Record screen as video (MP4/MOV) at high quality
- Use screen recording tools below

**Step 2: Convert Video to GIF**

- Use Adobe Express (free, web-based) or other tools below
- Optimize for web (<5MB target)

### Screen Recording Tools

#### Mac

**Option 1: QuickTime Player (Built-in, Free)**

- **How to use:**

  1. Open QuickTime Player
  2. File → New Screen Recording
  3. Click record button (or Cmd+Shift+5 for more options)
  4. Select area to record
  5. Click Record
  6. Stop recording (Cmd+Ctrl+Esc or menu bar)
  7. Save as .mov file

- **Pros:** Built-in, no installation, good quality
- **Cons:** Limited editing, exports as MOV (need conversion)

**Option 2: OBS Studio (Free, Open Source)**

- **Download:** https://obsproject.com/
- **How to use:**

  1. Install OBS Studio
  2. Add "Display Capture" source
  3. Configure recording settings (Settings → Output)
  4. Start recording
  5. Stop recording
  6. Exports as MP4

- **Pros:** Professional features, customizable, high quality
- **Cons:** Steeper learning curve, larger download

**Option 3: Kap (Free, Mac-specific)**

- **Download:** https://getkap.co/
- **How to use:**

  1. Install Kap
  2. Select recording area
  3. Record screen
  4. Can export directly as GIF or video

- **Pros:** Mac-native, can export directly to GIF
- **Cons:** Mac only

#### Windows

**Option 1: Xbox Game Bar (Built-in, Free)**

- **How to use:**

  1. Press `Win+G` to open Game Bar
  2. Click record button (or `Win+Alt+R`)
  3. Select area to record
  4. Stop recording (`Win+Alt+R`)
  5. Saves to Videos/Captures folder as MP4

- **Pros:** Built-in, no installation
- **Cons:** Limited editing options

**Option 2: OBS Studio (Free, Open Source)**

- **Download:** https://obsproject.com/
- **How to use:** Same as Mac version above
- **Pros:** Professional features, high quality
- **Cons:** Steeper learning curve

**Option 3: ShareX (Free, Open Source)**

- **Download:** https://getsharex.com/
- **How to use:**

  1. Install ShareX
  2. Configure screen recording
  3. Record screen area
  4. Can export as GIF or video

- **Pros:** Can export directly to GIF, many features
- **Cons:** Windows only

### Video to GIF Conversion Tools

#### Adobe Express (Free, Web-based) - RECOMMENDED

**URL:** https://www.adobe.com/express/feature/video/gif-maker

**How to use:**

1. Go to Adobe Express GIF Maker
2. Upload your video file (MP4, MOV, etc.)
3. Select start/end time (trim if needed)
4. Adjust settings:

   - Quality: Medium to High (balance size vs quality)
   - Frame rate: 30fps (or lower if file size is too large)
   - Dimensions: 1280x720 or 1920x1080

5. Click "Create GIF"
6. Download optimized GIF
7. Check file size - if >5MB, reduce quality/dimensions and re-export

**Pros:**

- Free, no installation
- Web-based (works on Mac and Windows)
- Good compression
- Easy to use
- Can trim videos

**Cons:**

- Requires internet connection
- File size limits (check current limits)

#### Alternative Tools

**Mac:**

- **Kap** (mentioned above) - Can export directly to GIF
- **Gifox** (Paid, ~$5) - https://gifox.io/ - Direct screen to GIF
- **GIPHY Capture** (Free) - https://giphy.com/apps/giphycapture - Simple GIF creation

**Windows:**

- **ShareX** (mentioned above) - Can export directly to GIF
- **ScreenToGif** (Free, Open Source) - https://www.screentogif.com/ - Direct screen to GIF
- **GifCam** (Free) - http://blog.bahraniapps.com/gifcam/ - Simple GIF recorder

**Cross-platform (Command Line):**

- **FFmpeg** (Free, Advanced) - https://ffmpeg.org/
  - Command: `ffmpeg -i input.mp4 -vf "fps=30,scale=1280:-1:flags=lanczos" -c:v gif output.gif`
  - Can optimize further with `gifsicle` (see below)

### GIF Optimization Tools

**gifsicle** (Command Line, Free)

- **Download:** https://www.lcdf.org/gifsicle/
- **Usage:**
  ```bash
  # Optimize GIF (reduce colors, compress)
  gifsicle -O3 --colors 256 input.gif -o output.gif
  
  # Resize and optimize
  gifsicle -O3 --resize-width 1280 --colors 256 input.gif -o output.gif
  ```

- **Pros:** Powerful compression, command-line automation
- **Cons:** Command-line only (no GUI)

**Online Optimizers:**

- **ezgif.com** - https://ezgif.com/optimize - Free, web-based
- **Compressor.io** - https://compressor.io/compress - Free, web-based
- **TinyPNG** - https://tinypng.com/ - Free (also supports GIFs)

### Recommended Workflow Summary

**For Mac:**

1. Record with **QuickTime** or **Kap** (if you want direct GIF)
2. If video: Convert with **Adobe Express** (web)
3. Optimize with **gifsicle** or **ezgif.com** if needed

**For Windows:**

1. Record with **Xbox Game Bar** or **ShareX** (if you want direct GIF)
2. If video: Convert with **Adobe Express** (web)
3. Optimize with **ScreenToGif** or **ezgif.com** if needed

**Universal (Both Platforms):**

1. Record screen as video (MP4/MOV) with any tool
2. Convert video to GIF using **Adobe Express** (free, web-based)
3. Optimize if needed using **ezgif.com** or **gifsicle**

### Best Practices

1. **Create realistic content first** - Prepare high-quality markdown content before recording (see "Content Quality Requirements" above)
2. **Record at high quality first** - Better to compress later than record at low quality
3. **Record at 60fps** - Export GIF at 30fps (smoother, smaller file)
4. **Keep recordings short** - 5-12 seconds per GIF
5. **Use consistent dimensions** - 1280x720 or 1920x1080 for all GIFs
6. **Optimize after creation** - Use compression tools to get under 5MB
7. **Test on slow connection** - Ensure GIFs load quickly on marketplace
8. **Practice the demo** - Rehearse the actions before recording to avoid pauses and mistakes
9. **Use real content** - Never use placeholder text (lorem ipsum, "test", etc.) - it looks unprofessional

### Quick Reference Table

| Task | Mac Tool | Windows Tool | Cross-Platform |

|------|----------|--------------|---------------|

| **Screen Recording** | QuickTime (built-in) | Xbox Game Bar (built-in) | OBS Studio |

| **Direct GIF Recording** | Kap | ShareX / ScreenToGif | - |

| **Video to GIF** | Adobe Express (web) | Adobe Express (web) | Adobe Express (web) |

| **GIF Optimization** | gifsicle / ezgif.com | ScreenToGif / ezgif.com | ezgif.com (web) |

| **Recommended Workflow** | QuickTime → Adobe Express → gifsicle | Game Bar → Adobe Express → ezgif.com | OBS → Adobe Express → ezgif.com |

**Recommended:** Record video → Convert with Adobe Express → Optimize if needed

## Open Questions for Discussion

1. **GIF Creation:**

- Who will create the GIFs? (Team member, contractor, AI tool?)
- Which tooling approach preferred? (Adobe Express workflow vs direct GIF tools?)
- Should we include cursor highlights or keep it minimal?

2. **Content Priorities:**

- Should we keep the "Vibe Coded" section? (It's unique but may not convert)
- How much detail in Quick Start vs full installation guide?
- Should we add user testimonials if available?

3. **Structure:**

- Is the proposed order optimal? (Hero → Value → Quick Start → GIFs → Features)
- Should "Before/After" come before or after GIFs?
- Do we need a FAQ section in README or keep it in wiki?

4. **Visual Assets:**

- **DECISION MADE:** Drop PNGs entirely from main README - GIFs only
- Hero GIF is critical - must be compelling and show core value immediately
- Are 5 GIFs (including hero) enough, or should we add more?
- Do we need a demo video (separate from README)?

5. **Scope:**

- Should this be MVP (GIFs + restructure) or include extras (testimonials, FAQ, etc.)?
- Do we want to A/B test different versions?

## Success Metrics

**Measurable outcomes:**

- **WYSIWYG Editing GIF first** - first visual users see (critical for conversion)
- README includes 6 GIFs (one per critical feature) demonstrating key interactions
- GIFs organized by priority: WYSIWYG → Tables → Images → Links → Outline → Mermaid
- **All PNG screenshots removed** from main README (GIFs only)
- Hero section (title + badges) followed immediately by critical feature demos
- Link dialog and outline view showcased as important features
- Before/After comparison table
- Quick Start reduced to 3 clear steps
- All existing content preserved but reorganized
- README renders correctly on marketplace and GitHub

**Future metrics (if trackable):**

- Marketplace install rate improvement
- Time spent on marketplace page
- GitHub README views

## Implementation Phases

**Phase 1: Planning & Approval** (Current)

- Review and debate this plan
- Answer open questions
- Finalize structure and content priorities

**Phase 2: GIF Creation**

- Review tooling guide (see "GIF Creation Tooling Guide" section above)
- **Prepare realistic markdown content** for each demo (see "Content Quality Requirements" section)
  - Create or use existing markdown files with real, professional content
  - Ensure content looks authentic and relatable (not placeholder text)
  - Test content in editor to ensure it looks good
- Choose recording tool (QuickTime/Kap for Mac, Game Bar/ShareX for Windows)
- Practice each demo before recording (smooth actions, no pauses)
- Record 6 videos (one per critical feature) per specifications:
  - Video 1: WYSIWYG Editing (most critical - invest time here)
  - Video 2: Table Editing
  - Video 3: Drag & Drop Images
  - Video 4: Link Dialog
  - Video 5: Outline View in Sidebar
  - Video 6: Mermaid Diagrams
- Convert videos to GIFs using Adobe Express (recommended) or alternative tools
- Optimize GIFs for web (<5MB each) using compression tools
- Create `marketplace-assets/gifs/` directory
- Add GIFs to repository
- Verify file sizes and loading speed
- Review GIFs for content quality (realistic, professional, authentic)

**Phase 3: README Restructure**

- Rewrite README with new structure
- Add hero section (centered, title + badges + links - no GIF)
- **Add Critical Feature Demos section** with 6 GIFs in priority order:
  - GIF #1: WYSIWYG Editing (first, most critical)
  - GIF #2: Table Editing
  - GIF #3: Drag & Drop Images
  - GIF #4: Link Dialog
  - GIF #5: Outline View in Sidebar
  - GIF #6: Mermaid Diagrams
- Add value proposition section (after feature demos)
- Simplify Quick Start (3 steps)
- Create before/after comparison table
- Reorganize features with emojis (text-based, no PNGs)
- **Remove all PNG screenshots from main README**
- Keep documentation section

**Phase 4: Testing & Polish**

- Test on VS Code Marketplace preview
- Test on GitHub
- Verify all links work
- Check GIF loading speed
- Proofread content
- Optimize if needed

**Phase 5: Ship**

- Commit changes
- Create PR for review
- Merge after approval
- Verify marketplace updates

## Files to Create/Modify

**New files:**

- `marketplace-assets/gifs/wysiwyg-editing.gif` - **FIRST GIF (most critical)**
- `marketplace-assets/gifs/table-editing.gif` - Second GIF
- `marketplace-assets/gifs/drag-drop-images.gif` - Third GIF
- `marketplace-assets/gifs/link-dialog.gif` - Fourth GIF
- `marketplace-assets/gifs/outline-view.gif` - Fifth GIF
- `marketplace-assets/gifs/mermaid-diagrams.gif` - Sixth GIF

**Modified files:**

- `README.md` - Complete restructure, **remove all PNG references**

**Removed from README:**

- All PNG screenshots removed from main README (kept in `marketplace-assets/screenshots/` folder for reference, but not linked in README)
- Screenshots Gallery section removed

**No changes needed:**

- Existing screenshots in `marketplace-assets/screenshots/` (kept for reference, not used in README)
- Documentation files (keep existing links)

## Decisions Made

1. **Visual Assets:** ✅ **Drop PNGs entirely from main README** - GIFs only (user preference based on conversion experience)
2. **GIF Organization:** ✅ **Critical features first** - organize GIFs by priority, not one "hero" GIF
3. **GIF Count:** ✅ **6 GIFs total** - one per critical feature, ordered by importance
4. **First GIF:** ✅ **WYSIWYG Editing** - this is the core value prop, must be first
5. **Additional Features:** ✅ **Link Dialog & Outline View** - important UX features showing VS Code integration

## Decisions Still Needed

1. **GIF creation approach:** Who creates them and with what tools?
2. **Content scope:** MVP (GIFs + restructure) or include extras?
3. **"Vibe Coded" section:** Keep, move, or remove?
4. **Installation details:** Simplified Quick Start or keep detailed options?
5. **Before/After placement:** Before or after GIFs section?
6. **GIF order:** Is WYSIWYG → Tables → Images → Links → Outline → Mermaid the right priority order?

## Notes

- This is a **draft plan** - open for healthy debate and refinement
- All content decisions are up for discussion
- Structure can be adjusted based on feedback
- GIF specifications can be modified if needed
- Success metrics can be expanded if trackable

## Rationale: GIF-First Approach

**Why drop PNGs and focus on GIFs:**

- User experience shows GIFs at the start significantly increase install likelihood
- Static screenshots don't demonstrate interactions (drag-drop, table editing, etc.)
- GIFs show the extension "in action" - more compelling than static images
- Hero GIF at the top creates immediate visual impact and communicates value instantly
- Reduces cognitive load - users see what it does, not just what it looks like

**First GIF Priority (WYSIWYG Editing):**

- The WYSIWYG Editing GIF is the **most critical asset**
- It's the first GIF users see on the marketplace (right after hero section)
- Must be compelling, polished, and clearly show real-time formatting
- Should demonstrate core value proposition immediately
- Consider this the "conversion driver" - invest time in making it perfect
- Each subsequent GIF focuses on one feature (clear, not overwhelming)

**GIF Organization Benefits:**

- One focused GIF per feature is clearer than one "hero" GIF trying to show everything
- Users can scan through critical features in priority order
- Each GIF has a clear purpose and message
- Easier to create and maintain (one feature per GIF)