# DrawingViewer - PDF Technical Drawing Review App

## Overview
A professional PDF technical drawing viewer with scale measurement, distance measuring tools, highlighting, and annotation capabilities.

## Features
- **PDF Viewer**: Load and view multi-page PDF technical drawings with zoom and pan
- **Scale Setup**: Set drawing scale via ratio (e.g., 1:100) or calibrate by drawing a line of known length
- **Measure Tool**: Draw measurement lines on the drawing to get real-world distances
- **Highlight Tool**: Draw rectangles to highlight specific areas with colour options
- **Note Tool**: Add annotated highlights with text notes
- **Annotations Panel**: View and manage all annotations and measurements per page
- **Keyboard Shortcuts**: V=select, H=pan, M=measure, L=highlight, N=note, +/-=zoom

## Architecture
- **Frontend**: React + TypeScript, canvas-based PDF rendering with pdfjs-dist
- **Backend**: Express.js (minimal, app is primarily client-side)
- **PDF Rendering**: pdfjs-dist with CDN worker
- **State**: All state is in-memory on the client side (no persistence needed)

## Key Files
- `client/src/pages/home.tsx` - Main PDF viewer with all tools
- `client/src/App.tsx` - App routing
- `shared/schema.ts` - TypeScript types for annotations, measurements, scale

## Tech Stack
- React + TypeScript + Vite
- pdfjs-dist for PDF rendering
- Tailwind CSS + shadcn/ui components
- Canvas API for drawing overlays
- Lucide React icons
