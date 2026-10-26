import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Sparkles,
  CheckCircle2,
  Building2,
  Send,
  X,
  Clock,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Building, WrittenTicket } from '../../types/campus';
import { TICKET_CATEGORIES } from '../../config/ticketCategories';
import { useTickets } from '../../hooks/useTickets';
import { api } from '../../services/apiClient';
import {
  TactileCard,
  TactileButton,
  TactileIconButton,
  StatusBadge,
} from '../ui/Primitives';

interface WrittenTicketModalProps {
  isOpen: boolean;
  buildings: Building[];
  reporterEmail: string;
  initialBuildingId?: string | null;
  initialClassroomId?: string | null;
  onClose: () => void;
}

interface AIPreviewState {
  ai_department: string;
  ai_urgency_score: number;
  ai_priority_label: string;
  ai_is_spam: boolean;
  confidence: number;
  suggested_category: string;
  user_department: string;
  is_mismatch: boolean;
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

  // Live NLP Preview & Mismatch Confirmation States
  const [aiPreview, setAiPreview] = useState<AIPreviewState | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [showMismatchConfirm, setShowMismatchConfirm] = useState<boolean>(false);
  const analyzeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced live NLP preview as user types title / description or switches category
  useEffect(() => {
    if (!isOpen) return;
    if (analyzeTimerRef.current) {
      clearTimeout(analyzeTimerRef.current);
    }

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();

    if (trimmedTitle.length < 3 && trimmedDesc.length < 4) {
      setAiPreview(null);
      setShowMismatchConfirm(false);
      return;
    }

    analyzeTimerRef.current = setTimeout(async () => {
      try {
        setIsAnalyzing(true);
        const res = await api.analyzeWrittenTicket({
          title: trimmedTitle || 'Genel Bildirim',
          description: trimmedDesc || trimmedTitle,
          category,
        });
        setAiPreview(res);
      } catch {
        // Silently swallow preview errors so UI stays responsive
      } finally {
        setIsAnalyzing(false);
      }
    }, 320);

    return () => {
      if (analyzeTimerRef.current) {
        clearTimeout(analyzeTimerRef.current);
      }
    };
  }, [isOpen, title, description, category]);

  if (!isOpen) return null;

  const selectedCategoryCfg =
    TICKET_CATEGORIES.find((c) => c.id === category) || TICKET_CATEGORIES[0];

  const executeSubmit = async (
    finalCategory: string,
    confirmedDept?: string | null
  ) => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await submitWrittenTicket({
        reporter_email: reporterEmail,
        building_id: buildingId || null,
        classroom_id: classroomId || null,
        category: finalCategory,
        title,
        description,
        confirmed_department: confirmedDept,
      });
      setCreatedTicket(res);
      setTitle('');
      setDescription('');
      setAiPreview(null);
      setShowMismatchConfirm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Bildirim gönderilemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // If AI detected a mismatch with high confidence and user hasn't confirmed yet, prompt user
    if (aiPreview && aiPreview.is_mismatch && !aiPreview.ai_is_spam) {
      setShowMismatchConfirm(true);
      return;
    }

