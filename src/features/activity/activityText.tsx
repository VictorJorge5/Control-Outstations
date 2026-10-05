import type { ReactNode } from 'react';
import type { ActivityEntry, AuditEntry } from '@/lib/types';
import { candLabel, normStage, stageLabel } from '@/domain/tracking';

const B = ({ children }: { children: ReactNode }) => <b className="font-semibold text-ink-900">{children}</b>;
const cut = (t: string, n: number) => (t.length > n ? t.slice(0, n) + '…' : t);
const splitLast = (v: string) => { const k = v.lastIndexOf('|'); return k < 0 ? [v, ''] : [v.slice(0, k), v.slice(k + 1)]; };

/** Frase de un cambio de notas / seguimiento / F-CAMO, para el historial */
export function ActivityText({ entry }: { entry: ActivityEntry }) {
  const who = <B>{entry.changed_by}</B>;
  const st = <B>{entry.station_code}</B>;
  if (entry.type === 'note') {
    const val = String(entry.value || '');
    switch (entry.action) {
      case 'covered': return <>{who} marcó {st} como {val === 'true' ? 'cubierta' : 'pendiente'}</>;
      case 'stage': return <>{who} cambió la situación de {st} a <B>{stageLabel(normStage(val))}</B></>;
      case 'log': return <>{who} añadió a la bitácora de {st}: «{cut(val, 90)}»</>;
      case 'cand_add': return <>{who} añadió a <B>{val}</B> como proveedor candidato en {st}</>;
      case 'cand_status': { const [n, s] = splitLast(val); return <>{who} movió a <B>{n}</B> a «{candLabel(s)}» en {st}</>; }
      case 'cand_edit': return <>{who} editó los datos de <B>{val}</B> en {st}</>;
      case 'cand_remove': return <>{who} quitó a <B>{val}</B> de la lista de {st}</>;
      case 'next_action': return <>{who} actualizó la próxima acción de {st}</>;
      case 'candidate_provider': return val
        ? <>{who} propuso como candidato a <B>{val}</B> en {st}</>
        : <>{who} quitó el proveedor candidato de {st}</>;
      default: return <>{who} escribió una nota en {st}: «{cut(val, 90)}»</>;
    }
  }
  const labels: Record<string, string> = {
    created: 'abrió un F-CAMO-IBE-14 para', completed: 'completó el checklist de', reopened: 'reabrió el checklist de',
    deleted: 'eliminó el F-CAMO-IBE-14 de', restored: 'restauró el F-CAMO-IBE-14 de',
  };
  return <>{who} {labels[entry.action] || entry.action} {st}</>;
}

export const ROLE_LABELS: Record<string, string> = { admin: 'Administrador', user: 'Usuario', viewer: 'Consulta' };
const roleName = (r: string) => ROLE_LABELS[r] || 'Usuario';

/** Frase de un cambio en la gestion de usuarios */
export function AuditText({ entry }: { entry: AuditEntry }) {
  const who = entry.changed_by === 'sistema' ? <>El sistema</> : <B>{entry.changed_by}</B>;
  const t = <B>{entry.target_email}</B>;
  const d = entry.detail;
  let text: ReactNode;
  switch (entry.action) {
    case 'created': text = <>dio de alta a {t}{ROLE_LABELS[d] ? <> con el rol <B>{ROLE_LABELS[d]}</B></> : null}</>; break;
    case 'role_changed': { const [from, to] = String(d || '').split('>'); text = <>cambió el rol de {t}{ROLE_LABELS[from] ? ` de ${ROLE_LABELS[from]}` : ''} a <B>{roleName(to)}</B></>; break; }
    case 'made_admin': text = <>dio permisos de administrador a {t}</>; break;
    case 'removed_admin': text = <>quitó los permisos de administrador a {t}</>; break;
    case 'badge_on': text = <>activó el aviso de datos a {t}</>; break;
    case 'badge_off': text = <>desactivó el aviso de datos a {t}</>; break;
    case 'password_reset_by_admin': text = <>reseteó la contraseña de {t}</>; break;
    case 'deleted': text = <>eliminó la cuenta de {t}</>; break;
    case 'password_changed': text = <>cambió su contraseña{d === 'tras contraseña temporal' ? ' (tras la temporal)' : ''}</>; break;
    case 'login_locked': text = <>bloqueó el acceso de {t} 15 min por demasiados intentos fallidos</>; break;
    default: text = <>{entry.action} · {t}</>;
  }
  return <>{who} {text}</>;
}
