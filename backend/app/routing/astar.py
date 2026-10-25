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
    nodes: dict[str, dict[str, Any]] = {n["id"]: n for n in graph.get("nodes", [])}

    start_id = find_nearest_node(nodes, start_lat, start_lon)
    if target_node_id and target_node_id in nodes:
        end_id = target_node_id
    else:
        end_id = find_nearest_node(nodes, target_lat, target_lon)

    # Build adjacency list excluding blocked_edges
    adj_open: dict[str, list[tuple[str, float, str]]] = defaultdict(list)
    adj_full: dict[str, list[tuple[str, float, str]]] = defaultdict(list)

    for e in graph.get("edges", []):
        u, v = e["from_node"], e["to_node"]
        if u not in nodes or v not in nodes:
            continue
        w = float(e.get("length_m", 10.0))
        eid = e["id"]
        adj_full[u].append((v, w, eid))
        adj_full[v].append((u, w, eid))
        if eid not in blocked_edges:
            adj_open[u].append((v, w, eid))
            adj_open[v].append((u, w, eid))

    # First compute baseline path on unblocked graph to detect if our route avoided any closure
    base_nodes, base_edges, _ = _run_astar(nodes, adj_full, start_id, end_id)
    avoided_closures = sum(1 for eid in base_edges if eid in blocked_edges)

    path_nodes, used_edges, total_dist_m = _run_astar(nodes, adj_open, start_id, end_id)
    fallback_used = False

    if path_nodes is None:
        # Review Focus #1: If all possible paths to target are blocked, use full graph with fallback flag
        path_nodes, used_edges, total_dist_m = base_nodes or [start_id, end_id], base_edges, 0.0
        fallback_used = True
        if len(path_nodes) >= 2:
            total_dist_m = round(
                sum(
                    haversine_m(
                        nodes[path_nodes[i]]["lat"],
                        nodes[path_nodes[i]]["lon"],
                        nodes[path_nodes[i + 1]]["lat"],
                        nodes[path_nodes[i + 1]]["lon"],
                    )
                    for i in range(len(path_nodes) - 1)
                ),
                1,
            )

    coords: list[list[float]] = []
    # Include exact start coordinate if slightly off the first node
    first_node = nodes[path_nodes[0]]
    if haversine_m(start_lat, start_lon, first_node["lat"], first_node["lon"]) > 3.0:
        coords.append([round(start_lon, 6), round(start_lat, 6)])

    for nid in path_nodes:
        n = nodes[nid]
        coords.append([round(n["lon"], 6), round(n["lat"], 6)])

    if len(coords) == 1:
        coords.append([round(target_lon, 6), round(target_lat, 6)])

    # Walking speed ~1.35 m/s (~81 m/min)
    duration_min = max(1, math.ceil(total_dist_m / 80.0))

    return {
        "coordinates": coords,
        "distance_m": round(total_dist_m, 1),
        "duration_min": duration_min,
        "used_edge_ids": used_edges,
        "avoided_closures": avoided_closures,
        "fallback_used": fallback_used,
        "target_entrance_name": target_entrance_name,
        "start_node_id": start_id,
        "target_node_id": end_id,
    }
