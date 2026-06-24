export function enqueueOutboxMutation(opts?: {
  businessId?: string | null;
  mutationType?: string;
  payload?: Record<string, any>;
  mutationId?: string;
  baseVersions?: any;
}): Promise<any>;

declare const _default: {
  enqueueOutboxMutation: typeof enqueueOutboxMutation;
};
export default _default;
