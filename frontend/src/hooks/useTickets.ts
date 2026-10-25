import { useState, useCallback, useEffect } from 'react';
import { WrittenTicket } from '../types/campus';
import { api } from '../services/apiClient';

export function useTickets(reporterEmail?: string, autoFetch: boolean = false) {
  const [tickets, setTickets] = useState<WrittenTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState<boolean>(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  const refreshTickets = useCallback(
    async (emailOverride?: string) => {
      setIsLoadingTickets(true);
      setTicketError(null);
      try {
        const list = await api.listWrittenTickets(
          emailOverride !== undefined ? emailOverride : reporterEmail
        );
        setTickets(list);
        return list;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Bildirimler yüklenemedi';
        setTicketError(msg);
        return [];
      } finally {
        setIsLoadingTickets(false);
      }
    },
    [reporterEmail]
  );

  useEffect(() => {
    if (autoFetch) {
      refreshTickets();
    }
  }, [autoFetch, refreshTickets]);

  const submitWrittenTicket = useCallback(
    async (payload: {
      reporter_email: string;
      building_id?: string | null;
      classroom_id?: string | null;
      category: string;
      title: string;
      description: string;
      lat?: number | null;
      lon?: number | null;
    }): Promise<WrittenTicket> => {
      setTicketError(null);
      const created = await api.createWrittenTicket(payload);
      await refreshTickets(payload.reporter_email);
      return created;
    },
    [refreshTickets]
  );

  const updateTicketStatus = useCallback(
    async (
      ticketId: number,
      status: 'pending' | 'in_progress' | 'resolved' | 'rejected',
      adminNote?: string
    ): Promise<WrittenTicket> => {
      const updated = await api.updateWrittenTicketStatus(ticketId, status, adminNote);
      await refreshTickets();
      return updated;
    },
    [refreshTickets]
  );

  return {
    tickets,
    isLoadingTickets,
    ticketError,
    refreshTickets,
    submitWrittenTicket,
    updateTicketStatus,
  };
}
