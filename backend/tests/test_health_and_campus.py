from app.config import settings
from app.database import SessionLocal
from app.main import (
    clear_classroom_busy,
    get_building_rooms,
    get_campus_bootstrap,
    health_check,
    init_db,
    report_classroom_busy,
    search_campus,
)
from app.schemas import BusyReportRequest


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
        assert {"BMB", "ELMB", "TBB", "MAB", "IBF", "KUT", "YMK", "REK", "MAR"}.issubset(building_codes)
        assert len(payload["buildings"]) >= 20
        assert len(payload["walk_graph"]["nodes"]) >= 1000
        assert len(payload["walk_graph"]["edges"]) >= 1200
        bmb = next(b for b in payload["buildings"] if b["code"] == "BMB")
        assert bmb["total_rooms_count"] >= 4
        assert bmb["free_rooms_count"] >= 1
    finally:
        db.close()


def test_empty_rooms_and_crowd_busy_report() -> None:
    init_db()
    db = SessionLocal()
    try:
        res = get_building_rooms(building_id="bmb", day=1, time="10:00", db=db)
        free_room = next(r for r in res.rooms if r.is_currently_free)

        # Student reports room is busy
        reported = report_classroom_busy(
            classroom_id=free_room.id,
            req=BusyReportRequest(reason="IEEE Kulüp Etkinliği"),
            db=db,
        )
        assert reported.is_currently_free is False
        assert reported.is_crowd_busy is True
        assert reported.crowd_busy_reason == "IEEE Kulüp Etkinliği"

        # Clear busy status
        cleared = clear_classroom_busy(
            classroom_id=free_room.id,
            db=db,
            _=settings.admin_secret_key,
        )
        assert cleared.is_crowd_busy is False
    finally:
        db.close()


def test_weekend_and_night_rooms_are_free() -> None:
    init_db()
    db = SessionLocal()
    try:
        weekend_res = get_building_rooms(building_id="bmb", day=6, time="11:00", db=db)
        assert all(r.is_currently_free for r in weekend_res.rooms)
    finally:
        db.close()


def test_search_by_course_code_and_building() -> None:
    init_db()
    db = SessionLocal()
    try:
        res_cse = search_campus(q="CSE 101", db=db)
        assert len(res_cse.results) >= 1
        assert res_cse.results[0].building_id == "bmb"

        res_math = search_campus(q="MATH 101", db=db)
        assert len(res_math.results) >= 1
        assert res_math.results[0].building_id == "tbb"
    finally:
        db.close()
