'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Brain, Send, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AICoachPage() {
  const user = useAuthStore((state) => state.user);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI workout coach. I can help you with training advice, workout planning, nutrition tips, and performance analysis. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [workoutData, setWorkoutData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load user's workout data
  useEffect(() => {
    const loadWorkoutData = async () => {
      if (!user) return;

      try {
        const workouts = await getUserWorkouts(user.uid, 'student');
        const thirtyDaysAgo = subDays(new Date(), 30);
        const recentWorkouts = workouts
          .filter(w => w.date.toDate() >= thirtyDaysAgo)
          .slice(0, 10)
          .map(w => ({
            date: format(w.date.toDate(), 'MMM d'),
            name: w.name,
            type: w.type,
            completed: w.completed,
            completedLate: w.completedLate,
          }));

        const completedCount = workouts.filter(w => w.completed).length;
        const completionRate = workouts.length > 0 
          ? Math.round((completedCount / workouts.length) * 100) 
          : 0;

        setWorkoutData({
          totalWorkouts: workouts.length,
          completedWorkouts: completedCount,
          completionRate,
          recentWorkouts,
        });
      } catch (error) {
        console.error('Failed to load workout data:', error);
      }
    };

    loadWorkoutData();
  }, [user]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })).concat([{ role: 'user', content: input }]),
          workoutData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();

      const aiMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);

      // Show unlock notification if unlocked
      if (data.unlocked) {
        toast.success('🔓 Dev mode activated!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to get AI response');
      console.error('AI chat error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="h-8 w-8 text-primary" />
          AI Workout Coach
        </h1>
        <p className="text-muted-foreground mt-1">
          Get personalized training advice powered by AI
        </p>
      </div>

      {/* Chat Card */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-primary/10 to-purple-500/10">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Chat with AI Coach
          </CardTitle>
          <CardDescription>
            Ask about workouts, training plans, nutrition, recovery, and more
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Messages */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.role === 'assistant' && (
                      <Brain className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p className={`text-xs mt-2 ${
                        message.role === 'user' 
                          ? 'text-primary-foreground/70' 
                          : 'text-muted-foreground'
                      }`}>
                        {format(message.timestamp, 'h:mm a')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-4 flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm text-muted-foreground">AI is thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask me anything about fitness and training..."
                className="min-h-[80px] resize-none"
                disabled={loading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                size="icon"
                className="h-[80px] w-[80px]"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tips Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">💡 Try asking:</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• "Should I run today or take a rest day?"</li>
            <li>• "How do I improve my 5K time?"</li>
            <li>• "What's a good workout plan for a half marathon?"</li>
            <li>• "Tips for recovery after hard training?"</li>
            <li>• "How should I fuel before a long run?"</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
