Evidence Data Pipeline

This folder stores lightweight, source-of-truth snapshots and standardized signals.

1) Collect online source snapshots (no bulk archive downloads):
   python backend/data_ingestion/collect_online_sources.py

   Sources:
   - openFDA drug/event (FAERS-backed)
   - targeted 20-drug FAERS pulls using `data/evidence/target_drugs_20.json`
   - DailyMed SPL metadata API
   - RxNav RxCUI mappings
   - ChEMBL warning/indication/mechanism endpoints

   Resilience:
   - If live targeted FAERS requests fail, ingestion falls back to the last cached `faers_targeted_events.json` entries for those drugs.

   Metadata is written to:
   - data/evidence/meta/source_registry.json

   Each source entry stores:
   - source_url
   - download_timestamp
   - sha256
   - version_quarter
   - path

2) Standardize to ML-ready signals:
   python backend/data_ingestion/standardize_sources.py

   Output:
   - data/evidence/standardized_signals.csv

   Standardization includes:
   - drug normalization + RxCUI mapping
   - reaction normalization to MedDRA PT text
   - route and dose unit standardization
   - age band and sex standardization
   - malformed/empty row exclusion and aggregation
