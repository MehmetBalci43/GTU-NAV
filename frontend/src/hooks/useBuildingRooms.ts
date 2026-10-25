import { useState, useEffect, useCallback } from 'react';
import { BuildingRoomsResponse } from '../types/campus';
import { api } from '../services/apiClient';

export function useBuildingRooms(selectedBuildingId: string | null) {
  const [roomsData, setRoomsData] = useState<BuildingRoomsResponse | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState<boolean>(false);

  const fetchRooms = useCallback(async (buildingId: string) => {
    setIsLoadingRooms(true);
    try {
      const data = await api.getBuildingRooms(buildingId);
      setRoomsData(data);
    } catch {
      setRoomsData(null);
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedBuildingId) {
      setRoomsData(null);
      return;
    }
    fetchRooms(selectedBuildingId);
  }, [selectedBuildingId, fetchRooms]);

  const reportBusy = useCallback(
    async (classroomId: string, reason: string) => {
      if (!selectedBuildingId) return;
      await api.reportClassroomBusy(classroomId, reason);
      await fetchRooms(selectedBuildingId);
    },
    [selectedBuildingId, fetchRooms]
  );

  const clearBusy = useCallback(
    async (classroomId: string) => {
      if (!selectedBuildingId) return;
      await api.clearClassroomBusy(classroomId);
      await fetchRooms(selectedBuildingId);
    },
    [selectedBuildingId, fetchRooms]
  );

  return {
    roomsData,
    isLoadingRooms,
    reportBusy,
    clearBusy,
    refreshRooms: () => selectedBuildingId && fetchRooms(selectedBuildingId),
  };
}
