from collections import defaultdict
import heapq
import math
from typing import Any


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_nearest_node(nodes: dict[str, dict[str, Any]], lat: float, lon: float) -> str:
    best_id = ""
    best_dist = float("inf")
    for nid, n in nodes.items():
        d = haversine_m(lat, lon, n["lat"], n["lon"])
        if d < best_dist:
            best_dist = d
            best_id = nid
    return best_id


def _project_point_to_segment(
    p_lat: float,
    p_lon: float,
    a_lat: float,
    a_lon: float,
    b_lat: float,
    b_lon: float,
) -> tuple[float, float, float, float]:
    """
    Projects point P onto segment AB.
    Returns (proj_lat, proj_lon, ortho_dist_m, t_clamped).
    """
    cos_lat = math.cos(math.radians(p_lat))
    dx = (b_lon - a_lon) * cos_lat
    dy = b_lat - a_lat
    len_sq = dx * dx + dy * dy
    if len_sq <= 1e-12:
        return a_lat, a_lon, haversine_m(p_lat, p_lon, a_lat, a_lon), 0.0
    px = (p_lon - a_lon) * cos_lat
    py = p_lat - a_lat
    t = max(0.0, min(1.0, (px * dx + py * dy) / len_sq))
    proj_lon = a_lon + t * (b_lon - a_lon)
    proj_lat = a_lat + t * (b_lat - a_lat)
    return proj_lat, proj_lon, haversine_m(p_lat, p_lon, proj_lat, proj_lon), t


def _point_to_segment_dist_m(
    p_lat: float,
    p_lon: float,
    a_lat: float,
    a_lon: float,
    b_lat: float,
    b_lon: float,
) -> float:
    return _project_point_to_segment(p_lat, p_lon, a_lat, a_lon, b_lat, b_lon)[2]


def find_nearest_edge(graph: dict[str, Any], lat: float, lon: float) -> str | None:
    """
    Finds the walkway edge whose line segment has the smallest orthogonal distance
    to the given (lat, lon) coordinate.
    """
    nodes: dict[str, dict[str, Any]] = {n["id"]: n for n in graph.get("nodes", [])}
    best_edge_id: str | None = None
    best_dist = float("inf")

    for e in graph.get("edges", []):
        if str(e.get("id", "")).startswith("ped_x_"):
            continue
        u = nodes.get(e["from_node"])
        v = nodes.get(e["to_node"])
        if not u or not v:
            continue
        d = _point_to_segment_dist_m(lat, lon, u["lat"], u["lon"], v["lat"], v["lon"])
        if d < best_dist:
            best_dist = d
            best_edge_id = e["id"]

    return best_edge_id


def _run_astar(
    nodes: dict[str, dict[str, Any]],
    adj: dict[str, list[tuple[str, float, str]]],
    start_id: str,
    target_id: str,
) -> tuple[list[str] | None, list[str], float]:
    if start_id == target_id:
        return [start_id], [], 0.0

    target_node = nodes[target_id]
    t_lat, t_lon = target_node["lat"], target_node["lon"]

    open_heap: list[tuple[float, float, str]] = []
    heapq.heappush(open_heap, (0.0, 0.0, start_id))

    came_from: dict[str, tuple[str, str]] = {}
    g_score: dict[str, float] = {start_id: 0.0}
    closed: set[str] = set()

    while open_heap:
        _, current_g, current = heapq.heappop(open_heap)
        if current == target_id:
            path_nodes = [current]
            used_edges = []
            while current in came_from:
                prev_node, edge_id = came_from[current]
                path_nodes.append(prev_node)
                if edge_id:
                    used_edges.append(edge_id)
                current = prev_node
            path_nodes.reverse()
            used_edges.reverse()
            return path_nodes, used_edges, round(current_g, 1)

        if current in closed:
            continue
        closed.add(current)

        for neighbor, weight, edge_id in adj.get(current, []):
            if neighbor in closed:
                continue
            tentative_g = current_g + weight
            if tentative_g < g_score.get(neighbor, float("inf")):
                came_from[neighbor] = (current, edge_id)
                g_score[neighbor] = tentative_g
                n_node = nodes[neighbor]
                h = haversine_m(n_node["lat"], n_node["lon"], t_lat, t_lon)
                heapq.heappush(open_heap, (tentative_g + h, tentative_g, neighbor))

    return None, [], 0.0


