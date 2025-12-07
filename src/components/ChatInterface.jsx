import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { sendMessageToGemini } from '../lib/gemini';

export default function ChatInterface() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your learning companion. I can help answer questions about your plan or explain concepts. What are we working on?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
        // Pass current history (excluding the new user message we just added for UI, 
        // but the service handles appending it effectively via startChat or we pass it all)
        // Actually, let's pass the history *excluding* the one we just sent, 
        // and let the service call sendMessage with the new input.
        // Wait, the service wrapper I designed takes (history, message). 
        // Let's pass the *previous* messages as history.
        const responseText = await sendMessageToGemini(messages, input);
        
        setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (error) {
        console.error("Gemini Error:", error);
        setMessages(prev => [...prev, { role: 'assistant', content: "I'm having trouble connecting to my brain right now. Please check your API key." }]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <span className="font-semibold text-white">Companion</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={cn(
              "flex w-full",
              msg.sender === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
              msg.sender === 'user' 
                ? "bg-blue-600 text-white rounded-br-none" 
                : "bg-neutral-800 text-neutral-200 rounded-bl-none"
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-neutral-800 text-neutral-200 rounded-2xl rounded-tl-sm px-4 py-2 flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-sm">Thinking...</span>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-neutral-800">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="w-full bg-neutral-800/50 border border-neutral-700 text-white rounded-full py-3 pl-4 pr-12 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-neutral-500"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim()}
            className="absolute right-2 top-2 p-1.5 bg-blue-600 rounded-full hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:bg-neutral-700"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
