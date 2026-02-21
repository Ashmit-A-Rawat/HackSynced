# 🧠 AETHER  
### Evidence-Driven Multi-Agent ML Synthesis System

> **LLMs generate arguments.  
> AETHER uses Machine Learning to decide.**

---

## 📌 Overview

**AETHER** is an intelligent AI system designed to make **reliable, auditable decisions** from conflicting arguments and shared evidence.

Unlike traditional LLM-based systems that output a single opinion, AETHER:
- Generates **opposing viewpoints**
- **Evaluates evidence quality**
- **Detects contradictions**
- **Synthesizes a verdict using ML**
- Produces a **numeric confidence score**

The final decision is **not prompt-based** — it is **ML-computed**.

---

## 🎯 Why AETHER Exists

### ❌ Problems with Conventional AI
- One prompt → one answer
- No opposition or debate
- No confidence calibration
- No evidence traceability
- No way to say *“I don’t know”*

### ✅ What AETHER Solves
- Forces structured disagreement
- Quantifies argument strength
- Judges evidence quality
- Computes confidence numerically
- Supports **Support / Oppose / Mixed / Inconclusive** verdicts

---

## 🧩 System Architecture

Document / Evidence
↓
Evidence Chunking & Scoring (RAG)
↓
Support Agent (LLM) Oppose Agent (LLM)
↓
Evidence Judge (ML)
Contradiction Detector (ML)
↓
ML Synthesizer (Decision Engine)
↓
Verdict + Confidence + Key Evidence


---

## 🛠️ Tech Stack

### Backend
- Node.js + Express
- MongoDB + Mongoose
- Python ML services via `child_process`

### Machine Learning
- DeBERTa v3 / DistilBERT – Evidence Quality
- RoBERTa MNLI / DistilRoBERTa – Contradiction Detection
- Sentence Transformers – Semantic similarity
- Custom ML Synthesizer – Verdict & confidence logic

### LLMs
- Gemini (Support & Oppose agents)
- Grok (via OpenRouter) for explanation only

---

## 🧠 Core Components

### 1️⃣ Evidence Layer
- Documents are chunked into evidence units
- Each chunk includes:
  - Relevance score
  - Position in document
  - Length
  - Optional embeddings
- Fully auditable & stored in MongoDB

---

### 2️⃣ Dual-Agent Reasoning

Two independent agents:
- **Support Agent** – argues *for*
- **Oppose Agent** – argues *against*

Rules:
- Same evidence
- Same constraints
- Mandatory citations
- No shared memory

> Disagreement is intentional — not accidental.

---

### 3️⃣ Evidence Judge (ML)

Evaluates evidence across multiple dimensions:
- Factual grounding
- Logical coherence
- Evidence integration
- Argument strength
- Objectivity

**Models**
| Mode | Model | Purpose |
|----|----|----|
| Full | DeBERTa v3 | Accuracy-first |
| Lite | DistilBERT | Speed & low memory |

---

### 4️⃣ Contradiction Detector (ML)

Detects and quantifies disagreement:
- Contradiction score
- Entailment score
- Similarity score
- Sentence-level conflicts

**Models**
| Mode | Model | Size |
|----|----|----|
| Full | RoBERTa-large MNLI | ~1.4GB |
| Lite | DistilRoBERTa MNLI | ~307MB |

---

### 5️⃣ ML Synthesizer (Decision Engine)

This is the **core intelligence** of AETHER.

**Inputs**
- Support argument strength
- Oppose argument strength
- Evidence quality
- Contradiction severity

**Outputs**
- Final verdict
- Numeric confidence score
- Key supporting evidence
- Processing metrics

> LLMs **never decide** the verdict.

---

## 📊 Verdict Types

AETHER can return:
- **Support**
- **Oppose**
- **Mixed**
- **Inconclusive**

Each verdict includes:
- Confidence score (0–1)
- Evidence trace
- Reasoning explanation
- Model metadata

---

## 📈 Confidence Scoring

Confidence is:
- Computed numerically
- Penalized by contradictions
- Boosted by evidence quality
- Explicitly bounded (never 100%)

> Confidence is **measured**, not guessed.

---

## ⚡ Performance Modes

AETHER supports dynamic execution modes:
- **Full ML mode** (accuracy-focused)
- **Lite ML mode** (fast, memory-efficient)

Controlled via:
- Environment variables
- Runtime flags

---

## 🗣️ Explanation Layer (Optional)

- Uses **Grok API (OpenRouter)**
- Generates human-readable explanations
- Cannot modify verdict or confidence

> Explanations explain — they do not decide.

---

## 🧪 Fault Tolerance

If any ML component fails:
- System falls back to heuristic scoring
- Verdict defaults to **Inconclusive**
- Confidence remains bounded
- No crashes, no hallucinated certainty

---

## 🌍 Use Cases

- Resume & profile evaluation
- Policy and legal analysis
- Research paper review
- Risk & compliance checks
- Decision auditing systems

---

## 🚀 What Makes AETHER Different

- ❌ No prompt-based verdicts
- ✅ ML-first decision making
- ✅ Explicit disagreement modeling
- ✅ Numeric confidence scoring
- ✅ Evidence traceability
- ✅ Production-aware architecture

---


> Most AI systems **answer questions**.  
>  
> **AETHER makes decisions — and knows how confident it should be.**