def _inject_virtual_terminal(
    nodes: dict[str, dict[str, Any]],
    edges: list[dict[str, Any]],
    adj: dict[str, list[tuple[str, float, str]]],
    blocked_edges: set[str],
    virt_id: str,
    lat: float,
    lon: float,
    fallback_node_id: str,
) -> None:
    """
    Projects (`lat`, `lon`) orthogonally onto the single closest open walkway edge `(u, v)`
    at projection node `virt_proj`, and connects `virt_proj` to both `u` and `v`.
    Thus the route stays 100% glued to the drawn walkway and can immediately go in either direction.
    """
    best_edge = None
    best_proj_lat = lat
    best_proj_lon = lon
    min_ortho = float("inf")

    for e in edges:
        eid = e["id"]
        if eid in blocked_edges or eid.startswith("curb_"):
            continue
        u_id, v_id = e["from_node"], e["to_node"]
        u, v = nodes.get(u_id), nodes.get(v_id)
        if not u or not v:
            continue
        proj_lat, proj_lon, ortho_d, _ = _project_point_to_segment(
            lat, lon, u["lat"], u["lon"], v["lat"], v["lon"]
        )
        if ortho_d < min_ortho:
            min_ortho = ortho_d
            best_edge = e
            best_proj_lat = proj_lat
            best_proj_lon = proj_lon

    if best_edge is not None:
        u_id, v_id = best_edge["from_node"], best_edge["to_node"]
        u, v = nodes[u_id], nodes[v_id]
        eid = best_edge["id"]
        nodes[virt_id] = {"id": virt_id, "lat": best_proj_lat, "lon": best_proj_lon}
        du = round(haversine_m(best_proj_lat, best_proj_lon, u["lat"], u["lon"]), 2)
        dv = round(haversine_m(best_proj_lat, best_proj_lon, v["lat"], v["lon"]), 2)
        adj[virt_id].append((u_id, du, eid))
        adj[u_id].append((virt_id, du, eid))
        adj[virt_id].append((v_id, dv, eid))
        adj[v_id].append((virt_id, dv, eid))
    else:
        nodes[virt_id] = {"id": virt_id, "lat": lat, "lon": lon}
        if fallback_node_id in nodes:
            fn = nodes[fallback_node_id]
            d = round(haversine_m(lat, lon, fn["lat"], fn["lon"]), 2)
            adj[virt_id].append((fallback_node_id, d, ""))
            adj[fallback_node_id].append((virt_id, d, ""))


def _smooth_hairpins(coords: list[list[float]]) -> list[list[float]]:
    """
    Removes sharp 180-degree back-and-forth hairpins at the start/end or across parallel lanes.
    """
    if len(coords) < 3:
        return coords
    cleaned = [coords[0]]
    for i in range(1, len(coords) - 1):
        p_prev = cleaned[-1]
        p_curr = coords[i]
        p_next = coords[i + 1]
        cos_lat = math.cos(math.radians(p_curr[1]))
        v1x = (p_curr[0] - p_prev[0]) * cos_lat
        v1y = p_curr[1] - p_prev[1]
        v2x = (p_next[0] - p_curr[0]) * cos_lat
        v2y = p_next[1] - p_curr[1]
        n1 = math.hypot(v1x, v1y)
        n2 = math.hypot(v2x, v2y)
        if n1 > 1e-9 and n2 > 1e-9:
            cos_theta = (v1x * v2x + v1y * v2y) / (n1 * n2)
            # If the path makes a sharp >145 degree reversal (`cos_theta < -0.82`), drop the spike vertex
            if cos_theta < -0.82:
                continue
        cleaned.append(p_curr)
    cleaned.append(coords[-1])
    return cleaned


