# Film Production Assistant

## Overview

A bilingual (Chinese/English) AI-powered film production assistant application designed for pre-production workflows. The app helps filmmakers with script writing, storyboard generation, performance direction, and production planning using integrated AI capabilities through OpenAI.

The application follows a modular workflow structure covering the complete pre-production pipeline: idea development → script creation → scene breakdown → shot planning → performance guidance → production notes → export.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: Zustand for global app state, TanStack Query for server state
- **UI Components**: shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens (CSS variables for theming)
- **Build Tool**: Vite with React plugin

The frontend follows a page-based structure with shared components. Pages include Dashboard, Projects, Script Editor, Storyboard, Performance, Production, and Export. The sidebar navigation provides workflow-oriented access to all modules.

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API under `/api/*` prefix
- **AI Integration**: OpenAI SDK configured via Replit AI Integrations (custom base URL)

The server includes replit_integrations modules providing:
- Batch processing with rate limiting and retries
- Chat conversation management
- Image generation capabilities

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod
- **Migrations**: Drizzle Kit with `db:push` command

Core entities include: Users, Projects, Scripts, Scenes, Shots, Characters, PerformanceGuides, SceneAnalysis, ProductionNotes, and CallSheets. Projects support multiple types (advertisement, short_video, movie, web_series, micro_film, documentary, mv) with configurable director styles and visual styles.

### Design System
The UI follows a Linear + Notion hybrid approach emphasizing information clarity and workflow efficiency. Typography uses Inter for UI and JetBrains Mono for script/code content. The app supports light/dark themes with CSS custom properties.

## External Dependencies

### AI Services
- **OpenAI API**: Accessed through Replit AI Integrations proxy
  - Client imported from `server/replit_integrations/image/client.ts`
  - Used for script generation, storyboard descriptions, performance guidance, and production notes
  - All AI responses validated with Zod schemas (ScriptGenerationSchema, ShotsGenerationSchema, PerformanceGuideSchema, ProductionNotesSchema) using safeParseJSON function with explicit fallbacks

### Database
- **PostgreSQL**: Required for data persistence
  - Environment variable: `DATABASE_URL`
  - Session storage via connect-pg-simple

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit`: Database ORM and migrations
- `@tanstack/react-query`: Server state management
- `zustand`: Client state management
- `openai`: AI API client
- `p-limit` / `p-retry`: Batch processing utilities
- `zod`: Runtime validation