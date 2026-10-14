import { useState, type ReactNode } from "react";
import type { FileInput, ItemInput, MissionInput } from "../lib/api";
import {
  CLASSIFICATION_LABEL,
  FILE_STATUS_LABEL,
  MISSION_KIND_LABEL,
  MISSION_STATUS_LABEL,
  type FileClassification,
  type FileStatus,
  type GameFile,
  type Item,
  type Mission,
  type MissionKind,
  type MissionStatus,
  type PlayerSummary,
} from "../lib/types";

// ---------------------------------------------------------------- piezas comunes

export type Tone = "green" | "red" | "cyan" | "amber" | "dim";

// Clases completas: Tailwind solo genera las que encuentra escritas tal cual
const CHIP_ACTIVE: Record<Tone, string> = {
  green: "border-term-green bg-term-green/15 text-term-green",
  red: "border-term-red bg-term-red/15 text-term-red",
  cyan: "border-term-cyan bg-term-cyan/15 text-term-cyan",
  amber: "border-term-amber bg-term-amber/15 text-term-amber",
  dim: "border-term-dim bg-term-dim/15 text-term-dim",
};

const BADGE: Record<Tone, string> = {
  green: "border-term-green/60 text-term-green",
  red: "border-term-red/60 text-term-red",
  cyan: "border-term-cyan/60 text-term-cyan",
  amber: "border-term-amber/60 text-term-amber",
  dim: "border-term-faint text-term-dim",
};

