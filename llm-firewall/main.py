from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import time
import re
import requests

# 1. Setup Audit Logging
logging.basicConfig(
    filename="security_audit.log", 
    level=logging.INFO, 
    format="%(asctime)s - [GATEWAY] - %(message)s"
)

app = FastAPI(title="Zero-Trust LLM Gateway")

# 2. CORS MIDDLEWARE - This is what fixes the browser block
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Security State
class ChatRequest(BaseModel):
    prompt: str

# mDoS token bucket tracker (IP -> Timestamp)
request_tracker = {}
RATE_LIMIT_SECONDS = 3

# 4. Security Functions
def check_mdos_rate_limit(ip: str):
    current_time = time.time()
    if ip in request_tracker:
        time_passed = current_time - request_tracker[ip]
        if time_passed < RATE_LIMIT_SECONDS:
            logging.warning(f"mDoS Blocked: Rate limit exceeded for IP {ip}")
            raise HTTPException(status_code=429, detail="mDoS Rate Limiter active. Please slow down.")
    request_tracker[ip] = current_time

def scrub_pii_dlp(prompt: str) -> str:
    original = prompt

    # Regex to find credit card numbers (13-16 contiguous digits, or groups of 4 separated by spaces/dashes)
    cc_pattern = r'\b(?:\d{4}[- ]){3}\d{1,4}\b|\b\d{13,16}\b'
    prompt = re.sub(cc_pattern, "[REDACTED_CC]", prompt)

    # Regex to find email addresses
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'
    prompt = re.sub(email_pattern, "[REDACTED_EMAIL]", prompt)

    if prompt != original:
        logging.info("Pattern DLP: Sensitive PII redacted from payload.")
    return prompt

def check_llama_guard(prompt: str):
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama-guard3",  # Assuming you pulled llama-guard3 in Ollama
                "prompt": prompt,
                "stream": False
            },
            timeout=30,
        )
        if response.status_code == 200:
            result = response.json().get("response", "").strip().lower()
            if "unsafe" in result:
                logging.error("Llama Guard 3: Semantic threat detected and blocked.")
                raise HTTPException(status_code=403, detail="Payload blocked by Semantic Prompt Firewall.")
    except HTTPException:
        # Re-raise FastAPI HTTPExceptions (e.g. the 403 above) so they aren't caught below
        raise
    except requests.exceptions.RequestException as exc:
        logging.error(f"Ollama connection failed: {exc}. Ensure Ollama is running.")
        # Fail closed for Zero-Trust posture
        raise HTTPException(status_code=500, detail="Security Engine Offline.")

# 5. Core Gateway Endpoint
@app.post("/chat")
async def chat_gateway(request: Request, payload: ChatRequest):
    client_ip = request.client.host if request.client else "unknown"
    
    # Layer 1: mDoS Rate Limiter (Denial of Service defense)
    check_mdos_rate_limit(client_ip)
    
    # Layer 2: Pattern DLP (Information Disclosure defense)
    safe_prompt = scrub_pii_dlp(payload.prompt)
    
    # Layer 3: Semantic Firewall (Elevation of Privilege defense)
    check_llama_guard(safe_prompt)
    
    # If all defenses pass, log the clean prompt and return success
    logging.info(f"Payload cleared for IP {client_ip}. Prompt: {safe_prompt}")
    
    return {
        "status": "success",
        "original_prompt": payload.prompt,
        "sanitized_prompt": safe_prompt,
        "reply": "System secure. Payload processed successfully."
    }
