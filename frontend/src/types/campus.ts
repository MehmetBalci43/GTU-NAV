export interface Building {
  id: string;
  code: string;
  name: string;
  category: 'academic' | 'dining' | 'library' | 'admin' | 'transit' | string;
  floors_count: number;
  lat: number;
  lon: number;
  entrance_node_id: string;
  entrance_name: string;
  entrance_lat: number;
  entrance_lon: number;
  secondary_entrance_node_id?: string | null;
  secondary_entrance_name?: string | null;
  secondary_entrance_lat?: number | null;
  secondary_entrance_lon?: number | null;
  polygon_coords: number[][][];
  description?: string | null;
  free_rooms_count: number;
  total_rooms_count: number;
}

export interface WalkGraphNode {
  id: string;
  lat: number;
  lon: number;
  type: 'entrance' | 'walkway' | string;
  label: string;
  building_id?: string | null;
}

export interface WalkGraphEdge {
  id: string;
  name: string;
  highway: string;
  from_node: string;
  to_node: string;
  length_m: number;
}

export interface ExtraBuildingFootprint {
  osm_way_id: number;
  name: string;
  coords: number[][];
  lat: number;
  lon: number;
}

export interface WalkGraph {
  campus_name: string;
  source?: string;
  center: [number, number];
  bounds: {
    sw: [number, number];
    ne: [number, number];
  };
  nodes: WalkGraphNode[];
  edges: WalkGraphEdge[];
  extra_building_footprints?: ExtraBuildingFootprint[];
}

export interface CourseSchedule {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  course_code: string;
  course_name: string;
  instructor?: string | null;
}

export interface ClassroomStatus {
  id: string;
  building_id: string;
  name: string;
  floor: number;
  capacity: number;
  room_type: 'amphitheater' | 'classroom' | 'lab' | string;
  has_outlets: boolean;
  is_currently_free: boolean;
  free_until?: string | null;
  current_course_code?: string | null;
  current_course_name?: string | null;
  current_course_ends_at?: string | null;
  next_course_code?: string | null;
  next_course_starts_at?: string | null;
  is_crowd_busy: boolean;
  crowd_busy_reason?: string | null;
  crowd_report_count: number;
  schedules: CourseSchedule[];
}

export interface BuildingRoomsResponse {
  building: Building;
  query_day: number;
  query_time: string;
  rooms: ClassroomStatus[];
}

export interface MapAlert {
  id: number;
  alert_type: 'road_work' | 'puddle_ice' | 'lighting_fault' | 'event_stand' | 'custom_poi' | string;
  title: string;
  edge_id?: string | null;
  blocks_route: boolean;
  lat: number;
  lon: number;
  upvotes: number;
  downvotes: number;
  is_admin_verified: boolean;
  status: string;
  created_at: string;
}

export interface WrittenTicket {
  id: number;
  reporter_email: string;
  building_id?: string | null;
  classroom_id?: string | null;
  category: 'technical' | 'cleaning' | 'security' | 'infrastructure' | 'suggestion' | string;
  title: string;
  description: string;
  lat?: number | null;
  lon?: number | null;
  ai_department: string;
  ai_urgency_score: number;
  ai_priority_label: 'low' | 'medium' | 'high' | 'critical' | string;
  ai_is_spam: boolean;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected' | string;
  admin_note?: string | null;
  created_at: string;
}

export interface CampusAnnouncement {
  id: number;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'urgent' | string;
  is_active: boolean;
  created_at: string;
}

export interface BootstrapData {
  buildings: Building[];
  walk_graph: WalkGraph;
  active_alerts: MapAlert[];
  blocked_edge_ids: string[];
  announcements: CampusAnnouncement[];
}

export interface RouteResponse {
  coordinates: [number, number][];
  distance_m: number;
  duration_min: number;
  used_edge_ids: string[];
  avoided_closures: number;
  fallback_used: boolean;
  target_entrance_name: string;
  start_node_id: string;
  target_node_id: string;
}

export interface SearchResultItem {
  result_type: 'building' | 'course' | 'classroom';
  title: string;
  subtitle: string;
  building_id: string;
  building_code: string;
  building_name: string;
  classroom_id?: string | null;
  entrance_lat: number;
  entrance_lon: number;
}

export interface UserSession {
  email: string;
  full_name: string;
  role: 'student' | 'admin';
  token: string;
  admin_key?: string;
}
