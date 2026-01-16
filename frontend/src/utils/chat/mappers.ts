import { ChatHistoryEntry, ChatMessage } from '../../types';

export const pickFirstString = (...values: Array<string | null | undefined>): string | undefined =>
    values.find((value): value is string => typeof value === 'string' && value.trim().length > 0);

export const mapHistoryEntryToChatMessage = (entry: ChatHistoryEntry, index: number): ChatMessage => {
    const role: 'user' | 'assistant' =
        entry.role === 'assistant' || entry.role === 'user'
            ? entry.role
            : index % 2 === 0
                ? 'user'
                : 'assistant';

    const roleSpecificCandidates = role === 'assistant'
        ? [
            entry.answer,
            entry.response,
            entry.assistant_message,
            entry.content,
            entry.message,
        ]
        : [
            entry.message,
            entry.question,
            entry.prompt,
            entry.user_message,
            entry.content,
        ];

    const content = pickFirstString(...roleSpecificCandidates, entry.response, entry.answer) || '';
    const timestamp = pickFirstString(entry.timestamp, entry.created_at, entry.updated_at) || new Date().toISOString();
    // idSource: entry.id가 number일 수도, string일 수도 있음
    const idSource = entry.id ?? entry.timestamp ?? `${role}-${index}`;
    const id = typeof idSource === 'string' ? idSource : idSource.toString();
    const sources = Array.isArray(entry.sources) && entry.sources.length > 0 ? entry.sources : undefined;

    const message: ChatMessage = {
        id,
        role,
        content,
        timestamp,
    };

    if (sources) {
        message.sources = sources;
    }

    return message;
};
