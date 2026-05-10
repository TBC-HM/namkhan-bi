// Usage example — not imported by the app bundle, for reference only.
import React from 'react';
import { AlertStatusButton } from './AlertStatusButton';

export function ExampleUsage() {
  return (
    <AlertStatusButton
      taskId="some-task-uuid"
      initialStatus="pending"
      onStatusChange={(s) => console.log('new status:', s)}
    />
  );
}
