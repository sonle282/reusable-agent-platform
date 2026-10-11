// Errors from Cloudflare that the owner should understand, mapped to a plain message and a status.
export function knownFailure(message: string): { status: 503; error: string; code: string } | null {
  if (/Durable Objects free tier/i.test(message))
    return { status: 503, code: "chat_store_limit", error: "Chats can't be opened right now: Cloudflare's free daily limit for the chat store is used up. It resets at 00:00 UTC, or right away on the Workers Paid plan. Customers' new messages are not lost." };
  return null;
}
