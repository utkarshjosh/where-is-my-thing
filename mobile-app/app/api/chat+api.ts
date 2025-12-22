import { streamText, UIMessage } from 'ai';

export async function POST(req: Request) {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const result = streamText({
        model: 'openai/gpt-4o-mini', // Using Vercel AI Gateway format
        system: `You are a helpful spatial memory assistant. Your role is to:
- Help users remember where they placed items
- Recall information about stored items when asked
- Suggest organizational improvements
- Be conversational yet concise
- If you don't know where something is, say so honestly

When a user says they're putting something somewhere, acknowledge it warmly.
When asked where something is, provide the location if known.

Keep responses brief and helpful.`,
        messages: messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.parts?.filter(p => p.type === 'text').map(p => (p as { type: 'text'; text: string }).text).join('') || '',
        })),
    });

    return result.toUIMessageStreamResponse({
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'none',
        },
    });
}

