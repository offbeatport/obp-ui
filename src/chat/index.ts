// chat - the conversation surfaces: the frame, the bubbles, the composer.
//
// Two chat surfaces exist in the product (the docked co-pilot panel and the full-page thread) and
// they are near-duplicates of each other. Each family here ships ONE component with a `variant`
// so both looks stay reachable - nothing was picked as the winner.
//
// Message content is caller data: a role, some text, a timestamp, an avatar node. No message type
// crosses the boundary. Sending is the `onSend` prop; refreshing is the caller's business.

export { AssistantTurn, type AssistantTurnProps } from "./assistant-turn";
export {
    ASSISTANT_BUBBLE,
    ChatBubble,
    type ChatBubbleProps,
    type ChatBubbleVariant,
    type ChatRole,
    ChatSystemLine,
    type ChatSystemLineProps,
} from "./chat-bubble";
export {
    ChatComposer,
    type ChatComposerProps,
    type ChatComposerVariant,
} from "./chat-composer";
export {
    ChatEmptyState,
    type ChatEmptyStateProps,
    ChatPanel,
    ChatPanelHeader,
    type ChatPanelHeaderProps,
    type ChatPanelProps,
    type ChatPanelVariant,
} from "./chat-panel";
export { TypingIndicator, type TypingIndicatorProps } from "./typing-indicator";
export {
    ENTRANCE_MAX_STEPS,
    ENTRANCE_STEP_MS,
    type EntranceStaggerOptions,
    useEntranceStagger,
} from "./use-entrance-stagger";
