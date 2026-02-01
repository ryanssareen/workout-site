'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BarChart3, Send, Loader2, Sparkles, User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Stats {
  totalAthletes: number;
  totalWorkouts: number;
  completionRate: number;
}

const EXAMPLE_QUESTIONS = [
  "How are my athletes performing this month?",
  "Which athletes have the lowest completion rates?",
  "Show me a breakdown of workouts by type",
  "Who hasn't completed a workout in the last week?",
  "Compare athlete performance over the last 30 days",
  "What's the trend in workout completion?",
];

export default function ReportsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect non-coaches
  useEffect(() => {
    if (!loading && user && user.role !== 'coach') {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (question?: string) => {
    const queryText = question || input.trim();
    if (!queryText || isLoading || !user) return;

    const userMessage: Message = { role: 'user', content: queryText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: queryText,
          coachId: user.uid,
          userEmail: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = { role: 'assistant', content: data.answer };
      setMessages(prev => [...prev, assistantMessage]);

      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'coach') {
    return null;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex-none mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              AI Reports
            </h1>
            <p className="text-muted-foreground mt-1">
              Ask questions about your athletes' performance in natural language
            </p>
          </div>
          {stats && (
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="px-3 py-1.5 rounded-lg bg-muted">
                <span className="text-muted-foreground">Athletes:</span>{' '}
                <span className="font-semibold">{stats.totalAthletes}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-muted">
                <span className="text-muted-foreground">Workouts:</span>{' '}
                <span className="font-semibold">{stats.totalWorkouts}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-muted">
                <span className="text-muted-foreground">Completion:</span>{' '}
                <span className="font-semibold">{stats.completionRate}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Ask me anything about your athletes</h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                I can analyze workout data, compare athlete performance, identify trends, and provide insights.
              </p>

              <div className="grid gap-2 sm:grid-cols-2 max-w-2xl">
                {EXAMPLE_QUESTIONS.map((question, i) => (
                  <button
                    key={i}
                    onClick={() => handleSubmit(question)}
                    className="text-left px-4 py-3 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-colors text-sm"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex gap-3 max-w-3xl',
                    message.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                  )}
                >
                  <div
                    className={cn(
                      'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={cn(
                      'rounded-lg px-4 py-3 max-w-[85%]',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 max-w-3xl">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-lg px-4 py-3 bg-muted">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Analyzing your data...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </CardContent>

        {/* Input Area */}
        <div className="flex-none border-t p-4">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your athletes..."
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-11 w-11 flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </Card>
    </div>
  );
}
