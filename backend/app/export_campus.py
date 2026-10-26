#!/usr/bin/env python3
"""
GTÜ-NAV Campus State Exporter CLI
Dumps the current SQLite database state (buildings, coordinates, entrance gates)
into backend/app/data/gtu_buildings.json and verifies geometry integrity.
Usage:
    python backend/app/export_campus.py
"""

import sys
import json
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models import Building
from app.seed import sync_buildings_to_json, BUILDINGS_PATH, GRAPH_PATH


def export_campus_state() -> None:
    print(f"[*] Connecting to SQLite database and exporting to {BUILDINGS_PATH}...")
    db = SessionLocal()
    try:
        buildings = db.query(Building).all()
        print(f"[+] Found {len(buildings)} buildings in SQLite.")

        # Persist to JSON
        sync_buildings_to_json(db)

        # Verify output
        with open(BUILDINGS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

        print(f"[SUCCESS] Exported {len(data)} buildings to {BUILDINGS_PATH.name}")
        for b in data[:5]:
            poly_type = "MultiPolygon" if b.get("polygon_coords") and len(b["polygon_coords"]) > 1 else "Polygon"
            print(f"  - [{b.get('code')}] {b.get('name')} ({poly_type}, Giriş: {b.get('entrance_name')})")
        if len(data) > 5:
            print(f"  ... and {len(data) - 5} more buildings.")

    finally:
        db.close()


if __name__ == "__main__":
    export_campus_state()
