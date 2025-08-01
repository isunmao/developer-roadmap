import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useChat, type ChatMessage } from '../../hooks/use-chat';
import { RoadmapAIChatCard } from '../RoadmapAIChat/RoadmapAIChatCard';
import {
  ArrowDownIcon,
  BotIcon,
  LockIcon,
  MessageCircleIcon,
  PauseCircleIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { ChatHeaderButton } from '../FrameRenderer/RoadmapFloatingChat';
import { isLoggedIn } from '../../lib/jwt';
import { showLoginPopup } from '../../lib/popup';
import { flushSync } from 'react-dom';
import { markdownToHtml } from '../../lib/markdown';
import { aiLimitOptions } from '../../queries/ai-course';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '../../stores/query-client';
import { billingDetailsOptions } from '../../queries/billing';
import { LoadingChip } from '../LoadingChip';
import { getTailwindScreenDimension } from '../../lib/is-mobile';
import { useToast } from '../../hooks/use-toast';
import type { AIRoadmapChatActions } from './AIRoadmap';
import type { RoadmapNodeDetails } from './AIRoadmapContent';

type AIRoadmapChatProps = {
  roadmapSlug?: string;
  isRoadmapLoading?: boolean;
  onUpgrade?: () => void;
  aiChatActionsRef?: RefObject<AIRoadmapChatActions | null>;
};

export function AIRoadmapChat(props: AIRoadmapChatProps) {
  const { roadmapSlug, isRoadmapLoading, onUpgrade, aiChatActionsRef } = props;

  const toast = useToast();
  const scrollareaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputValue, setInputValue] = useState('');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const {
    data: tokenUsage,
    isLoading: isTokenUsageLoading,
    refetch: refetchTokenUsage,
  } = useQuery(aiLimitOptions(), queryClient);

  const { data: userBillingDetails, isLoading: isBillingDetailsLoading } =
    useQuery(billingDetailsOptions(), queryClient);

  const isLimitExceeded = (tokenUsage?.used || 0) >= (tokenUsage?.limit || 0);
  const isPaidUser = userBillingDetails?.status === 'active';

  const {
    messages,
    status,
    streamedMessageHtml,
    sendMessages,
    setMessages,
    stop,
  } = useChat({
    endpoint: `${import.meta.env.PUBLIC_API_URL}/v1-ai-roadmap-chat`,
    onError: (error) => {
      console.error(error);
      toast.error(error?.message || 'Something went wrong');
    },
    data: {
      aiRoadmapSlug: roadmapSlug,
    },
    onFinish: () => {
      refetchTokenUsage();
    },
  });

  const scrollToBottom = useCallback(
    (behavior: 'smooth' | 'instant' = 'smooth') => {
      scrollareaRef.current?.scrollTo({
        top: scrollareaRef.current.scrollHeight,
        behavior,
      });
    },
    [scrollareaRef],
  );

  const isStreamingMessage = status === 'streaming';
  const hasMessages = messages.length > 0;

  const handleSubmitInput = useCallback(
    (defaultInputValue?: string) => {
      const message = defaultInputValue || inputValue;
      if (!isLoggedIn()) {
        showLoginPopup();
        return;
      }

      if (isStreamingMessage) {
        return;
      }

      const newMessages: ChatMessage[] = [
        ...messages,
        {
          role: 'user',
          content: message,
          html: markdownToHtml(message),
        },
      ];
      flushSync(() => {
        setMessages(newMessages);
      });
      sendMessages(newMessages);
      setInputValue('');

      setTimeout(() => {
        scrollToBottom('smooth');
      }, 0);
    },
    [inputValue, isStreamingMessage, messages, sendMessages, setMessages],
  );

  const checkScrollPosition = useCallback(() => {
    const scrollArea = scrollareaRef.current;
    if (!scrollArea) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollArea;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50; // 50px threshold
    setShowScrollToBottom(!isAtBottom && messages.length > 0);
  }, [messages.length]);

  useEffect(() => {
    const scrollArea = scrollareaRef.current;
    if (!scrollArea) {
      return;
    }

    scrollArea.addEventListener('scroll', checkScrollPosition);
    return () => scrollArea.removeEventListener('scroll', checkScrollPosition);
  }, [checkScrollPosition]);

  const isLoading =
    isRoadmapLoading || isTokenUsageLoading || isBillingDetailsLoading;

  useLayoutEffect(() => {
    const deviceType = getTailwindScreenDimension();
    const isMediumSize = ['sm', 'md'].includes(deviceType);

    if (!isMediumSize) {
      const storedState = localStorage.getItem('chat-history-sidebar-open');
      setIsChatOpen(storedState === null ? true : storedState === 'true');
    } else {
      setIsChatOpen(!isMediumSize);
    }

    setIsMobile(isMediumSize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('chat-history-sidebar-open', isChatOpen.toString());
    }
  }, [isChatOpen, isMobile]);

  useImperativeHandle(aiChatActionsRef, () => ({
    handleNodeClick: (node: RoadmapNodeDetails) => {
      handleSubmitInput(`Explain what is "${node.nodeTitle}" topic in detail.`);
    },
  }));

  if (!isChatOpen) {
    return (
      <div className="absolute inset-x-0 bottom-0 flex justify-center p-2">
        <button
          className="flex items-center justify-center gap-2 rounded-full bg-black px-4 py-2 text-white shadow"
          onClick={() => {
            setIsChatOpen(true);
          }}
        >
          <MessageCircleIcon className="h-4 w-4" />
          <span className="text-sm">Open Chat</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex h-full w-full max-w-full flex-col overflow-hidden border-l border-gray-200 bg-white md:relative md:max-w-[40%]">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white p-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <BotIcon className="h-4 w-4" />
          AI Roadmap
        </h2>

        <button
          className="mr-2 flex size-5 items-center justify-center rounded-md text-gray-500 hover:bg-gray-300 md:hidden"
          onClick={() => {
            setIsChatOpen(false);
          }}
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <LoadingChip message="Loading..." />
        </div>
      )}

      {!isLoading && (
        <>
          <div className="relative grow overflow-y-auto" ref={scrollareaRef}>
            <div className="absolute inset-0 flex flex-col">
              <div className="relative flex grow flex-col justify-end">
                <div className="flex flex-col justify-end gap-2 px-3 py-2">
                  <RoadmapAIChatCard
                    role="assistant"
                    html="Hello, how can I help you today?"
                    isIntro
                  />

                  {messages.map((chat, index) => {
                    return (
                      <RoadmapAIChatCard key={`chat-${index}`} {...chat} />
                    );
                  })}

                  {status === 'streaming' && !streamedMessageHtml && (
                    <RoadmapAIChatCard role="assistant" html="Thinking..." />
                  )}

                  {status === 'streaming' && streamedMessageHtml && (
                    <RoadmapAIChatCard
                      role="assistant"
                      html={streamedMessageHtml}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {(hasMessages || showScrollToBottom) && (
            <div className="flex flex-row justify-between gap-2 border-t border-gray-200 px-3 py-2">
              <ChatHeaderButton
                icon={<Trash2Icon className="h-3.5 w-3.5" />}
                className="rounded-md bg-gray-200 py-1 pr-2 pl-1.5 text-gray-500 hover:bg-gray-300"
                onClick={() => {
                  setMessages([]);
                }}
              >
                Clear
              </ChatHeaderButton>
              {showScrollToBottom && (
                <ChatHeaderButton
                  icon={<ArrowDownIcon className="h-3.5 w-3.5" />}
                  className="rounded-md bg-gray-200 py-1 pr-2 pl-1.5 text-gray-500 hover:bg-gray-300"
                  onClick={() => {
                    scrollToBottom('smooth');
                  }}
                >
                  Scroll to bottom
                </ChatHeaderButton>
              )}
            </div>
          )}

          <div className="relative flex items-center border-t border-gray-200 text-sm">
            {isLimitExceeded && isLoggedIn() && (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-black text-white">
                <LockIcon
                  className="size-4 cursor-not-allowed"
                  strokeWidth={2.5}
                />
                <p className="cursor-not-allowed">
                  Limit reached for today
                  {isPaidUser ? '. Please wait until tomorrow.' : ''}
                </p>
                {!isPaidUser && (
                  <button
                    onClick={() => {
                      onUpgrade?.();
                    }}
                    className="rounded-md bg-white px-2 py-1 text-xs font-medium text-black hover:bg-gray-300"
                  >
                    Upgrade for more
                  </button>
                )}
              </div>
            )}

            {!isLoggedIn() && (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-black text-white">
                <LockIcon
                  className="size-4 cursor-not-allowed"
                  strokeWidth={2.5}
                />
                <p className="cursor-not-allowed">Please login to continue</p>
                <button
                  onClick={() => {
                    showLoginPopup();
                  }}
                  className="rounded-md bg-white px-2 py-1 text-xs font-medium text-black hover:bg-gray-300"
                >
                  Login / Register
                </button>
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
              data-clarity-unmask="true"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (isStreamingMessage) {
                    return;
                  }
                  handleSubmitInput();
                }
              }}
              placeholder="Ask me anything about this roadmap..."
              className="w-full resize-none px-3 py-4 outline-none"
            />

            <button
              className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-zinc-500 hover:text-black disabled:opacity-50"
              onClick={() => {
                if (!isLoggedIn()) {
                  showLoginPopup();
                  return;
                }

                if (status !== 'idle') {
                  stop();
                  return;
                }

                handleSubmitInput();
              }}
            >
              {isStreamingMessage ? (
                <PauseCircleIcon className="h-4 w-4" />
              ) : (
                <SendIcon className="h-4 w-4" />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
