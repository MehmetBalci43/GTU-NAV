from app.database import SessionLocal
from app.main import get_campus_bootstrap, health_check, init_db


def test_health_endpoint() -> None:
    data = health_check()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "ai_model_loaded" in data
    assert data["version"] == "1.0.0"


def test_campus_bootstrap_returns_gtu_buildings_and_graph() -> None:
    init_db()
    db = SessionLocal()
    try:
        payload = get_campus_bootstrap(day=1, time="10:00", db=db).model_dump()
        building_codes = {b["code"] for b in payload["buildings"]}
        assert {"BMB", "ELMB", "TBB", "IBF", "KUT", "YMK", "REK", "MAR"}.issubset(building_codes)
        assert len(payload["walk_graph"]["nodes"]) >= 12
        assert len(payload["walk_graph"]["edges"]) >= 15
        bmb = next(b for b in payload["buildings"] if b["code"] == "BMB")
        assert bmb["total_rooms_count"] >= 4
        assert bmb["free_rooms_count"] >= 1
    finally:
        db.close()
