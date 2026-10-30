import { useState } from 'react';
import { api } from '../../api.ts';
import { Sheet, useToast } from '../../components/ui.tsx';

/** Two steps: find a WLED by address, then name it. */
export function AddDevice({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [host, setHost] = useState('');
  const [found, setFound] = useState<{ name: string; ledCount: number } | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setHost('');
    setFound(null);
    setName('');
  };

  const attempt = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const find = () =>
    attempt(async () => {
      const info = await api.probe(host.trim());
      setFound(info);
      setName(info.name);
    });

  const add = () =>
    attempt(async () => {
      await api.addDevice({ host: host.trim(), name });
      toast(`${name} added`);
      reset();
      onAdded();
    });

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add lights"
    >
      {!found ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            find();
          }}
        >
          <label className="field">
            <span>WLED address</span>
            <input className="input" inputMode="url" autoCapitalize="off" autoCorrect="off" placeholder="192.168.1.50" value={host} onChange={(e) => setHost(e.target.value)} />
          </label>
          <button className="btn btn-primary wide" disabled={!host.trim() || busy}>
            {busy ? 'Looking…' : 'Find lights'}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <p className="found">
            Found <strong>{found.name}</strong> with {found.ledCount} lights.
          </p>
          <label className="field">
            <span>What should we call it?</span>
            <input className="input" placeholder="Roofline" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn btn-primary wide" disabled={busy || !name.trim()}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}
    </Sheet>
  );
}
