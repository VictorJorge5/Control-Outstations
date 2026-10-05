import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/primitives';
import { useFcamoList, useTrackingRaw } from '@/lib/queries';
import type { Candidate, StationNote, TrackingSnapshot } from '@/lib/types';
import { buildTrackingData, stageLabel, type Stage } from '@/domain/tracking';

export const STAGE_TONE: Record<Stage, 'brand' | 'warning' | 'info' | 'violet' | 'success'> = {
  none: 'brand', searching: 'warning', selected: 'info', interim: 'violet', covered: 'success',
};

export function StagePill({ stage }: { stage: Stage }) {
  return <Badge tone={STAGE_TONE[stage]} dot data-stage={stage}>{stageLabel(stage)}</Badge>;
}

/** Datos del seguimiento (notas + candidatos + F-CAMO), refrescados cada minuto mientras se mira */
export function useTracking(poll = true) {
  const raw = useTrackingRaw({ poll });
  const fcamo = useFcamoList();
  const data = useMemo(
    () => (raw.data ? buildTrackingData(raw.data.notes, raw.data.candidates, fcamo.data || []) : null),
    [raw.data, fcamo.data],
  );
  return { data, raw, isPending: raw.isPending, error: raw.error };
}

/** Aplica al cache la foto de la estacion que devuelve el Worker tras cada cambio */
export function useApplySnapshot() {
  const qc = useQueryClient();
  return (code: string, snap: TrackingSnapshot) => {
    qc.setQueryData<{ notes: StationNote[]; candidates: Candidate[] }>(['tracking'], old => {
      if (!old) return old;
      let notes = old.notes;
      if (snap.note) notes = [...old.notes.filter(n => n.station_code !== code), snap.note];
      const candidates = snap.candidates ? [...old.candidates.filter(c => c.station_code !== code), ...snap.candidates] : old.candidates;
      return { notes, candidates };
    });
    qc.invalidateQueries({ queryKey: ['notes'] });
    qc.invalidateQueries({ queryKey: ['activity'] });
  };
}

