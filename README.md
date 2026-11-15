# Zero-Trust LLM Gateway

### Deep Prompt Inspection & SOC Mitigation Pipeline

**Zero-Trust LLM Gateway** is an end-to-end AI Prompt Injection Defense API and Security Operations Center (SOC) inspection pipeline. Engineered as an asynchronous reverse proxy sitting directly between user ingress and the core Large Language Model (LLM), the gateway intercepts, inspects, and sanitizes every incoming request in real time. By enforcing deterministic Data Loss Prevention (DLP), adaptive volumetric rate limiting, and local semantic classification via `llama-guard3`, the system neutralizes adversarial jailbreaks, sensitive data exfiltration, and model denial-of-service (mDoS) payloads before they ever reach downstream inference engines.

## 1. Project Architecture: 5-Stage Zero-Trust Flow

The gateway enforces a strict, fail-closed security pipeline. Every client request must sequentially pass through five inspection and mitigation stages before downstream execution is authorized:

| Stage | Component | Security Function & Technical Implementation | 
| ----- | ----- | ----- | 
| **Stage 1** | **Prompt Ingress** | **Asynchronous FastAPI Reverse Proxy:** Terminates client HTTP/REST requests from the operator console (`http://localhost:3000`) at the `/chat` gateway endpoint (`http://localhost:8000/chat`). Normalizes request schemas, extracts client metadata, and initializes an isolated inspection context via Uvicorn ASGI workers. | 
| **Stage 2** | **Pattern DLP Scrubber** | **Deterministic Regex Sanitization:** Executes high-speed regular expression matching across raw prompt payloads prior to model evaluation. Detects and scrubs Personally Identifiable Information (PII), credit card numbers, SSNs, bearer tokens, cloud provider credentials (AWS/GCP), and hardcoded API keys (`sk-...`, GitHub PATs) to prevent accidental or malicious secret leakage into model context windows. | 
| **Stage 3** | **mDoS Rate Limiter** | **Adaptive Token Bucket Throttling:** Protects local GPU/CPU inference compute against Model Denial-of-Service (mDoS) and automated fuzzing attacks. Tracks per-client request velocity and token burst consumption in memory, immediately dropping excessive traffic with `HTTP 429 Too Many Requests` before expensive semantic inference is invoked. | 
| **Stage 4** | **Semantic Firewall** | **Local `llama-guard3` Intent Evaluation:** Routes sanitized, rate-cleared prompts to a locally hosted Ollama instance running `llama-guard3`. Evaluates semantic intent against the MLCommons hazard taxonomy to detect sophisticated adversarial framing, roleplay/persona jailbreaks (e.g., DAN/rogue AI scenarios), indirect prompt injections, and system prompt extraction attempts. Unsafe payloads trigger an immediate `HTTP 403 Forbidden` drop. | 
| **Stage 5** | **Secure Audit Log** | **SIEM-Ready Telemetry & Compliance Logging:** Writes structured, timestamped event records to `security_audit.log` in real time. Captures ingress timestamps, client identifiers, triggered defense stages, hazard classifications, latency metrics, and HTTP status codes (`200 OK`, `403 BLOCKED`, `429 RATE_LIMITED`) for forensic auditing and SIEM ingestion. | 

## 2. Pipeline & Visual Roadmap

The architectural flow below illustrates the complete 5-stage Zero-Trust inspection pathway from operator prompt ingress to verified model execution and SIEM telemetry generation:

## 3. Demos & Interface Screenshots

### Live SOC Telemetry & Defense Status Dashboard

*Figure 1: The Next.js 15 dark-mode SOC telemetry header displaying live gateway health, active defense layer toggles (Pattern DLP, mDoS Rate Limiter, Semantic Firewall), and real-time backend inspection counters.*

### Interactive Operator Console

*Figure 2: The single-page operator chat interface built with Tailwind CSS and Framer Motion, featuring keyboard-locked submission controls (`Ctrl + Enter`), real-time terminal scanning states, and direct REST wiring to the FastAPI proxy.*

### Stage 4 Semantic Firewall: Adversarial Jailbreak Mitigation (`403 THREAT BLOCKED`)

*Figure 3: `llama-guard3` actively intercepting and dropping a complex, multi-layered rogue AI scenario-based jailbreak payload. The gateway halts execution prior to core LLM inference and returns an explicit `403 THREAT BLOCKED` security exception to the console.*

### Verified Benign Payload Execution (`200 OK`)

