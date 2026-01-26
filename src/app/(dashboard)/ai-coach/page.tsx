'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts } from '@/lib/firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Brain, Send, Loader2, Sparkles, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { collection, addDoc, getDocs, query, where, orderBy as firestoreOrderBy, updateDoc, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase/config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatThread {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export default function AICoachPage() {
  const user = useAuthStore((state) => state.user);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [showNewThreadDialog, setShowNewThreadDialog] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
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

  // Load threads
  useEffect(() => {
    const loadThreads = async () => {
      if (!user) return;

      try {
        const threadsRef = collection(getDbInstance(), 'chatThreads');
        const q = query(
          threadsRef,
          where('userId', '==', user.uid),
          firestoreOrderBy('updatedAt', 'desc')
        );
        const snapshot = await getDocs(q);

        const loadedThreads = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          messages: (doc.data().messages || []).map((m: any) => ({
            ...m,
            timestamp: m.timestamp?.toDate ? m.timestamp.toDate() : new Date(m.timestamp),
          })),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as ChatThread[];

        setThreads(loadedThreads);

        // Auto-select first thread or show empty state
        if (loadedThreads.length > 0 && !activeThreadId) {
          setActiveThreadId(loadedThreads[0].id);
          setMessages(loadedThreads[0].messages);
        }
      } catch (error) {
        console.error('Failed to load threads:', error);
      } finally {
        setLoadingThreads(false);
      }
    };

    loadThreads();
  }, [user]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createNewThread = async () => {
    if (!user || !newThreadTitle.trim()) return;

    try {
      const threadsRef = collection(getDbInstance(), 'chatThreads');
      const newThread = {
        userId: user.uid,
        title: newThreadTitle.trim(),
        messages: [
          {
            role: 'assistant',
            content: "Hi! I'm your AI workout coach. How can I help you today?",
            timestamp: Timestamp.now(),
          },
        ],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(threadsRef, newThread);

      const created: ChatThread = {
        id: docRef.id,
        userId: user.uid,
        title: newThreadTitle.trim(),
        messages: [{
          role: 'assistant',
          content: "Hi! I'm your AI workout coach. How can I help you today?",
          timestamp: new Date(),
        }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setThreads([created, ...threads]);
      setActiveThreadId(created.id);
      setMessages(created.messages);
      setNewThreadTitle('');
      setShowNewThreadDialog(false);
      toast.success('New chat created!');
    } catch (error: any) {
      toast.error('Failed to create chat');
      console.error(error);
    }
  };

  const deleteThread = async (threadId: string) => {
    if (!confirm('Delete this chat? This cannot be undone.')) return;

    try {
      await deleteDoc(doc(getDbInstance(), 'chatThreads', threadId));
      const newThreads = threads.filter(t => t.id !== threadId);
      setThreads(newThreads);

      if (activeThreadId === threadId) {
        if (newThreads.length > 0) {
          setActiveThreadId(newThreads[0].id);
          setMessages(newThreads[0].messages);
        } else {
          setActiveThreadId(null);
          setMessages([]);
        }
      }

      toast.success('Chat deleted');
    } catch (error: any) {
      toast.error('Failed to delete chat');
      console.error(error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading || !activeThreadId) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
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

      const updatedMessages = [...newMessages, aiMessage];
      setMessages(updatedMessages);

      // Save to Firestore
      const threadRef = doc(getDbInstance(), 'chatThreads', activeThreadId);
      await updateDoc(threadRef, {
        messages: updatedMessages.map(m => ({
          ...m,
          timestamp: Timestamp.fromDate(m.timestamp),
        })),
        updatedAt: Timestamp.now(),
      });

      // Update local threads
      setThreads(threads.map(t =>
        t.id === activeThreadId
          ? { ...t, messages: updatedMessages, updatedAt: new Date() }
          : t
      ));

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

  const switchThread = (threadId: string) => {
    const thread = threads.find(t => t.id === threadId);
    if (thread) {
      setActiveThreadId(threadId);
      setMessages(thread.messages);
    }
  };

  if (loadingThreads) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            AI Workout Coach
          </h1>
          <p className="text-muted-foreground mt-1">
            Get personalized training advice powered by AI
          </p>
        </div>

        <Button onClick={() => setShowNewThreadDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar - Chat Threads */}
        <Card className="h-fit max-h-[700px] overflow-y-auto">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Your Chats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {threads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No chats yet. Create one to get started!
              </p>
            ) : (
              threads.map(thread => (
                <div
                  key={thread.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    activeThreadId === thread.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                  onClick={() => switchThread(thread.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{thread.title}</p>
                    <p className={`text-xs ${activeThreadId === thread.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {format(thread.updatedAt, 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteThread(thread.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Main Chat Area */}
        {activeThreadId ? (
          <Card>
            <CardHeader className="bg-gradient-to-r from-primary/10 to-purple-500/10">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {threads.find(t => t.id === activeThreadId)?.title || 'Chat'}
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
        ) : (
          <Card className="flex items-center justify-center min-h-[600px]">
            <CardContent className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No Chat Selected</h3>
              <p className="text-muted-foreground mb-4">
                Create a new chat to start talking with your AI coach!
              </p>
              <Button onClick={() => setShowNewThreadDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create New Chat
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* New Thread Dialog */}
      <Dialog open={showNewThreadDialog} onOpenChange={setShowNewThreadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Chat</DialogTitle>
            <DialogDescription>
              Give your chat a descriptive title
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="e.g., Marathon Training Plan, Nutrition Tips, Recovery Questions..."
              value={newThreadTitle}
              onChange={(e) => setNewThreadTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  createNewThread();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewThreadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createNewThread} disabled={!newThreadTitle.trim()}>
              Create Chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
