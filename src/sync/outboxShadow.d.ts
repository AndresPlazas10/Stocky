export function enqueueOutboxMutation(opts?: {
  businessId?: string | null;
  mutationType?: string;
  payload?: Record<string, unknown>;
  mutationId?: string;
  baseVersions?: Record<string, number>;
}): Promise<{ ok: boolean }>;

declare const _default: {
  enqueueOutboxMutation: typeof enqueueOutboxMutation;
};
export default _default;
