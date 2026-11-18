import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/utils';

function MessageBody({ role, content }) {
  if (role === 'user') {
    return <p className="whitespace-pre-wrap break-words">{content}</p>;
  }

  return (
    <div className="break-words text-sm leading-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          a: ({ href, children }) => (
            href && /^https?:\/\//i.test(href)
              ? <a href={href} target="_blank" rel="noreferrer noopener" className="text-blue-300 underline">{children}</a>
              : <span>{children}</span>
          ),
          code: ({ children }) => <code className="rounded bg-black/40 px-1 py-0.5 text-[0.85em]">{children}</code>,
          pre: ({ children }) => <pre className="mb-2 overflow-x-auto rounded-xl bg-black/40 p-3">{children}</pre>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function ChatInterface({ messages, onSend, sending }) {
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    try {
      await onSend(text);
    } catch {
      setInput(text);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
        <Sparkles className="h-4 w-4 text-purple-400" />
        <span className="text-sm font-semibold">Companion</span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                message.role === 'user' ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md bg-neutral-800 text-neutral-100',
              )}
            >
              <MessageBody role={message.role} content={message.content} />
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-neutral-800 px-3 py-2 text-sm text-neutral-300">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              Thinking
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-neutral-800 p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            enterKeyHint="send"
            autoComplete="off"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about today"
            className="min-h-12 min-w-0 flex-1 rounded-full border border-neutral-700 bg-neutral-900 px-4 text-base text-white outline-none placeholder:text-neutral-500"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            aria-label="Send"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 disabled:bg-neutral-800"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
