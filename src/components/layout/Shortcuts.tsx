import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { usePermissions } from '@/lib/session';
import { Modal } from '@/components/ui/overlay';
import { Kbd } from '@/components/ui/primitives';

const GO: { key: string; to: string; label: string; admin?: boolean }[] = [
  { key: 'i', to: '/', label: 'Inicio' },
  { key: 'm', to: '/mapa', label: 'Mapa de la red' },
  { key: 's', to: '/seguimiento', label: 'Sin proveedor' },
  { key: 'f', to: '/fcamo', label: 'F-CAMO' },
  { key: 'p', to: '/pernoctas', label: 'Pernoctas' },
  { key: 'a', to: '/actividad', label: 'Actividad' },
  { key: 'u', to: '/usuarios', label: 'Usuarios', admin: true },
];

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

/** Atajos de teclado: "/" busca, "G" + letra navega, "?" muestra la ayuda */
export function Shortcuts({ onSearch }: { onSearch: () => void }) {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const [help, setHelp] = useState(false);
  const pendingG = useRef(0);
  const items = GO.filter(g => !g.admin || isAdmin);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return; // con una ventana abierta, las teclas son suyas
      const k = e.key.toLowerCase();
      if (pendingG.current && Date.now() - pendingG.current < 1200) {
        pendingG.current = 0;
        const g = items.find(x => x.key === k);
        if (g) { e.preventDefault(); navigate(g.to); }
        return;
      }
      if (k === 'g') { pendingG.current = Date.now(); return; }
      if (e.key === '/') { e.preventDefault(); onSearch(); return; }
      if (e.key === '?') { e.preventDefault(); setHelp(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, navigate, onSearch]);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <Modal open={help} onOpenChange={setHelp} title="Atajos de teclado" description="Para moverte por la aplicación sin ratón." size="sm">
      <div className="space-y-5" data-testid="shortcuts-help">
        <Group title="General">
          <Row label="Buscar estación, proveedor o pantalla"><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>K</Kbd><span className="px-1 text-ink-400">o</span><Kbd>/</Kbd></Row>
          <Row label="Mostrar esta ayuda"><Kbd>?</Kbd></Row>
          <Row label="Cerrar ficha o ventana"><Kbd>Esc</Kbd></Row>
        </Group>
        <Group title="Ir a">
          {items.map(g => <Row key={g.key} label={g.label}><Kbd>G</Kbd><span className="px-0.5 text-ink-400">luego</span><Kbd>{g.key.toUpperCase()}</Kbd></Row>)}
        </Group>
      </div>
    </Modal>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{title}</div>
      <div className="divide-y divide-ink-100">{children}</div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 py-2 text-[13.5px] text-ink-700">{label}<span className="flex shrink-0 items-center gap-1 text-xs">{children}</span></div>;
}
