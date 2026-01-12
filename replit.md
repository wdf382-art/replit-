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
- **Database Connection**: `server/db.ts` - Drizzle connection using pg Pool
- **Storage**: `server/storage.ts` - DatabaseStorage class implementing IStorage interface for PostgreSQL persistence
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod
- **Migrations**: Drizzle Kit with `db:push` command

Core entities include: Users, Projects, Scripts, Scenes, Shots, Characters, PerformanceGuides, SceneAnalysis, ProductionNotes, CallSheets, ScriptVersions, and ShotVersions. Projects support multiple types (advertisement, short_video, movie, web_series, micro_film, documentary, mv) with configurable director styles and visual styles.

### Automatic Scene Extraction on Script Upload
The application automatically extracts and creates scenes when a script is uploaded:
- **Auto-tagging**: Script upload automatically identifies and creates all scene entries from the script content
- **Supported Formats**: 第X场 (Arabic/Chinese numbers), X-Y (episode-scene), 场次X
- **Deduplication**: If a scene already exists, it updates the content rather than creating duplicates
- **Content Extraction**: Automatically populates location, timeOfDay, dialogue, action from script text

### Call Sheet & Scene Content Extraction
The application supports automated scene creation from call sheets (通告单):
- **Call Sheet Parsing**: Supports multiple scene number formats:
  - "场次: 1, 2, 3" - comma/顿号 separated lists
  - "场次：一、二、三" - Chinese numeral lists
  - "第X场" - standard scene notation
  - "X-Y" - episode-scene format
- **Scene Content Extraction**: When call sheet identifies scene numbers, system extracts content directly from script raw text using regex patterns
- **Extracted Fields**: location (场地), timeOfDay (日/夜), dialogue (角色对白), action (△ 动作描写)
- **Pattern Matching**: Supports "第N场 场地 时间 内/外" format with flexible whitespace handling

### Version Control System
The application implements version history tracking for both scripts and shots:
- **ScriptVersions**: Tracks all modifications to script content with version numbers, timestamps, and change descriptions
- **ShotVersions**: Tracks all modifications to shot data (description, camera settings, atmosphere, etc.)
- **Restore Functionality**: Automatically saves current version before restoring to prevent data loss
- **Version Numbering**: Monotonically increasing version numbers for clear history tracking
- **UI Integration**: Version history panels in Script Editor sidebar and Storyboard shot edit dialog

### Design System
The UI follows a Linear + Notion hybrid approach emphasizing information clarity and workflow efficiency. Typography uses Inter for UI and JetBrains Mono for script/code content. The app supports light/dark themes with CSS custom properties.

## External Dependencies

### AI Services
- **OpenAI API**: Accessed through Replit AI Integrations proxy
  - Used for text generation: script generation, storyboard descriptions, performance guidance, and production notes
  - All AI responses validated with Zod schemas (ScriptGenerationSchema, ShotsGenerationSchema, PerformanceGuideSchema, ProductionNotesSchema) using safeParseJSON function with explicit fallbacks

- **Gemini API (NANO banana pro)**: Accessed through Replit AI Integrations proxy
  - Model: `gemini-3-pro-image-preview` (NANO banana pro)
  - Used for storyboard image generation
  - Client imported from `server/replit_integrations/image/client.ts`

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

## Director Style Framework (Updated 2026-01-12)

### Comprehensive 8-Dimension Analysis
The storyboard generation now uses a comprehensive director style framework with 8 dimensions:

**Rule Variants (A-D) - How directors handle universal cinematography rules:**
- A1 景别过渡: Shot size transitions
- A2 30度规则: 30-degree rule
- A3 轴线规则: 180-degree axis rule
- B1 镜头时长: Shot duration
- B2 开场方式: Scene opening style
- B3 高潮处理: Climax handling
- C1 视线匹配: Eyeline match
- C2 动作衔接: Action continuity
- C3 情绪承接: Emotional continuity
- D 叙事结构: Narrative structure

**Additional Dimensions:**
- E: 摄影机运动 (Camera Movement) - E1运动类型, E2运动节奏, E3运动动机
- F: 构图 (Composition) - F1对称性, F2空间深度, F3画面重心, F4框架利用
- G: 色彩 (Color) - G1色调倾向, G2饱和度, G3色彩叙事
- H: 光线 (Lighting) - H1光源类型, H2光影对比, H3光线叙事
- Signatures: Director's signature techniques

### Supported Directors (17 total)
1. 昆汀·塔伦蒂诺 (Quentin Tarantino)
2. 史蒂文·斯皮尔伯格 (Steven Spielberg)
3. 克里斯托弗·诺兰 (Christopher Nolan)
4. 张艺谋 (Zhang Yimou)
5. 斯坦利·库布里克 (Stanley Kubrick) - NEW
6. 詹姆斯·卡梅隆 (James Cameron) - NEW
7. 贝拉·塔尔 (Béla Tarr)
8. 毕赣 (Bi Gan)
9. 王家卫 (Wong Kar-wai)
10. 韦斯·安德森 (Wes Anderson)
11. 大卫·芬奇 (David Fincher)
12. 阿方索·卡隆 (Alfonso Cuarón)
13. 丹尼斯·维伦纽瓦 (Denis Villeneuve)
14. 朴赞郁 (Park Chan-wook)
15. 是枝裕和 (Hirokazu Koreeda)
16. 侯孝贤 (Hou Hsiao-hsien)
17. 蔡明亮 (Tsai Ming-liang)

### Key Data Structures
- `directorStyleRulesV2`: Complete 8-dimension rules for each director in `shared/schema.ts`
- `universalCinematographyRules`: Base cinematography rules that all directors work within/around
- Each director rule specifies variant type: 遵守(follow), 变化(modify), 打破(break), 强化(enhance), 不适用(N/A)