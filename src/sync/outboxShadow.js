// Rollback online-only: las mutaciones shadow/outbox quedan deshabilitadas.

export async function enqueueOutboxMutation() {
  return null;
}

export default {
  enqueueOutboxMutation
};
