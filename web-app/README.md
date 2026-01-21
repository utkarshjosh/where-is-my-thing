# Spatial Memory Web App

A modern React web application for tracking where you put things, featuring voice interaction and a knowledge graph visualization.

## Features

- **Hybrid Chat/Voice Interface**: Interact via text or voice commands
- **Items Management**: Browse, search, and filter your stored items
- **Graph Visualization**: D3 force-directed graph showing relationships between items and locations
- **Clerk Authentication**: Secure sign-in with email or social providers
- **Responsive Design**: Works on desktop and mobile browsers

## Tech Stack

- **Vite** - Fast build tool
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Mantine UI** - Component library
- **TanStack Query** - Data fetching and caching
- **React Router** - Client-side routing
- **Clerk** - Authentication
- **D3 / react-force-graph-2d** - Graph visualization
- **Zustand** - State management
- **Framer Motion** - Animations

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A Clerk account for authentication

### Installation

```bash
cd web-app
npm install
```

### Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Add your configuration:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_API_BASE_URL=https://things-api.utkarshjoshi.com
VITE_WS_BASE_URL=wss://things-api.utkarshjoshi.com
```

For local development:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_API_BASE_URL=http://localhost:5000
# VITE_WS_BASE_URL can be omitted for local dev (will use ws://localhost:5000)
```

### Development

```bash
npm run dev
```

The app will be available at http://localhost:3000

### Production Build

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── api/           # API client and TanStack Query hooks
├── components/    # Reusable UI components
│   ├── chat/      # Chat panel components
│   ├── voice/     # Voice orb components
│   ├── layout/    # App shell and navigation
│   └── ...
├── hooks/         # Custom React hooks
├── routes/        # Page components
├── stores/        # Zustand stores
└── theme/         # Mantine theme configuration
```

## API Integration

The app communicates with the FastAPI backend:

- `GET /items` - List user's items
- `GET /items/search?q=query` - Search items
- `GET /graph` - Get graph data for visualization
- `WS /agent/voice` - WebSocket for voice interaction

## License

MIT
