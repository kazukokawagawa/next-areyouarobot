
// Cloudflare KV + In-Memory Fallback Storage
// Automatically switches to KV in production (if configured) and Memory in local development.

export interface TicketData {
  ticket: string;
  group_id: string;
  user_id: string;
  created_at: number;
  verified: boolean;
  code?: string;
}

// --- Memory Store (Fallback) ---
// Global variable to persist across hot reloads in development
const globalForStore = global as unknown as { ticketStore: Map<string, TicketData> };
const memoryStore = globalForStore.ticketStore || new Map<string, TicketData>();
if (process.env.NODE_ENV !== "production") globalForStore.ticketStore = memoryStore;

// --- KV Accessor ---
function getKV(): KVNamespace | null {
  // In Next.js Edge Runtime on Cloudflare Pages, bindings are available on process.env
  // Cast to unknown first to avoid type conflicts if types aren't loaded perfectly
  const kv = process.env.VERIFY_KV as unknown as KVNamespace;
  // Simple check to see if it looks like a KV Namespace
  if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
    return kv;
  }
  return null;
}

// --- Storage Methods ---

export async function saveTicket(data: TicketData): Promise<void> {
  const kv = getKV();
  if (kv) {
    // KV: 5 minutes expiration (300s)
    await kv.put(data.ticket, JSON.stringify(data), { expirationTtl: 300 });
  } else {
    // Memory
    memoryStore.set(data.ticket, data);
  }
}

export async function getTicket(ticket: string): Promise<TicketData | null> {
  const kv = getKV();
  if (kv) {
    const data = await kv.get(ticket);
    return data ? JSON.parse(data) : null;
  } else {
    return memoryStore.get(ticket) || null;
  }
}

export async function updateTicket(ticket: string, data: TicketData): Promise<void> {
  const kv = getKV();
  if (kv) {
    await kv.put(ticket, JSON.stringify(data), { expirationTtl: 300 });

    // Secondary Index for "Check" optimization
    if (data.verified && data.code && data.group_id) {
        const indexKey = `code:${data.group_id}:${data.code}`;
        await kv.put(indexKey, ticket, { expirationTtl: 300 });
    }
  } else {
    memoryStore.set(ticket, data);
  }
}

export async function deleteTicket(ticket: string): Promise<void> {
  const kv = getKV();
  if (kv) {
    await kv.delete(ticket);
  } else {
    memoryStore.delete(ticket);
  }
}

export async function findVerifiedTicket(group_id: string, code: string): Promise<TicketData | null> {
  const kv = getKV();
  if (kv) {
    // KV: Use secondary index
    const indexKey = `code:${group_id}:${code}`;
    const ticketId = await kv.get(indexKey);
    
    if (!ticketId) return null;

    const dataStr = await kv.get(ticketId);
    if (!dataStr) return null;

    const data = JSON.parse(dataStr) as TicketData;
    
    // Verify consistency
    if (data.verified && String(data.code) === String(code)) {
        // Clean up index to prevent reuse (optional, but good practice)
        await kv.delete(indexKey);
        return data;
    }
    return null;
  } else {
    // Memory: Linear search
    for (const value of memoryStore.values()) {
      if (
          value.group_id === String(group_id) && 
          value.code === String(code) && 
          value.verified
      ) {
        return value;
      }
    }
    return null;
  }
}

// Helper to clean expired tickets (only needed for memory implementation)
export function cleanExpiredTickets(maxAgeSeconds = 300) {
  const kv = getKV();
  if (!kv) {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
      if (now - value.created_at > maxAgeSeconds * 1000) {
        memoryStore.delete(key);
      }
    }
  }
  // KV handles expiration automatically
}
