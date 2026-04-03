# SaaS Agents

A self-hosted AI chat agent with RAG (Retrieval-Augmented Generation). Deploy it on any server, upload your documents, and embed a chat widget on your website — your visitors get an AI assistant that answers based on your content.

## Features

- **Knowledge Base (RAG)** — Upload PDFs or paste text. The agent uses vector embeddings to find relevant context before answering.
- **Embeddable Widget** — Add a `<script>` tag to any website. The chat widget works on WordPress, Shopify, plain HTML, or any platform.
- **Admin Dashboard** — Configure your agent's personality, appearance, knowledge base, and tools from a web UI.
- **Conversation Memory** — Chat sessions persist across page reloads with automatic conversation summaries.
- **Custom Tools** — Give your agent the ability to call APIs, query databases, or perform actions. See [TOOLS.md](TOOLS.md) for how to build custom tools.
- **Zero Configuration** — `docker-compose up -d` starts everything. Default admin credentials are created on first boot.
- **Multi-Tenant Ready** — Designed to support multiple distinct agents with separate knowledge bases.

## Architecture

The project is built as a modern containerized stack:

- **Frontend**: Angular 18 (Dashboard and compiled Web Components for the widget) served by Nginx.
- **Backend**: NestJS (Node.js) providing a secure API.
- **Database**: MongoDB for storing tenants, configuration, chat history, and vector embeddings for RAG.
- **AI Provider**: Google Gemini API.

## Quick Start

You only need Docker and a free Google Gemini API Key.

```bash
git clone https://github.com/Jergasus/saas_agents.git && cd saas_agents
cp .env.example .env
# Set your GEMINI_API_KEY in .env
docker-compose up -d --build
```

Open **http://localhost** and log in with `admin@localhost` / `admin123`.

*Make sure to change these credentials immediately via the **Account** tab in the dashboard!*

## Local Testing With Your Own Project

You do **not** need a VPS just to test the integration. You can run `saas_agents` locally using Docker Compose, and your own website locally at the same time.

From the `saas_agents` admin dashboard at `http://localhost`, navigate to **Install**, copy the widget embed snippet, and paste it into your local project's HTML like so:

```html
<script src="http://localhost/widget/widget.js"></script>
<ai-chat-widget api-key="YOUR_API_KEY" api-url="http://localhost:3000"></ai-chat-widget>
```

## Production Deployment

This stack is intended to be deployed on a VPS (Virtual Private Server). See [DEPLOY.md](DEPLOY.md) for full production deployment, instructions on setting up HTTPS, changing default credentials, dealing with CORS, and migrating to MongoDB Atlas for advanced vector search.


## Project Structure

```
.
├── api/                     # Backend (NestJS)
│   └── src/
│       ├── auth/            # JWT authentication (login, register, guard)
│       ├── bootstrap/       # Auto-creates default admin on first run
│       ├── chat/            # Chat endpoint, session history, analytics
│       ├── knowledge/       # RAG: text ingestion, PDF processing, vector search
│       ├── schemas/         # MongoDB schemas (tenant, knowledge, chat session)
│       ├── tenants/         # Tenant CRUD, account management
│       ├── tools/           # Tool registry and interface for custom tools
│       ├── app.module.ts    # Root module
│       └── main.ts          # Entry point, CORS config
│
├── web/                     # Frontend (Angular)
│   └── src/
│       ├── app/
│       │   ├── components/  # Chat widget (used in admin dashboard preview)
│       │   ├── guards/      # Auth route guard
│       │   ├── interceptors/# JWT token interceptor
│       │   ├── pages/       # Login, Admin dashboard, Public chat
│       │   ├── services/    # API clients (auth, chat, knowledge, tenant)
│       │   └── widget/      # Embeddable Web Component (Shadow DOM)
│       ├── environments/    # Dev/prod API URL config
│       ├── main.ts          # App entry point
│       └── widget.ts        # Widget entry point (builds to widget.js)
│
├── docker-compose.yml       # MongoDB + API + Web (one command)
├── .env.example             # Configuration template
├── DEPLOY.md                # Deployment and embedding guide
└── TOOLS.md                 # Guide for creating custom tools
```

## How It Works

```
User's website                    Your server (one VPS)
┌─────────────┐                  ┌─────────────────────────┐
│  <script>   │ ──── loads ────▶ │ Nginx (:80)             │
│  widget.js  │                  │  ├── Admin dashboard     │
│             │                  │  └── widget.js           │
│  User types │                  │                          │
│  a message  │ ── API call ──▶  │ NestJS API (:3000)       │
│             │                  │  ├── RAG vector search   │
│             │ ◀── response ──  │  ├── Gemini AI call      │
│  AI replies │                  │  └── Session persistence │
└─────────────┘                  │                          │
                                 │ MongoDB (:27017)         │
                                 │  └── Internal only       │
                                 └─────────────────────────┘
```

1. Your visitor loads `widget.js` from your server — a floating chat button appears
2. They send a message — the widget calls your API
3. The API searches your knowledge base using vector similarity (RAG)
4. Top matches + the user's question are sent to Google Gemini
5. Gemini responds (optionally using custom tools) and the answer appears in the widget

## Tech Stack

| Layer | Technology |
|---|---|
| AI | Google Gemini 2.5 Flash + Embedding API |
| Backend | NestJS, Mongoose, JWT |
| Frontend | Angular 21, Tailwind CSS |
| Widget | Angular Elements (Web Component, Shadow DOM) |
| Database | MongoDB 7 |
| Deployment | Docker Compose |

## License

MIT
