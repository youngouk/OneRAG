# OneRAG

> **Start in 5 minutes, assemble like building blocks**

[한국어](README.md) | **English**

[![CI](https://github.com/youngouk/OneRAG/actions/workflows/ci.yml/badge.svg)](https://github.com/youngouk/OneRAG/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)

## Why OneRAG?

| Traditional Approach | OneRAG |
|---------------------|--------|
| Locked to specific Vector DB | Choose from **6 Vector DBs** (1 line config) |
| Locked to specific LLM | Choose from **4 LLMs** (1 line config) |
| Code changes for new features | **YAML config** to toggle On/Off |
| Build everything from scratch | Assemble **only what you need** |

---

## 5-Minute Quickstart

```bash
# 1. Clone & Install
git clone https://github.com/youngouk/OneRAG.git
cd OneRAG && uv sync

# 2. Configure (just one API key)
cp quickstart/.env.quickstart .env
# Set GOOGLE_API_KEY in .env (Free: https://aistudio.google.com/apikey)

# 3. Run
make quickstart
```

**Done!** Test at http://localhost:8000/docs

```bash
# Stop
make quickstart-down
```

---

## Assemble Like Building Blocks

### Switch Vector DB (1 line)

```bash
# Just change one line in .env
VECTOR_DB_PROVIDER=weaviate  # or chroma, pinecone, qdrant, pgvector, mongodb
```

### Switch LLM (1 line)

```bash
# Just change one line in .env
LLM_PROVIDER=google  # or openai, anthropic, openrouter
```

### Switch Reranker (2 lines YAML)

```yaml
# app/config/features/reranking.yaml
reranking:
  approach: "cross-encoder"  # or late-interaction, llm, local
  provider: "jina"           # or cohere, google, openai, openrouter, sentence-transformers
```

### Toggle Features (YAML config)

```yaml
# Enable caching
cache:
  enabled: true
  type: "redis"  # or memory, semantic

# Enable GraphRAG
graph_rag:
  enabled: true

# Enable PII masking
pii:
  enabled: true
```

---

## Available Building Blocks

| Category | Options | How to Change |
|----------|---------|---------------|
| **Vector DB** | Weaviate, Chroma, Pinecone, Qdrant, pgvector, MongoDB | 1 env var |
| **LLM** | Google Gemini, OpenAI, Anthropic Claude, OpenRouter | 1 env var |
| **Reranker** | Jina, Cohere, Google, OpenAI, OpenRouter, Local | 2 lines YAML |
| **Cache** | Memory, Redis, Semantic | 1 line YAML |
| **Query Routing** | LLM-based, Rule-based | 1 line YAML |
| **Korean Search** | Synonyms, Stopwords, User Dictionary | YAML config |
| **Security** | PII Detection, Masking, Audit Logging | YAML config |
| **GraphRAG** | Knowledge Graph-based Reasoning | 1 line YAML |
| **Agent** | Tool Execution, MCP Protocol | YAML config |

---

## Step-by-Step Configuration Guide

| Level | Components | Use Case |
|-------|------------|----------|
| **Basic** | Vector Search + LLM | Simple document Q&A |
| **Standard** | + Hybrid Search + Reranker | Production services **(recommended)** |
| **Advanced** | + GraphRAG + Agent | Complex reasoning, tool execution |

Start with Basic, add blocks as needed.

---

## RAG Pipeline

```
Query → Router → Expansion → Retriever → Cache → Reranker → Generator → PII Masking → Response
```

| Step | Function | Swappable |
|------|----------|-----------|
| Query Routing | Classify query type | LLM/Rule selection |
| Query Expansion | Synonyms, stopwords | Custom dictionaries |
| Search | Vector/hybrid search | 6 DBs |
| Caching | Response cache | 3 cache types |
| Reranking | Sort search results | 6 rerankers |
| Generation | LLM response | 4 LLMs |
| Post-process | PII masking | Custom policies |

---

## Development

```bash
make dev-reload    # Dev server (hot reload)
make test          # Run tests
make lint          # Lint check
make type-check    # Type check
```

## Documentation

- [Setup Guide](docs/SETUP.md)
- [Architecture](docs/TECHNICAL_DEBT_ANALYSIS.md)
- [Streaming API Guide](docs/streaming-api-guide.md)
- [WebSocket API Guide](docs/websocket-api-guide.md)

## License

MIT License

---

> This project was built by a RAG Chat Service PM who wanted to implement various features across multiple projects.
> Designed to help newcomers easily run PoC and scale to production.
