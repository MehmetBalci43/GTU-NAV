from app.config import settings
from app.database import SessionLocal
from app.main import (
    calculate_route,
    create_or_update_building,
    delete_building,
    init_db,
    toggle_walkway_edge,
    update_building_entrance,
)
from app.routing.astar import find_nearest_edge
from app.schemas import BuildingCreateOrUpdate, BuildingEntranceUpdate, EdgeToggleRequest, RouteRequest
from app.seed import load_buildings_data, load_walk_graph


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
            _=settings.admin_secret_key,
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
        toggle_walkway_edge(
            EdgeToggleRequest(edge_id=blocked_eid, closed=False),
            db=db,
            _=settings.admin_secret_key,
        )
    finally:
        db.close()


def test_admin_can_relocate_building_entrance_and_persist_json() -> None:
    init_db()
    db = SessionLocal()
    try:
        orig_bmb = next(b for b in load_buildings_data() if b["id"] == "bmb")
        orig_lat = orig_bmb["entrance_lat"]
        orig_lon = orig_bmb["entrance_lon"]
        orig_name = orig_bmb["entrance_name"]

        updated = update_building_entrance(
            building_id="bmb",
            req=BuildingEntranceUpdate(
                entrance_lat=40.80805,
                entrance_lon=29.35630,
                entrance_name="BMB Güney Bahçe Giriş Kapısı",
            ),
            db=db,
            _=settings.admin_secret_key,
        )
        assert updated.entrance_name == "BMB Güney Bahçe Giriş Kapısı"
        assert updated.entrance_node_id.startswith("osm_")

        # Verify persistence to gtu_buildings.json
        reloaded_bmb = next(b for b in load_buildings_data() if b["id"] == "bmb")
        assert reloaded_bmb["entrance_name"] == "BMB Güney Bahçe Giriş Kapısı"

        # Restore original entrance so git working tree stays clean
        update_building_entrance(
            building_id="bmb",
            req=BuildingEntranceUpdate(
                entrance_lat=orig_lat,
                entrance_lon=orig_lon,
                entrance_name=orig_name,
            ),
            db=db,
            _=settings.admin_secret_key,
        )
    finally:
        db.close()


def test_admin_create_and_delete_building_persists_to_json() -> None:
    init_db()
    db = SessionLocal()
    try:
        created = create_or_update_building(
            BuildingCreateOrUpdate(
                id="temp_test_lab",
                code="TLAB",
                name="Geçici Test Araştırma Binası",
                category="academic",
                floors_count=2,
                lat=40.8082,
                lon=29.3572,
            ),
            db=db,
            _=settings.admin_secret_key,
        )
        assert created.code == "TLAB"
        assert any(b["id"] == "temp_test_lab" for b in load_buildings_data())

        deleted = delete_building(
            building_id="temp_test_lab",
            db=db,
            _=settings.admin_secret_key,
        )
        assert deleted["deleted"] is True
        assert not any(b["id"] == "temp_test_lab" for b in load_buildings_data())

        graph = load_walk_graph()
        nearest_edge = find_nearest_edge(graph, 40.8080, 29.3565)
        assert nearest_edge is not None
    finally:
        db.close()