export function Chip({
  active,
  onClick,
  children,
  tone = "green",
  small = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: Tone;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${small ? "min-h-[36px] px-2.5 text-[10px]" : "min-h-[40px] px-3 text-[11px]"} shrink-0 rounded border tracking-widest ${
        active ? CHIP_ACTIVE[tone] : "border-term-line text-term-dim"
      }`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "dim" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`rounded border px-1.5 py-0.5 text-[9px] tracking-widest ${BADGE[tone]}`}>{children}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] tracking-widest text-term-dim">{label}</div>
      {children}
    </div>
  );
}

const INPUT = "w-full rounded border border-term-line bg-term-bg px-3 py-2 text-term-green placeholder:text-term-faint";

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded border border-dashed border-term-line px-3 py-4 text-center text-[11px] tracking-widest text-term-faint">{children}</div>;
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[44px] w-full rounded border border-dashed border-term-dim text-[11px] tracking-widest text-term-dim active:bg-term-green/10"
    >
      {children}
    </button>
  );
}

function FormButtons({ onSave, onCancel, busy, disabled }: { onSave: () => void; onCancel: () => void; busy: boolean; disabled: boolean }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={busy || disabled}
        className="min-h-[44px] flex-1 rounded border border-term-green bg-term-green/10 text-[11px] tracking-widest disabled:opacity-40"
      >
        {busy ? "GUARDANDO…" : "GUARDAR"}
      </button>
      <button type="button" onClick={onCancel} className="min-h-[44px] rounded border border-term-line px-4 text-[11px] tracking-widest text-term-dim">
        CANCELAR
      </button>
    </div>
  );
}

function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm(`¿Eliminar "${label}"?`)) onClick();
      }}
      aria-label={`Eliminar ${label}`}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-term-line text-term-dim active:text-term-red"
    >
      ✕
    </button>
  );
}

// ---------------------------------------------------------------- misiones

const MISSION_STATUSES: MissionStatus[] = ["HIDDEN", "ACTIVE", "DONE", "FAILED"];
const MISSION_TONE: Record<MissionStatus, Tone> = { HIDDEN: "amber", ACTIVE: "green", DONE: "cyan", FAILED: "red" };

export function MissionManager({
  missions,
  scopePlayerId,
  onCreate,
  onUpdate,
  onDelete,
}: {
  missions: Mission[];
  scopePlayerId: string | null;
  onCreate: (input: MissionInput) => Promise<void>;
  onUpdate: (id: number, patch: { status?: MissionStatus; title?: string; description?: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const list = missions.filter((m) => m.playerId === scopePlayerId);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    kind: (scopePlayerId ? "OFFICIAL" : "SHARED") as MissionKind,
    status: "ACTIVE" as MissionStatus,
  });

  const save = async () => {
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      await onCreate({
        playerId: scopePlayerId,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        kind: draft.kind,
        status: draft.status,
      });
      setDraft((d) => ({ ...d, title: "", description: "" }));
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {list.length === 0 && <Empty>SIN MISIONES</Empty>}
      {list.map((m) => (
        <article key={m.id} className={`rounded border bg-term-panel p-3 ${m.status === "HIDDEN" ? "border-term-faint opacity-75" : "border-term-line"}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-bold leading-snug">{m.title}</div>
              <div className="mt-1 flex gap-1.5">
                <Badge tone={m.kind === "SECRET" ? "amber" : "dim"}>{MISSION_KIND_LABEL[m.kind]}</Badge>
                {m.code && <Badge>{m.code}</Badge>}
              </div>
            </div>
            <DeleteButton label={m.title} onClick={() => void onDelete(m.id)} />
          </div>
          {m.description && <p className="mt-2 text-xs leading-snug text-term-dim">{m.description}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MISSION_STATUSES.map((s) => (
              <Chip key={s} small active={m.status === s} tone={MISSION_TONE[s]} onClick={() => void onUpdate(m.id, { status: s })}>
                {MISSION_STATUS_LABEL[s]}
              </Chip>
            ))}
          </div>
        </article>
      ))}

      {showForm ? (
        <div className="space-y-3 rounded border border-term-green/40 bg-term-panel p-3">
          <Field label="TÍTULO">
            <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} maxLength={120} className={INPUT} />
          </Field>
          <Field label="DESCRIPCIÓN">
            <textarea rows={3} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} maxLength={2000} className={INPUT} />
          </Field>
          {scopePlayerId && (
            <Field label="TIPO">
              <div className="flex gap-2">
                {(["OFFICIAL", "SECRET"] as MissionKind[]).map((k) => (
                  <Chip key={k} small active={draft.kind === k} tone={k === "SECRET" ? "amber" : "green"} onClick={() => setDraft((d) => ({ ...d, kind: k }))}>
                    {MISSION_KIND_LABEL[k]}
                  </Chip>
                ))}
              </div>
            </Field>
          )}
          <Field label="ESTADO INICIAL">
            <div className="flex gap-2">
              {(["ACTIVE", "HIDDEN"] as MissionStatus[]).map((s) => (
                <Chip key={s} small active={draft.status === s} tone={MISSION_TONE[s]} onClick={() => setDraft((d) => ({ ...d, status: s }))}>
                  {MISSION_STATUS_LABEL[s]}
                </Chip>
              ))}
            </div>
          </Field>
          <FormButtons onSave={() => void save()} onCancel={() => setShowForm(false)} busy={busy} disabled={!draft.title.trim()} />
        </div>
      ) : (
        <AddButton onClick={() => setShowForm(true)}>+ NUEVA MISIÓN</AddButton>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- inventario

export function ItemManager({
  items,
  playerId,
  players,
  onCreate,
  onUpdate,
  onDelete,
}: {
  items: Item[];
  playerId: string;
  players: PlayerSummary[];
  onCreate: (input: ItemInput) => Promise<void>;
  onUpdate: (id: number, patch: { quantity?: number; usable?: boolean; consumable?: boolean; playerId?: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const list = items.filter((i) => i.playerId === playerId);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "", quantity: 1, usable: true, consumable: false });

  const save = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      await onCreate({ playerId, name: draft.name.trim(), description: draft.description.trim() || null, quantity: draft.quantity, usable: draft.usable, consumable: draft.consumable });
      setDraft({ name: "", description: "", quantity: 1, usable: true, consumable: false });
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {list.length === 0 && <Empty>INVENTARIO VACÍO</Empty>}
      {list.map((i) => (
        <article key={i.id} className="rounded border border-term-line bg-term-panel p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-bold leading-snug">{i.name}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {i.usable ? <Badge tone="green">USABLE</Badge> : <Badge>NO USABLE</Badge>}
                {i.consumable && <Badge tone="amber">CONSUMIBLE</Badge>}
              </div>
            </div>
            <DeleteButton label={i.name} onClick={() => void onDelete(i.id)} />
          </div>
          {i.description && <p className="mt-2 text-xs leading-snug text-term-dim">{i.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => void onUpdate(i.id, { quantity: Math.max(0, i.quantity - 1) })} className="h-9 w-9 rounded border border-term-line text-lg">
                −
              </button>
              <span className="w-8 text-center text-sm font-bold">{i.quantity}</span>
              <button type="button" onClick={() => void onUpdate(i.id, { quantity: i.quantity + 1 })} className="h-9 w-9 rounded border border-term-line text-lg">
                +
              </button>
            </div>
            <label className="ml-auto flex items-center gap-1 text-[10px] tracking-widest text-term-dim">
              DAR A
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) void onUpdate(i.id, { playerId: e.target.value });
                }}
                className="h-9 rounded border border-term-line bg-term-bg px-1 text-[12px] text-term-green"
              >
                <option value="">…</option>
                {players
                  .filter((p) => p.id !== playerId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </article>
      ))}

      {showForm ? (
        <div className="space-y-3 rounded border border-term-green/40 bg-term-panel p-3">
          <Field label="OBJETO">
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} maxLength={80} className={INPUT} />
          </Field>
          <Field label="DESCRIPCIÓN">
            <textarea rows={2} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} maxLength={500} className={INPUT} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Field label="CANTIDAD">
              <input type="number" min={0} max={999} value={draft.quantity} onChange={(e) => setDraft((d) => ({ ...d, quantity: Number(e.target.value) || 0 }))} className={`${INPUT} w-24`} />
            </Field>
            <div className="mt-5 flex gap-2">
              <Chip small active={draft.usable} onClick={() => setDraft((d) => ({ ...d, usable: !d.usable }))}>
                USABLE
              </Chip>
              <Chip small tone="amber" active={draft.consumable} onClick={() => setDraft((d) => ({ ...d, consumable: !d.consumable }))}>
                CONSUMIBLE
              </Chip>
            </div>
          </div>
          <FormButtons onSave={() => void save()} onCancel={() => setShowForm(false)} busy={busy} disabled={!draft.name.trim()} />
        </div>
      ) : (
        <AddButton onClick={() => setShowForm(true)}>+ DAR OBJETO</AddButton>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- archivos

const FILE_STATUSES: FileStatus[] = ["HIDDEN", "UNLOCKED", "CORRUPTED"];
const FILE_TONE: Record<FileStatus, Tone> = { HIDDEN: "amber", UNLOCKED: "green", CORRUPTED: "red" };
const CLASSIFICATIONS: FileClassification[] = ["PUBLIC", "RESTRICTED", "CLASSIFIED"];
const CLASS_TONE: Record<FileClassification, Tone> = { PUBLIC: "dim", RESTRICTED: "amber", CLASSIFIED: "red" };

export function FileManager({
  files,
  scopePlayerId,
  onCreate,
  onUpdate,
  onDelete,
}: {
  files: GameFile[];
  scopePlayerId: string | null;
  onCreate: (input: FileInput) => Promise<void>;
  onUpdate: (id: number, patch: { status?: FileStatus; body?: string; title?: string; classification?: FileClassification }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const list = files.filter((f) => f.playerId === scopePlayerId);
  const [open, setOpen] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "", classification: "RESTRICTED" as FileClassification, status: "HIDDEN" as FileStatus });

  const save = async () => {
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      await onCreate({ playerId: scopePlayerId, title: draft.title.trim(), body: draft.body, classification: draft.classification, status: draft.status });
      setDraft({ title: "", body: "", classification: "RESTRICTED", status: "HIDDEN" });
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {list.length === 0 && <Empty>SIN ARCHIVOS</Empty>}
      {list.map((f) => (
        <article key={f.id} className={`rounded border bg-term-panel p-3 ${f.status === "HIDDEN" ? "border-term-faint opacity-75" : "border-term-line"}`}>
          <div className="flex items-start justify-between gap-2">
            <button type="button" onClick={() => setOpen(open === f.id ? null : f.id)} className="min-w-0 flex-1 text-left">
              <div className="text-sm font-bold leading-snug">{f.title}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge tone={CLASS_TONE[f.classification]}>{CLASSIFICATION_LABEL[f.classification]}</Badge>
                {f.code && <Badge>{f.code}</Badge>}
                <Badge>{open === f.id ? "OCULTAR TEXTO" : "VER TEXTO"}</Badge>
              </div>
            </button>
            <DeleteButton label={f.title} onClick={() => void onDelete(f.id)} />
          </div>
          {open === f.id && (
            <div className="mt-2">
              {editing?.id === f.id ? (
                <div className="space-y-2">
                  <textarea rows={10} value={editing.body} onChange={(e) => setEditing({ id: f.id, body: e.target.value })} maxLength={8000} className={`${INPUT} text-xs`} />
                  <FormButtons
                    onSave={() => {
                      void onUpdate(f.id, { body: editing.body }).then(() => setEditing(null));
                    }}
                    onCancel={() => setEditing(null)}
                    busy={false}
                    disabled={false}
                  />
                </div>
              ) : (
                <>
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded border border-term-line/60 bg-term-bg p-2 font-mono text-[11px] leading-snug text-term-green/90">
                    {f.body ?? ""}
                  </pre>
                  <button type="button" onClick={() => setEditing({ id: f.id, body: f.body ?? "" })} className="mt-1 min-h-[36px] text-[10px] tracking-widest text-term-dim underline">
                    EDITAR TEXTO
                  </button>
                </>
              )}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FILE_STATUSES.map((s) => (
              <Chip key={s} small active={f.status === s} tone={FILE_TONE[s]} onClick={() => void onUpdate(f.id, { status: s })}>
                {FILE_STATUS_LABEL[s]}
              </Chip>
            ))}
          </div>
        </article>
      ))}

      {showForm ? (
        <div className="space-y-3 rounded border border-term-green/40 bg-term-panel p-3">
          <Field label="TÍTULO">
            <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} maxLength={120} className={INPUT} />
          </Field>
          <Field label="CLASIFICACIÓN">
            <div className="flex flex-wrap gap-2">
              {CLASSIFICATIONS.map((c) => (
                <Chip key={c} small active={draft.classification === c} tone={CLASS_TONE[c]} onClick={() => setDraft((d) => ({ ...d, classification: c }))}>
                  {CLASSIFICATION_LABEL[c]}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="ESTADO INICIAL">
            <div className="flex flex-wrap gap-2">
              {FILE_STATUSES.map((s) => (
                <Chip key={s} small active={draft.status === s} tone={FILE_TONE[s]} onClick={() => setDraft((d) => ({ ...d, status: s }))}>
                  {FILE_STATUS_LABEL[s]}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="TEXTO">
            <textarea rows={6} value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} maxLength={8000} className={`${INPUT} text-xs`} />
          </Field>
          <FormButtons onSave={() => void save()} onCancel={() => setShowForm(false)} busy={busy} disabled={!draft.title.trim()} />
        </div>
      ) : (
        <AddButton onClick={() => setShowForm(true)}>+ NUEVO ARCHIVO</AddButton>
      )}
    </div>
  );
}
