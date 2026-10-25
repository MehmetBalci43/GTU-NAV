from app.database import SessionLocal
from app.main import (
    calculate_route,
    init_db,
    toggle_walkway_edge,
    update_building_entrance,
)
from app.schemas import BuildingEntranceUpdate, EdgeToggleRequest, RouteRequest


def test_route_from_marmaray_to_computer_engineering() -> None:
    init_db()
    db = SessionLocal()
    try:
        res = calculate_route(
            RouteRequest(
                start_lat=40.807664,
                start_lon=29.363771,
                target_building_id="bmb",
            ),
            db=db,
        )
        assert len(res.coordinates) >= 3
        assert res.distance_m > 200
        assert res.duration_min >= 3
        assert res.fallback_used is False
        assert "BMB" in res.target_entrance_name
    finally:
        db.close()


def test_route_avoids_blocked_edge_and_reroutes() -> None:
    init_db()
    db = SessionLocal()
    try:
        r1 = calculate_route(
            RouteRequest(
                start_lat=40.807664,
                start_lon=29.363771,
                target_building_id="kut",
            ),
            db=db,
        )
        assert len(r1.used_edge_ids) >= 2
        blocked_eid = r1.used_edge_ids[len(r1.used_edge_ids) // 2]

        # Admin closes that edge
        toggle_walkway_edge(
            EdgeToggleRequest(edge_id=blocked_eid, closed=True, reason="Altyapı kazı çalışması"),
            db=db,
        )

        r2 = calculate_route(
            RouteRequest(
                start_lat=40.807664,
                start_lon=29.363771,
                target_building_id="kut",
            ),
            db=db,
        )
        assert blocked_eid not in r2.used_edge_ids
        assert r2.avoided_closures >= 1

        # Re-open the edge after test
        toggle_walkway_edge(EdgeToggleRequest(edge_id=blocked_eid, closed=False), db=db)
    finally:
        db.close()


def test_admin_can_relocate_building_entrance() -> None:
    init_db()
    db = SessionLocal()
    try:
        updated = update_building_entrance(
            building_id="bmb",
            req=BuildingEntranceUpdate(
                entrance_lat=40.80805,
                entrance_lon=29.35630,
                entrance_name="BMB Güney Bahçe Giriş Kapısı",
            ),
            db=db,
        )
        assert updated.entrance_name == "BMB Güney Bahçe Giriş Kapısı"
        assert updated.entrance_node_id.startswith("osm_")
    finally:
        db.close()
