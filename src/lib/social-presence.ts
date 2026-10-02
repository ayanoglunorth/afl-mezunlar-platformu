import type { SupabaseClient } from '@supabase/supabase-js';

type PresenceProfile = {
  id: string;
  full_name: string;
};

type PresenceListener = (onlineIds: Set<string>) => void;

const PRESENCE_TOPIC = 'dashboard-social-presence';
const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_TTL_MS = 55_000;

let channel: ReturnType<SupabaseClient['channel']> | null = null;
let activeProfileId: string | null = null;
let heartbeatId: number | null = null;
let visibilityHandler: (() => void) | null = null;
let onlineIds = new Set<string>();
const broadcastHeartbeats = new Map<string, number>();
const listeners = new Set<PresenceListener>();

function emitPresenceState() {
  listeners.forEach((listener) => listener(new Set(onlineIds)));
}

function refreshOnlineIds() {
  const presenceIds = Object.keys(channel?.presenceState() || {});
  const now = Date.now();

  for (const [userId, lastSeenAt] of broadcastHeartbeats) {
    if (now - lastSeenAt > HEARTBEAT_TTL_MS) broadcastHeartbeats.delete(userId);
  }

  onlineIds = new Set([...presenceIds, ...broadcastHeartbeats.keys()]);
  emitPresenceState();
}

export function subscribeSocialPresence(listener: PresenceListener) {
  listeners.add(listener);
  listener(new Set(onlineIds));

  return () => {
    listeners.delete(listener);
  };
}

export function startSocialPresence(supabase: SupabaseClient, profile: PresenceProfile) {
  if (channel && activeProfileId === profile.id) {
    return;
  }

  if (channel) {
    if (heartbeatId) window.clearInterval(heartbeatId);
    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    void channel.untrack();
    void supabase.removeChannel(channel);
    channel = null;
    heartbeatId = null;
    visibilityHandler = null;
    onlineIds = new Set();
    broadcastHeartbeats.clear();
    emitPresenceState();
  }

  activeProfileId = profile.id;
  channel = supabase.channel(PRESENCE_TOPIC, {
    config: { presence: { key: profile.id } },
  });

  const trackPresence = () => {
    const now = new Date().toISOString();
    broadcastHeartbeats.set(profile.id, Date.now());
    void channel?.track({
      user_id: profile.id,
      name: profile.full_name,
      seen_at: now,
    });
    void channel?.send({
      type: 'broadcast',
      event: 'heartbeat',
      payload: { user_id: profile.id, seen_at: now },
    });
    refreshOnlineIds();
  };

  channel
    .on('presence', { event: 'sync' }, () => {
      refreshOnlineIds();
    })
    .on('broadcast', { event: 'heartbeat' }, ({ payload }) => {
      const userId = typeof payload?.user_id === 'string' ? payload.user_id : null;
      if (!userId) return;

      broadcastHeartbeats.set(userId, Date.now());
      refreshOnlineIds();
    })
    .subscribe((status: string) => {
      if (status !== 'SUBSCRIBED') return;

      trackPresence();
      if (heartbeatId) window.clearInterval(heartbeatId);
      heartbeatId = window.setInterval(trackPresence, HEARTBEAT_INTERVAL_MS);
    });

  visibilityHandler = () => {
    if (document.visibilityState === 'visible') trackPresence();
  };
  document.addEventListener('visibilitychange', visibilityHandler);
}
