// Live emits Responses snapshots with empty output arrays. Collect finished
// function items per response, then send every result before response.create.
export function createToolBridge({ send, execute, onBusy = () => {}, onError = () => {}, blocked = () => false }) {
  const current = new Map();
  const responses = new Map();
  const handledCalls = new Map();
  let stopped = false;
  async function receive(envelope) {
    if (stopped || envelope.type !== 'response.event') return;
    const event = envelope.event;
    const delegationId = envelope.delegation_id;
    if (event?.type === 'response.created') {
      const id = event.response.id;
      current.set(delegationId, id);
      responses.set(id, { calls: [], completed: false });
      onBusy(true);
    }
    const responseId = event?.response?.id || current.get(delegationId);
    const state = responses.get(responseId);
    if (!state) return;
    if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') {
      const call = event.item;
      if (!state.calls.some(c => c.call_id === call.call_id)) state.calls.push(call);
    }
    if (['response.failed', 'response.incomplete'].includes(event.type)) {
      state.completed = true;
      onBusy(false);
      if(!blocked()) onError('That request didn’t finish. Please ask me again.');
      responses.delete(responseId);
      current.delete(delegationId);
      return;
    }
    if (event.type !== 'response.completed' || state.completed) return;
    state.completed = true;
    try {
      for (const call of state.calls) {
        if (stopped) return;
        let result = handledCalls.get(call.call_id);
        if (!result) {
          try { result = blocked() ? {ok:false,error:'Temporarily unavailable; no action was taken. Ask again after the wait.'} : await execute(call.name, JSON.parse(call.arguments), call.call_id); }
          catch { result = { ok: false, error: 'The action could not be completed.' }; }
          handledCalls.set(call.call_id, result);
        }
        if (!stopped) send({ type: 'response.item.create', event_id: `result_${crypto.randomUUID()}`, item: { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) } });
      }
      if (state.calls.length && !stopped && !blocked()) send({ type: 'response.create', event_id: `continue_${crypto.randomUUID()}` });
      else onBusy(false);
    } catch { onBusy(false); onError('The voice connection interrupted an action. Check recent notes before retrying.'); }
    finally { responses.delete(responseId); if(current.get(delegationId)===responseId)current.delete(delegationId); }
  }
  return { receive, stop() { stopped = true; responses.clear(); current.clear(); handledCalls.clear(); } };
}
