import React, { useEffect, useState } from 'react';

import Button from '../../../shared/ui/Button';
import Input from '../../../shared/ui/Input';
import { POOL_NAME_MAX_LENGTH } from '../api/poolFirestore';

export default function EditPoolNameForm({
  initialName,
  busy,
  errorMessage,
  onSave,
  onCancel,
}) {
  const [value, setValue] = useState(initialName);

  useEffect(() => {
    setValue(initialName);
  }, [initialName]);

  return (
    <div className="space-y-3 rounded-xl border border-border-subtle/50 bg-surface-inset/72 p-4 shadow-inset-glass">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-widest text-content-secondary">
          Pool name
        </span>
        <Input
          className="mt-1.5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={POOL_NAME_MAX_LENGTH}
          disabled={busy}
          autoFocus
        />
      </label>
      {errorMessage ? (
        <p className="text-sm font-bold text-red-400">{errorMessage}</p>
      ) : null}
      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => onSave(value)}
          disabled={busy}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
