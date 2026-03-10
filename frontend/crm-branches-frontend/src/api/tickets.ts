import { http } from './http';

export interface Ticket {
  id: string;
  subject: string;
  body: string;
  hasImage?: boolean;
  createdBy?: string;
  createdByBranch?: string;
  targetBranch?: string;
  status: 'open' | 'closed';
  replyCount: number;
  createdAt: string;
}

export interface TicketReply {
  id: string;
  message: string;
  imageBase64?: string;
  userName?: string;
  branchName?: string;
  createdAt: string;
}

export interface TicketDetail extends Ticket {
  imageBase64?: string;
  replies: TicketReply[];
}

export async function getTicketCount(): Promise<{ success: boolean; openCount?: number; message?: string }> {
  const r = await http<{ openCount: number }>('/tickets/count');
  if (r.success && 'openCount' in r) return { success: true, openCount: r.openCount as number };
  return { success: false, message: r.message };
}

export async function getTickets(): Promise<{ success: boolean; tickets?: Ticket[]; message?: string }> {
  const r = await http<{ tickets: Ticket[] }>('/tickets');
  if (r.success && 'tickets' in r) return { success: true, tickets: r.tickets as Ticket[] };
  return { success: false, message: r.message };
}

export async function getTicket(id: string): Promise<{ success: boolean; ticket?: TicketDetail; message?: string }> {
  const r = await http<{ ticket: TicketDetail }>(`/tickets/${id}`);
  if (r.success && 'ticket' in r) return { success: true, ticket: r.ticket as TicketDetail };
  return { success: false, message: r.message };
}

export async function createTicket(data: {
  subject: string;
  body: string;
  targetBranchId?: string;
  imageBase64?: string;
}): Promise<{ success: boolean; ticket?: Ticket; message?: string }> {
  const r = await http<{ ticket: Ticket }>('/tickets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (r.success && 'ticket' in r) return { success: true, ticket: r.ticket as Ticket };
  return { success: false, message: r.message || 'Failed to create ticket' };
}

export async function addTicketReply(
  id: string,
  data: { message: string; imageBase64?: string }
): Promise<{ success: boolean; ticket?: TicketDetail; message?: string }> {
  const r = await http<{ ticket: TicketDetail }>(`/tickets/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (r.success && 'ticket' in r) return { success: true, ticket: r.ticket as TicketDetail };
  return { success: false, message: r.message || 'Failed to add reply' };
}

export async function updateTicketStatus(
  id: string,
  status: 'open' | 'closed'
): Promise<{ success: boolean; message?: string }> {
  const r = await http<{ ticket: { id: string; status: string } }>(`/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return r.success ? { success: true } : { success: false, message: r.message };
}