*Figure 4: A legitimate, policy-compliant prompt clearing all five Zero-Trust inspection stages (DLP scrubbing, token bucket validation, and semantic safety classification) and returning a verified `200 OK` response payload.*

### Real-Time SIEM Audit Trail (`security_audit.log`)

*Figure 5: Live terminal tail of `security_audit.log` capturing, timestamping, and classifying both permitted (`200`) and blocked (`403`/`429`) prompt transactions in a structured, SIEM-ready audit format.*

## 4. Local Setup & Installation

Follow these steps to deploy the full Zero-Trust LLM Gateway stack locally for testing and evaluation.

### Step 1: Clone the Repository

```
git clone https://github.com/AbhishekAthreya/zero-trust-soc-gateway.git
cd zero-trust-soc-gateway

```

### Step 2: Install Ollama & Pull the Semantic Firewall Model

Ensure [Ollama](https://ollama.com/) is installed and running on your host machine, then pull `llama-guard3`. Note that **`llama-guard3` is the ONLY required engine model** for the semantic firewall pipeline:

```
ollama serve
ollama pull llama-guard3

```

### Step 3: Configure & Launch the FastAPI Backend (Port `8000`)

Create an isolated Python virtual environment, install the backend dependencies, and start the asynchronous Uvicorn ASGI server on port `8000`:

```
cd backend
python -m venv venv

# Activate virtual environment (Windows)
venv\Scripts\activate
# Activate virtual environment (Linux / macOS)
source venv/bin/activate

pip install fastapi uvicorn httpx pydantic
uvicorn main:app --reload --host 0.0.0.0 --port 8000

```

### Step 4: Configure & Launch the Next.js 15 Frontend (Port `3000`)

Open a separate terminal window, install the Node.js packages, and start the Next.js development server on port `3000`:

```
cd frontend
npm install
npm run dev

```

Navigate to `http://localhost:3000` in your browser to access the SOC operator console.

> **Troubleshooting Next.js Hydration Errors (Brave Shields / Browser Extensions):**
> Privacy-hardened browsers (such as **Brave Browser** with Brave Shields active) and DOM-injecting browser extensions (password managers, ad blockers, or script injectors) frequently modify HTML attributes before React completes client-side hydration, triggering Next.js 15 hydration mismatch warnings during local development. For clean local testing on `http://localhost:3000`, disable Brave Shields for `localhost` or open the dashboard in a clean **Incognito / Private Window** with browser extensions disabled.

## 5. Enterprise Use Cases & Why It Matters

Deploying LLMs directly to production without an intermediary inspection proxy exposes organizations to severe operational, financial, and regulatory risks. Zero-Trust LLM Gateway addresses critical enterprise security requirements mapped to the **OWASP Top 10 for Large Language Model Applications**:

* **Enforcing a Zero-Trust Enterprise Security Posture (OWASP LLM01: Prompt Injection):** Treats every user input and external context payload as untrusted until verified. Decouples security enforcement from the underlying LLM's system prompt—which can be bypassed via adversarial framing—by placing a dedicated, deterministic-plus-semantic inspection layer (`llama-guard3`) in front of the inference engine.

* **Preventing Intellectual Property & PII Exfiltration (OWASP LLM06: Sensitive Information Disclosure):** Employees frequently paste proprietary source code, internal API keys, customer PII, or database credentials into enterprise AI assistants. The Stage 2 Pattern DLP Scrubber strips sensitive tokens at the proxy boundary before they are transmitted to external model providers or logged in training corpora.

* **Mitigating Compute Exhaustion & Financial Denial-of-Wallet (OWASP LLM04: Model Denial of Service):** Unbounded prompt lengths and high-frequency automated requests can saturate local GPU VRAM or rack up thousands of dollars in commercial API token billing within minutes. The Stage 3 Adaptive Token Bucket Rate Limiter enforces strict per-client request quotas at minimal CPU cost.

* **Avoiding Regulatory & Compliance Penalties (GDPR, HIPAA, SOC 2, ISO 27001):** Unauthorized processing of unredacted PII or failure to log security incidents can result in severe statutory fines under GDPR and HIPAA. Combining pre-inference DLP redaction with immutable, timestamped `security_audit.log` telemetry provides audit-ready evidence of policy enforcement and incident response.

* **Protecting Brand Reputation & Preventing Autonomous Agent Hijacking:** Adversarial jailbreaks that coerce corporate chatbots into generating toxic content, unauthorized financial commitments, or malicious code create immediate legal and reputational liability. Intercepting rogue persona and jailbreak scenarios with `HTTP 403` blocks ensures downstream models operate strictly within authorized enterprise boundaries.
