
// Simple in-memory storage for demonstration purposes
// In a real production environment, use a database like Redis, PostgreSQL, etc.

export interface TicketData {
  ticket: string;
  group_id: string;
  user_id: string;
  created_at: number;
  verified: boolean;
  code?: string;
}

// Global variable to persist across hot reloads in development (to some extent)
const globalForStore = global as unknown as { ticketStore: Map<string, TicketData> };

export const ticketStore = globalForStore.ticketStore || new Map<string, TicketData>();

if (process.env.NODE_ENV !== "production") globalForStore.ticketStore = ticketStore;

// Helper to clean expired tickets (optional, can be called periodically)
export function cleanExpiredTickets(maxAgeSeconds = 300) {
  const now = Date.now();
  for (const [key, value] of ticketStore.entries()) {
    if (now - value.created_at > maxAgeSeconds * 1000) {
      ticketStore.delete(key);
    }
  }
}