    await executeSubmit(category, null);
  };

  const handleApplyAISuggestion = () => {
    if (aiPreview && aiPreview.suggested_category) {
      setCategory(aiPreview.suggested_category);
      setShowMismatchConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <TactileCard className="w-full max-w-2xl max-h-[90dvh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b-2 border-zinc-950 flex items-start justify-between gap-3">
          <div>
            <StatusBadge
              variant="sky"
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Yerel CPU Türkçe NLP Triyajı & Aciliyet Analizi
            </StatusBadge>
            <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 mt-1">
              İdareye Yazılı Arıza / Talep Bildirimi
            </h2>
          </div>
          <TactileIconButton
            size="sm"
            variant="ghost"
            label="Kapat"
            onClick={() => {
              setCreatedTicket(null);
              onClose();
            }}
          >
            <X className="w-4 h-4" />
          </TactileIconButton>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {createdTicket && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border-2 border-zinc-950 shadow-hard-sm space-y-2">
              <div className="font-black text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Bildiriminiz yerel NLP modeli tarafından &lt;5 ms içinde sınıflandırıldı</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-0.5">
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
                  ⚡ Aciliyet Skoru: {createdTicket.ai_urgency_score}/100 ({createdTicket.ai_priority_label.toUpperCase()})
                </StatusBadge>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/80 border-2 border-rose-900 text-rose-900 dark:text-rose-200 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-black text-zinc-800 dark:text-zinc-200 mb-1">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border-2 border-zinc-950 rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100 font-bold outline-none"
                >
                  {TICKET_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                  {selectedCategoryCfg.hint}
                </p>
              </div>

              <div>
                <label className="block font-black text-zinc-800 dark:text-zinc-200 mb-1">
                  İlgili Kampüs Binası (Opsiyonel)
                </label>
                <select
                  value={buildingId}
                  onChange={(e) => setBuildingId(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border-2 border-zinc-950 rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100 font-bold outline-none"
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
              <label className="block font-black text-zinc-800 dark:text-zinc-200 mb-1">
                Konu Başlığı
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: BMB Amfi 1 projeksiyon cihazı çalışmıyor / Zemin kat su sızıntısı"
                className="w-full bg-zinc-100 dark:bg-zinc-900 border-2 border-zinc-950 rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            <div>
              <label className="block font-black text-zinc-800 dark:text-zinc-200 mb-1">
                Detaylı Açıklama (Türkçe NLP aciliyet ve birim puanlaması yapar)
              </label>
              <textarea
                required
                minLength={5}
                maxLength={1500}
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setShowMismatchConfirm(false);
                }}
                placeholder="Arızanın veya talebin yerini ve aciliyet durumunu kısaca yazınız..."
                className="w-full bg-zinc-100 dark:bg-zinc-900 border-2 border-zinc-950 rounded-xl px-3 py-2 text-zinc-900 dark:text-zinc-100 font-semibold outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            {/* Live AI Analysis & Suggestion Preview */}
            {aiPreview && !createdTicket && (
              <div className="space-y-1.5 pt-0.5">
                {aiPreview.ai_is_spam ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Uygunsuz, spam veya test içerik algılandı. Bildirim düşük öncelikli (Spam) olarak işaretlenecektir.
                    </span>
                  </div>
                ) : aiPreview.is_mismatch ? (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-500 text-amber-900 dark:text-amber-200 text-xs space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-black text-amber-800 dark:text-amber-300">
                        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Yapay Zekâ Birim Önerisi: {aiPreview.ai_department}</span>
                      </div>
                      <StatusBadge
                        variant={
                          aiPreview.ai_urgency_score >= 75
                            ? 'rose'
                            : aiPreview.ai_urgency_score >= 50
                            ? 'amber'
                            : 'emerald'
                        }
                      >
                        ⚡ {aiPreview.ai_urgency_score}/100 ({aiPreview.ai_priority_label.toUpperCase()})
                      </StatusBadge>
                    </div>
                    <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                      Siz <strong>"{selectedCategoryCfg.label}"</strong> seçtiniz, fakat girdiğiniz arıza metni{' '}
                      <strong>"{aiPreview.ai_department}"</strong> ile ilgili görünüyor.
                    </p>
                    <button
                      type="button"
                      onClick={handleApplyAISuggestion}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-xs transition-colors shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Kategoriyi "{aiPreview.ai_department}" Yap</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-medium px-1">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Metin seçtiğiniz birim ({selectedCategoryCfg.defaultDepartment}) ile uyumlu.
                    </span>
                    <span className="font-bold">
                      Aciliyet: {aiPreview.ai_urgency_score}/100 ({aiPreview.ai_priority_label.toUpperCase()})
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Mismatch Confirmation Box Before Submission */}
            {showMismatchConfirm && aiPreview && (
              <div className="p-3.5 rounded-xl bg-amber-100/95 dark:bg-amber-950/95 border-2 border-zinc-950 shadow-hard space-y-2.5 animate-in fade-in">
                <div className="flex items-center gap-2 font-black text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Yapay Zekâ Birim Yönlendirmesini Onaylıyor musunuz?</span>
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed">
                  Siz <span className="font-bold underline">{selectedCategoryCfg.defaultDepartment}</span> birimini seçtiniz.
                  Fakat arıza metnine göre sistem, talebin en hızlı çözülebilmesi için{' '}
                  <span className="font-bold text-amber-800 dark:text-amber-300 underline">
                    {aiPreview.ai_department}
                  </span>{' '}
                  birimine iletilmesini öneriyor.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <TactileButton
                    type="button"
                    variant="accent"
                    size="sm"
                    loading={isSubmitting}
                    onClick={() => executeSubmit(aiPreview.suggested_category, aiPreview.ai_department)}
                    icon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Öneriyi Onayla ({aiPreview.ai_department})
                  </TactileButton>
                  <TactileButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={isSubmitting}
                    onClick={() => executeSubmit(category, selectedCategoryCfg.defaultDepartment)}
                  >
                    Kendi Seçimimle Gönder
                  </TactileButton>
                  <button
                    type="button"
                    onClick={() => setShowMismatchConfirm(false)}
                    className="text-[11px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline ml-auto"
                  >
                    Düzenlemeye Geri Dön
                  </button>
                </div>
              </div>
            )}

            {!showMismatchConfirm && (
              <div className="flex justify-end gap-2 pt-1">
                <TactileButton
                  type="submit"
                  variant="accent"
                  loading={isSubmitting}
                  icon={<Send className="w-4 h-4" />}
                >
                  Yazılı Bildirimi Gönder
                </TactileButton>
              </div>
            )}
          </form>

          {/* Student's Past Tickets */}
          {myTickets.length > 0 && (
            <div className="pt-3 border-t-2 border-zinc-950 space-y-2">
              <div className="font-black text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-zinc-500" />
                <span>Geçmiş Yazılı Bildirimleriniz ({myTickets.length})</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {myTickets.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-950 shadow-hard-sm flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-black text-zinc-900 dark:text-zinc-100">
                        {t.title}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {t.ai_department} • Aciliyet: {t.ai_urgency_score}/100
                        {t.admin_note ? (
                          <span className="text-sky-600 dark:text-sky-300 font-bold">
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
      </TactileCard>
    </div>
  );
};
