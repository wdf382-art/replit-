# Film Production Assistant App - Design Guidelines

## Design Approach

**Selected Framework:** Design System Approach with Linear + Notion hybrid influence
- **Rationale:** Professional productivity tool requiring clarity, efficiency, and information density
- **References:** Linear (clean hierarchy, purposeful spacing), Notion (flexible content blocks), Frame.io (media-focused workflows)
- **Principles:** Information clarity over decoration, purposeful use of space, workflow-optimized navigation

## Core Design Elements

### A. Typography
**Primary Font:** Inter (via Google Fonts CDN)
- **Hero/Headers:** 32px-48px, font-weight: 700
- **Section Titles:** 24px-28px, font-weight: 600
- **Body Text:** 15px-16px, font-weight: 400, line-height: 1.6
- **Metadata/Labels:** 13px-14px, font-weight: 500
- **Code/Script Text:** JetBrains Mono, 14px (for screenplay formatting)

### B. Layout System
**Spacing Primitives:** Tailwind units of 2, 4, 8, 12, 16
- Standard padding: p-8 for containers, p-4 for cards
- Section spacing: mb-12 between major sections
- Component gaps: gap-4 for grids, gap-2 for tight groupings
- Page margins: px-6 mobile, px-12 desktop

**Grid System:**
- Sidebar navigation: Fixed 280px left sidebar (collapsible on mobile)
- Main content: max-w-7xl with responsive padding
- Multi-panel view: 60/40 split for script + storyboard
- Card grids: 2-3 columns for storyboard thumbnails

### C. Component Library

**Navigation:**
- Fixed left sidebar with icon + label menu items
- Top bar: Project selector dropdown, user profile, notifications
- Breadcrumb trail below top bar for deep navigation
- Tab navigation within modules (Script / Storyboard / Performance / etc.)

**Forms & Inputs:**
- Clean bordered inputs with subtle focus states
- Dropdown selectors for director styles, shot types
- Multi-select chips for tags/categories
- Textarea with monospace font for script editing
- Range sliders for duration/scene length controls

**Data Display:**
- Timeline view for shooting schedule
- Table view for shot lists with sortable columns
- Card-based storyboard grid with hover preview
- Accordion panels for collapsible sections (scene breakdown)
- Split-panel compare view for version control

**Core UI Elements:**
- Primary buttons: Solid fill, medium prominence
- Secondary buttons: Outlined style
- Icon buttons for actions (edit, delete, duplicate)
- Status badges for scene status (Draft, Approved, In Progress)
- Progress indicators for AI generation tasks

**Media Components:**
- Storyboard frame cards: 16:9 aspect ratio thumbnails with shot details overlay
- Image comparison slider for before/after adjustments
- Lightbox modal for full storyboard view
- PDF/Excel export preview panel

**Overlays:**
- Modal dialogs for settings, confirmations (max-w-2xl centered)
- Slide-over panels from right for detail views (384px wide)
- Toast notifications for success/error states (top-right)
- Loading overlays with progress percentage for AI generation

### D. Animations
**Minimal, purposeful only:**
- Sidebar collapse/expand: 200ms ease
- Tab switching: 150ms fade transition
- Modal entrance: 200ms scale + fade
- No scroll animations or decorative effects

## Module-Specific Layouts

**Dashboard (Home):**
- Quick action cards grid (2x2): New Project, Continue Editing, Import Script, Browse Templates
- Recent projects list with thumbnail previews
- Statistics overview: Total scenes, shots, completion status

**Script Editor:**
- Full-width editor with monospace formatting
- Left sidebar: Scene navigator with nested structure
- Right sidebar (toggleable): AI suggestions panel
- Floating toolbar: Format options, AI rewrite button

**Storyboard Module:**
- Grid view: 3-column thumbnail grid with shot details
- List view: Compact table with inline editing
- Side-by-side: Script on left (40%), storyboard frames on right (60%)
- Frame detail view: Large preview with parameter controls below

**Performance Guide:**
- Actor selector dropdown at top
- Accordion sections per scene with emotion timeline graph
- Multiple suggestion cards (Option A, B, C) side-by-side
- Annotation tools for marking specific lines/actions

**Export Interface:**
- Checklist of modules to include
- Format selector with preview
- Version comparison table
- Single "Generate Export" prominent button

## Images

**No decorative images required** - This is a functional production tool. All imagery is user-generated content (storyboard frames, reference images) or AI-generated outputs.

**Exception:** Empty states use simple illustrations:
- New project: Simple director's clapperboard icon
- No storyboards: Camera icon with "Generate your first shot"
- No scripts: Screenplay icon with "Start writing"

## Accessibility
- Keyboard shortcuts for all major actions (listed in help menu)
- Focus indicators on all interactive elements (2px outline)
- Aria labels on icon-only buttons
- Sufficient contrast ratios throughout (4.5:1 minimum)
- Resizable panels with min/max constraints