def compute_pedestrian_route(
    graph: dict[str, Any],
    start_lat: float,
    start_lon: float,
    target_lat: float,
    target_lon: float,
    blocked_edges: set[str],
    target_node_id: str | None = None,
    target_entrance_name: str = "Hedef Noktası",
) -> dict[str, Any]:
    base_nodes: dict[str, dict[str, Any]] = {n["id"]: n for n in graph.get("nodes", [])}
    edges = graph.get("edges", [])

    start_nearest_id = find_nearest_node(base_nodes, start_lat, start_lon)
    if target_node_id and target_node_id in base_nodes:
        end_nearest_id = target_node_id
    else:
        end_nearest_id = find_nearest_node(base_nodes, target_lat, target_lon)

    nodes_open = dict(base_nodes)
    nodes_full = dict(base_nodes)
    adj_open: dict[str, list[tuple[str, float, str]]] = defaultdict(list)
    adj_full: dict[str, list[tuple[str, float, str]]] = defaultdict(list)

    for e in edges:
        u, v = e["from_node"], e["to_node"]
        if u not in base_nodes or v not in base_nodes:
            continue
        w = float(e.get("length_m", 10.0))
        eid = e["id"]
        # Give virtual cross-connectors a tiny 5% preference penalty so A* stays on one sidewalk until crossing is needed
        eff_w = round(w * 1.05, 2) if eid.startswith("ped_x_") else w
        adj_full[u].append((v, eff_w, eid))
        adj_full[v].append((u, eff_w, eid))
        if eid not in blocked_edges:
            adj_open[u].append((v, eff_w, eid))
            adj_open[v].append((u, eff_w, eid))

    virt_start = "__start__"
    virt_end = "__target__"

    _inject_virtual_terminal(
        nodes_full, edges, adj_full, set(), virt_start, start_lat, start_lon, start_nearest_id
    )
    _inject_virtual_terminal(
        nodes_full, edges, adj_full, set(), virt_end, target_lat, target_lon, end_nearest_id
    )

    _inject_virtual_terminal(
        nodes_open,
        edges,
        adj_open,
        blocked_edges,
        virt_start,
        start_lat,
        start_lon,
        start_nearest_id,
    )
    _inject_virtual_terminal(
        nodes_open,
        edges,
        adj_open,
        blocked_edges,
        virt_end,
        target_lat,
        target_lon,
        end_nearest_id,
    )

    # First compute baseline path on unblocked graph to detect if our route avoided any closure
    base_path, base_edges, _ = _run_astar(nodes_full, adj_full, virt_start, virt_end)
    avoided_closures = sum(1 for eid in base_edges if eid in blocked_edges)

    path_nodes, used_edges, _ = _run_astar(nodes_open, adj_open, virt_start, virt_end)
    fallback_used = False

    if path_nodes is None:
        path_nodes = base_path or [virt_start, start_nearest_id, end_nearest_id, virt_end]
        used_edges = base_edges
        fallback_used = True

    raw_coords: list[list[float]] = []
    for nid in path_nodes:
        n = nodes_open.get(nid) or nodes_full.get(nid)
        if not n:
            continue
        pt = [round(n["lon"], 6), round(n["lat"], 6)]
        if not raw_coords or haversine_m(raw_coords[-1][1], raw_coords[-1][0], pt[1], pt[0]) > 1.2:
            raw_coords.append(pt)

    if len(raw_coords) == 1:
        raw_coords.append([round(target_lon, 6), round(target_lat, 6)])

    coords = _smooth_hairpins(raw_coords)
    if len(coords) < 2:
        coords = [
            [round(start_lon, 6), round(start_lat, 6)],
            [round(target_lon, 6), round(target_lat, 6)],
        ]

    total_dist_m = round(
        sum(
            haversine_m(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0])
            for i in range(len(coords) - 1)
        ),
        1,
    )
    duration_min = max(1, math.ceil(total_dist_m / 80.0))

    # Deduplicate used_edges preserving order
    clean_edges: list[str] = []
    for eid in used_edges:
        if eid and (not clean_edges or clean_edges[-1] != eid):
            clean_edges.append(eid)

    return {
        "coordinates": coords,
        "distance_m": total_dist_m,
        "duration_min": duration_min,
        "used_edge_ids": clean_edges,
        "avoided_closures": avoided_closures,
        "fallback_used": fallback_used,
        "target_entrance_name": target_entrance_name,
        "start_node_id": start_nearest_id,
        "target_node_id": end_nearest_id,
    }
