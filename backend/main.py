import hashlib
import json
import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
from data_loader import load_data, load_evidence_index
from api.simulate import router as simulate_router
from api.simulate_population import router as population_router

_LOG_LEVEL = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)
logging.basicConfig(
    level=_LOG_LEVEL,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

# Global state
drug_db = []
drug_classes_db = []
evidence_index = {}
simulation_cache: dict = {}


def make_cache_key(profile, drug, subject_id=None):
    # Bump _v when alert copy / enrichment shape changes so clients don't see stale generic text.
    # subject_id: optional client id so distinct patients never share a cache entry if profiles ever match.
    payload = {"profile": profile, "drug": drug, "_v": "side-effects-patient-v3"}
    if subject_id:
        payload["subject_id"] = subject_id
    return hashlib.md5(json.dumps(payload, sort_keys=True).encode()).hexdigest()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global drug_db, drug_classes_db, evidence_index
    drug_db, drug_classes_db = load_data()
    evidence_index = load_evidence_index()
    print(
        f"Loaded {len(drug_db)} drugs, {len(drug_classes_db)} drug classes, "
        f"{len(evidence_index)} evidence-drug entries"
    )
    yield


app = FastAPI(title="MediTwin API", version="3.0", lifespan=lifespan)

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

allowed_hosts = [
    host.strip()
    for host in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,*").split(",")
    if host.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=(
        r"^https?://("
        r"localhost|127\.0\.0\.1|"
        r"192\.168\.\d+\.\d+|"
        r"10\.\d+\.\d+\.\d+|"
        r"172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+"
        r")(:\d+)?$"
    ),
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

app.include_router(simulate_router, prefix="/api")
app.include_router(population_router, prefix="/api")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "drugs_loaded": len(drug_db),
        "classes_loaded": len(drug_classes_db),
        "evidence_drugs_loaded": len(evidence_index),
    }


@app.get("/api/drugs/search")
async def search_drugs(q: str = ""):
    """Search drugs by name or brand name."""
    if not q or len(q) < 2:
        return {"results": drug_db[:10]}
    query = q.lower()
    results = [
        d for d in drug_db
        if query in d["name"].lower() or
           any(query in b.lower() for b in d.get("brand_names", []))
    ][:10]
    return {"results": results}


@app.get("/api/drugs")
async def list_drugs():
    """List all drugs."""
    return {"results": drug_db}


@app.get("/api/drug-classes")
async def list_drug_classes():
    """List all drug classes."""
    return {"results": drug_classes_db}
