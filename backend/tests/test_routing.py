from app.config import settings
from app.database import SessionLocal
from app.main import (
    calculate_route,
    create_or_update_building,
    delete_building,
    delete_extra_footprints,
    init_db,
    toggle_walkway_edge,
    update_building_entrance,
    update_extra_footprints,
)
from app.routing.astar import find_nearest_edge
from app.schemas import (
    BuildingCreateOrUpdate,
    BuildingEntranceUpdate,
    EdgeToggleRequest,
    FootprintDeleteRequest,
    FootprintItemUpdate,
    FootprintUpdateRequest,
    RouteRequest,
)
from app.seed import load_buildings_data, load_walk_graph, save_walk_graph


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


def test_admin_create_multipart_building_and_cleans_footprints() -> None:
    init_db()
    db = SessionLocal()
    try:
        fake_way_id = 999999999
        graph = load_walk_graph()
        graph["extra_building_footprints"].append({
            "osm_way_id": fake_way_id,
            "name": "Geçici Test Ayak İzi",
            "coords": [[29.356, 40.808], [29.357, 40.808], [29.357, 40.809], [29.356, 40.809], [29.356, 40.808]],
            "lat": 40.8085,
            "lon": 29.3565,
        })
        save_walk_graph(graph)

        created = create_or_update_building(
            BuildingCreateOrUpdate(
                id="temp_multipart_fac",
                code="TMULTI",
                name="Geçici Çok Bloklu Test Tesisi",
                category="academic",
                floors_count=3,
                lat=40.8085,
                lon=29.3565,
                polygon_coords=[
                    [[[29.356, 40.808], [29.357, 40.808], [29.357, 40.809], [29.356, 40.809], [29.356, 40.808]]],
                    [[[29.358, 40.808], [29.359, 40.808], [29.359, 40.809], [29.358, 40.809], [29.358, 40.808]]]
                ],
                osm_way_ids=[fake_way_id],
            ),
            db=db,
            _=settings.admin_secret_key,
        )
        assert created.code == "TMULTI"
        assert len(created.polygon_coords) == 2

        # Verify footprint was removed from walk graph
        reloaded_graph = load_walk_graph()
        assert not any(fp.get("osm_way_id") == fake_way_id for fp in reloaded_graph["extra_building_footprints"])

        # Clean up created building
        delete_building(building_id="temp_multipart_fac", db=db, _=settings.admin_secret_key)
        assert not any(b["id"] == "temp_multipart_fac" for b in load_buildings_data())
    finally:
        db.close()


def test_route_starting_inside_building_uses_building_exit_door() -> None:
    init_db()
    db = SessionLocal()
    try:
        bmb = next(b for b in load_buildings_data() if b["id"] == "bmb")
        res = calculate_route(
            RouteRequest(
                start_lat=bmb["lat"],
                start_lon=bmb["lon"],
                target_building_id="kut",
            ),
            db=db,
        )
        assert len(res.coordinates) >= 3
        # First coordinate is user's interior start point; second coordinate is snapped exit door
        start_lon, start_lat = res.coordinates[0]
        assert abs(start_lat - bmb["lat"]) < 0.0001
        assert abs(start_lon - bmb["lon"]) < 0.0001
        door_lon, door_lat = res.coordinates[1]
        assert abs(door_lat - bmb["entrance_lat"]) < 0.0002
        assert abs(door_lon - bmb["entrance_lon"]) < 0.0002
    finally:
        db.close()


def test_building_and_footprint_geometry_updates_persist_to_json() -> None:
    init_db()
    db = SessionLocal()
    try:
        # 1. Test extra_building_footprints resize/move persistence in gtu_walk_graph.json
        fake_fp_id = 888888888
        resized_coords = [
            [29.3571, 40.8081],
            [29.3579, 40.8081],
            [29.3579, 40.8087],
            [29.3571, 40.8087],
            [29.3571, 40.8081],
        ]
        res_fp = update_extra_footprints(
            FootprintUpdateRequest(
                footprints=[
                    FootprintItemUpdate(
                        osm_way_id=fake_fp_id,
                        name="Boyutlandırılmış Test Bloğu",
                        coords=resized_coords,
                    )
                ]
            ),
            _=settings.admin_secret_key,
        )
        assert res_fp["updated_count"] == 1
        saved_fp = next(
            fp for fp in load_walk_graph()["extra_building_footprints"] if fp.get("osm_way_id") == fake_fp_id
        )
        assert saved_fp["coords"] == resized_coords

        delete_extra_footprints(
            FootprintDeleteRequest(osm_way_ids=[fake_fp_id]),
            _=settings.admin_secret_key,
        )

        # 2. Test existing building geometry resize/rotate/move persistence in gtu_buildings.json
        created = create_or_update_building(
            BuildingCreateOrUpdate(
                id="temp_geom_test",
                code="TGEOM",
                name="Geometri Test Binası",
                category="academic",
                floors_count=2,
                lat=40.8082,
                lon=29.3572,
                polygon_coords=[[[29.357, 40.808], [29.3574, 40.808], [29.3574, 40.8084], [29.357, 40.8084], [29.357, 40.808]]],
            ),
            db=db,
            _=settings.admin_secret_key,
        )
        new_poly = [[[29.3568, 40.8079], [29.3578, 40.8079], [29.3578, 40.8086], [29.3568, 40.8086], [29.3568, 40.8079]]]
        updated = create_or_update_building(
            BuildingCreateOrUpdate(
                id=created.id,
                code="TGEOM",
                name="Geometri Test Binası",
                category="academic",
                floors_count=2,
                lat=40.80825,
                lon=29.3573,
                polygon_coords=new_poly,
            ),
            db=db,
            _=settings.admin_secret_key,
        )
        assert updated.polygon_coords == new_poly
        json_bld = next(b for b in load_buildings_data() if b["id"] == "temp_geom_test")
        assert json_bld["polygon_coords"] == new_poly
        assert json_bld["lat"] == 40.80825

        delete_building(building_id="temp_geom_test", db=db, _=settings.admin_secret_key)
    finally:
        db.close()




