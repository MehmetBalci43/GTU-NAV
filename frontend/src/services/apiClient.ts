import {
  BootstrapData,
  Building,
  BuildingRoomsResponse,
  CampusAnnouncement,
  ClassroomStatus,
  MapAlert,
  RouteResponse,
  SearchResultItem,
  UserSession,
  WalkGraphEdge,
  WrittenTicket,
} from '../types/campus';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let message = `İstek başarısız oldu (${res.status})`;
    try {
      const errData = await res.json();
      if (errData?.detail) {
        message = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getBootstrap(day?: number, time?: string): Promise<BootstrapData> {
    const params = new URLSearchParams();
    if (day !== undefined) params.set('day', String(day));
    if (time) params.set('time', time);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return requestJson<BootstrapData>(`/api/campus/bootstrap${qs}`);
  },

  login(email: string, role?: 'student' | 'admin'): Promise<UserSession> {
    return requestJson<UserSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  },

  calculateRoute(payload: {
    start_lat: number;
    start_lon: number;
    target_building_id?: string;
    target_lat?: number;
    target_lon?: number;
  }): Promise<RouteResponse> {
    return requestJson<RouteResponse>('/api/route', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getBuildingRooms(buildingId: string, day?: number, time?: string): Promise<BuildingRoomsResponse> {
    const params = new URLSearchParams();
    if (day !== undefined) params.set('day', String(day));
    if (time) params.set('time', time);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return requestJson<BuildingRoomsResponse>(`/api/buildings/${buildingId}/rooms${qs}`);
  },

  reportClassroomBusy(classroomId: string, reason: string): Promise<ClassroomStatus> {
    return requestJson<ClassroomStatus>(`/api/classrooms/${classroomId}/report-busy`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  clearClassroomBusy(classroomId: string): Promise<ClassroomStatus> {
    return requestJson<ClassroomStatus>(`/api/classrooms/${classroomId}/clear-busy`, {
      method: 'POST',
    });
  },

  searchCampus(query: string): Promise<{ query: string; results: SearchResultItem[] }> {
    return requestJson<{ query: string; results: SearchResultItem[] }>(
      `/api/search?q=${encodeURIComponent(query)}`
    );
  },

  createMapAlert(payload: {
    alert_type: string;
    title?: string;
    edge_id?: string | null;
    blocks_route?: boolean;
    lat: number;
    lon: number;
    is_admin_verified?: boolean;
  }): Promise<MapAlert> {
    return requestJson<MapAlert>('/api/alerts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  voteMapAlert(alertId: number, vote: 'up' | 'down'): Promise<MapAlert> {
    return requestJson<MapAlert>(`/api/alerts/${alertId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote }),
    });
  },

  deleteMapAlert(alertId: number): Promise<{ id: number; status: string }> {
    return requestJson<{ id: number; status: string }>(`/api/admin/alerts/${alertId}`, {
      method: 'DELETE',
    });
  },

  createWrittenTicket(payload: {
    reporter_email: string;
    building_id?: string | null;
    classroom_id?: string | null;
    category: string;
    title: string;
    description: string;
    lat?: number | null;
    lon?: number | null;
  }): Promise<WrittenTicket> {
    return requestJson<WrittenTicket>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  listWrittenTickets(reporterEmail?: string): Promise<WrittenTicket[]> {
    const qs = reporterEmail ? `?reporter_email=${encodeURIComponent(reporterEmail)}` : '';
    return requestJson<WrittenTicket[]>(`/api/tickets${qs}`);
  },

  updateWrittenTicketStatus(
    ticketId: number,
    status: 'pending' | 'in_progress' | 'resolved' | 'rejected',
    adminNote?: string
  ): Promise<WrittenTicket> {
    return requestJson<WrittenTicket>(`/api/admin/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, admin_note: adminNote }),
    });
  },

  toggleWalkwayEdge(edgeId: string, closed: boolean, reason?: string): Promise<{ edge_id: string; closed: boolean }> {
    return requestJson<{ edge_id: string; closed: boolean }>('/api/admin/edges/toggle', {
      method: 'POST',
      body: JSON.stringify({ edge_id: edgeId, closed, reason }),
    });
  },

  updateBuildingEntrance(
    buildingId: string,
    entranceLat: number,
    entranceLon: number,
    entranceName?: string
  ): Promise<Building> {
    return requestJson<Building>(`/api/admin/buildings/${buildingId}/entrance`, {
      method: 'PUT',
      body: JSON.stringify({
        entrance_lat: entranceLat,
        entrance_lon: entranceLon,
        entrance_name: entranceName,
      }),
    });
  },

  createOrUpdateBuilding(payload: {
    id: string;
    code: string;
    name: string;
    category: string;
    floors_count: number;
    lat: number;
    lon: number;
    entrance_lat?: number;
    entrance_lon?: number;
    entrance_name?: string;
    polygon_coords?: number[][][];
    description?: string;
  }): Promise<Building> {
    return requestJson<Building>('/api/admin/buildings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createCustomWalkwayEdge(payload: {
    from_lat: number;
    from_lon: number;
    to_lat: number;
    to_lon: number;
    name: string;
  }): Promise<WalkGraphEdge> {
    return requestJson<WalkGraphEdge>('/api/admin/edges', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createAnnouncement(payload: {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'urgent';
  }): Promise<CampusAnnouncement> {
    return requestJson<CampusAnnouncement>('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deactivateAnnouncement(announcementId: number): Promise<{ id: number; is_active: boolean }> {
    return requestJson<{ id: number; is_active: boolean }>(`/api/admin/announcements/${announcementId}`, {
      method: 'DELETE',
    });
  },
};
