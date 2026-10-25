import React, { useState, useEffect } from 'react';
import { Building, WrittenTicket } from '../../types/campus';
import { TICKET_CATEGORIES } from '../../config/ticketCategories';
import { useTickets } from '../../hooks/useTickets';
import { SurfaceCard, StatusBadge } from '../ui/Primitives';

interface WrittenTicketModalProps {
  isOpen: boolean;
  buildings: Building[];
  reporterEmail: string;
  initialBuildingId?: string | null;
  initialClassroomId?: string | null;
  onClose: () => void;
}

export const WrittenTicketModal: React.FC<WrittenTicketModalProps> = ({
  isOpen,
  buildings,
  reporterEmail,
  initialBuildingId,
  initialClassroomId,
  onClose,
}) => {
  const [category, setCategory] = useState<string>(TICKET_CATEGORIES[0].id);
  const [buildingId, setBuildingId] = useState<string>(initialBuildingId || '');
  const [classroomId, setClassroomId] = useState<string>(initialClassroomId || '');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdTicket, setCreatedTicket] = useState<WrittenTicket | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    tickets: myTickets,
    refreshTickets,
    submitWrittenTicket,
  } = useTickets(reporterEmail);

  useEffect(() => {
    if (initialBuildingId) setBuildingId(initialBuildingId);
    if (initialClassroomId) setClassroomId(initialClassroomId);
  }, [initialBuildingId, initialClassroomId]);

  useEffect(() => {
    if (!isOpen) return;
    refreshTickets(reporterEmail);
  }, [isOpen, reporterEmail, refreshTickets]);

  if (!isOpen) return null;

  const selectedCategoryCfg =
    TICKET_CATEGORIES.find((c) => c.id === category) || TICKET_CATEGORIES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await submitWrittenTicket({
        reporter_email: reporterEmail,
        building_id: buildingId || null,
        classroom_id: classroomId || null,
        category,
        title,
        description,
      });
      setCreatedTicket(res);
      setTitle('');
      setDescription('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Bildirim gönderilemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <SurfaceCard className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-start justify-between">
          <div>
            <StatusBadge variant="sky">
              Katman 2 • Yerel CPU Türkçe NLP Triyaj & Aciliyet Analizi (Görselsiz/Yazılı)
            </StatusBadge>
            <h2 className="text-base font-extrabold text-white mt-1">
              📝 İdareye Yazılı Arıza / Talep Bildirimi
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setCreatedTicket(null);
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {createdTicket && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 space-y-1.5">
              <div className="font-extrabold text-emerald-300">
                ✅ Yazılı bildiriminiz yerel CPU NLP modeli tarafından &lt;5ms içinde sınıflandırıldı!
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <StatusBadge variant="sky">
                  🏢 Atanan Birim: {createdTicket.ai_department}
                </StatusBadge>
                <StatusBadge
                  variant={
                    createdTicket.ai_urgency_score >= 75
                      ? 'rose'
                      : createdTicket.ai_urgency_score >= 50
                      ? 'amber'
                      : 'emerald'
                  }
                >
                  ⚡ AI Aciliyet Skoru: {createdTicket.ai_urgency_score}/100 ({createdTicket.ai_priority_label.toUpperCase()})
                </StatusBadge>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 font-semibold">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 outline-none"
                >
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">{selectedCategoryCfg.hint}</p>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  İlgili Kampüs Binası (Opsiyonel)
                </label>
                <select
                  value={buildingId}
                  onChange={(e) => setBuildingId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 outline-none"
                >
                  <option value="">— Genel Kampüs Alanı —</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Konu Başlığı
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: BMB-A101 amfi projeksiyon cihazı çalışmıyor / Zemin kat su sızıntısı"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1">
                Detaylı Yazılı Açıklama (Türkçe NLP modeli bu metinden birim ve aciliyet çıkarır)
              </label>
              <textarea
                required
                minLength={5}
                maxLength={1500}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Arızanın veya talebin yerini ve aciliyet durumunu kısaca yazınız..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold transition"
              >
                {isSubmitting ? 'AI Analiz Ediyor...' : '🚀 Yazılı Bildirimi Gönder'}
              </button>
            </div>
          </form>

          {/* Student's Past Tickets */}
          {myTickets.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="font-bold text-slate-300">
                📋 Geçmiş Yazılı Bildirimleriniz ({myTickets.length})
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {myTickets.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-slate-100">{t.title}</div>
                      <div className="text-[11px] text-slate-400">
                        {t.ai_department} • Aciliyet: {t.ai_urgency_score}/100
                        {t.admin_note ? (
                          <span className="text-sky-300 font-semibold">
                            {' '}
                            • İdare Yanıtı: {t.admin_note}
                          </span>
                        ) : (
                          ''
                        )}
                      </div>
                    </div>
                    <StatusBadge
                      variant={
                        t.status === 'resolved'
                          ? 'emerald'
                          : t.status === 'in_progress'
                          ? 'amber'
                          : t.status === 'rejected'
                          ? 'rose'
                          : 'slate'
                      }
                    >
                      {t.status}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SurfaceCard>
    </div>
  );
};
