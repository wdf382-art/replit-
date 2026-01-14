# Film Production Assistant

## Overview
A bilingual (Chinese/English) AI-powered film production assistant application designed for pre-production workflows. The app helps filmmakers with script writing, storyboard generation, performance direction, and production planning using integrated AI capabilities. It streamlines the pre-production pipeline from idea development to export, covering script creation, scene breakdown, shot planning, performance guidance, and production notes. The project aims to provide comprehensive AI assistance to enhance filmmaking efficiency and creativity.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: Zustand for global state, TanStack Query for server state
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS with custom design tokens
- **Build Tool**: Vite
- **UI/UX**: Linear + Notion hybrid approach, emphasizing clarity and workflow efficiency. Typography uses Inter for UI and JetBrains Mono for script/code. Supports light/dark themes and global UI scaling (50%-150%) via header control.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API under `/api/*`
- **AI Integration**: OpenAI SDK via Replit AI Integrations, with batch processing, rate limiting, retries, chat, and image generation.

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL
- **Schema Location**: `shared/schema.ts`
- **Validation**: Zod schemas from Drizzle via drizzle-zod
- **Core Entities**: Users, Projects, Scripts, Scenes, Shots, Characters, PerformanceGuides, SceneAnalysis, ProductionNotes, CallSheets, ScriptVersions, ShotVersions. Projects support various types (advertisement, movie, etc.) with configurable director and visual styles.

### Key Features

#### Automatic Scene & Content Extraction
- **Script Upload**: Automatically extracts and creates scene entries from script content, supporting various formats (e.g., 第X场, X-Y, 场次X). Deduplicates existing scenes.
- **Call Sheet Parsing**: Extracts scene content (location, timeOfDay, dialogue, action) from call sheets using regex patterns, supporting multiple scene number formats.

#### Version Control System
- Implements version history for scripts (`ScriptVersions`) and shots (`ShotVersions`), tracking modifications with timestamps and change descriptions.
- Provides restore functionality and uses monotonic version numbering.

#### Video Storyboard System
- Supports video generation from static images using VEO, 可灵O1 (Kling), and 既梦4.0 (Jimeng) AI models.
- Features an asynchronous job queue (max 2 concurrent jobs), non-blocking API, status polling, and retry mechanisms.
- Database fields in `shots` table track `videoUrl`, `videoModel`, `videoStatus`, and `videoError`.

#### Character Reference System
- **Auto-extraction**: AI analyzes scripts to extract character names, roles, and appearance descriptions, classifying roles (e.g., 男主/女主).
- **Image References**: Allows uploading reference images for characters and managing assets (clothing, shoes, props).
- **AI Character Image Auto-Generation**: Generates 4 reference images per character (全身照, 正脸近景, 左侧脸近景, 右侧脸近景) using NANO BANANA PRO (Gemini gemini-3-pro-image-preview model). Features:
  - **Version History**: Each regeneration creates a new version, preserving all previous versions for comparison
  - **Preview Modal**: Large main image with prev/next navigation, thumbnail gallery, fullscreen view
  - **Version Selector**: Dropdown to switch between different generation versions (newest shown first)
  - **Background Processing**: Async job queue (max 2 concurrent) with status polling every 3 seconds
  - **Apply Workflow**: Select any variant image to apply as the character's main reference image

#### Director Style Framework
- Storyboard generation uses an 8-dimension director style framework, analyzing how directors handle universal cinematography rules (e.g., Shot size transitions, 30-degree rule, camera movement, composition, color, lighting) and their signature techniques.
- Supports 17 directors (e.g., Quentin Tarantino, Steven Spielberg, Christopher Nolan, Zhang Yimou), specifying how each director varies from universal cinematography rules.

#### Performance Guidance V2 Module
- **Two-Phase Architecture**:
    1. **Global Script Analysis**: Analyzes the entire script to generate character arcs, emotion maps, and relationship networks, stored in `scriptAnalysisGlobal`.
    2. **Scene-Specific Performance Guidance**: Generates four components per scene: Scene Hook (core dramatic moment), Flatness Diagnosis (identifying and solving flat scenes), Emotional Chain (linking emotional flow between scenes), and Director Scripts (second-person guidance for characters). This phase requires global analysis to be completed first.

## External Dependencies

### AI Services
- **OpenAI API**: Via Replit AI Integrations for text generation (script, storyboard descriptions, performance guidance, production notes) and validation using Zod schemas.
- **Gemini API (NANO banana pro)**: Via Replit AI Integrations (`gemini-3-pro-image-preview`) for storyboard image generation.

### Database
- **PostgreSQL**: For data persistence, configured via `DATABASE_URL`.
- **Session Storage**: `connect-pg-simple`.

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit`: ORM and migrations.
- `@tanstack/react-query`: Server state management.
- `zustand`: Client state management.
- `openai`: AI API client.
- `p-limit` / `p-retry`: Batch processing utilities.
- `zod`: Runtime validation.