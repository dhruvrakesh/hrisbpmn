import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useExport } from '@/hooks/useExport';
import { MessageSquare, Send, Bot, User, Loader2, Download } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface AiChatInterfaceProps {
  bpmnFileId?: string;
  bpmnContext?: any;
  analysisResult?: any;
}

const AiChatInterface = ({ bpmnFileId, bpmnContext, analysisResult }: AiChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { exportChatToPDF } = useExport();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && bpmnFileId && messages.length === 0) {
      // Send initial context message when chat opens with BPMN data
      const contextMessage = `I'm looking at a BPMN process${analysisResult ? ` with ${analysisResult.findings?.length || 0} analysis findings` : ''}. Can you help me understand and optimize this HRIS process?`;
      handleSendMessage(contextMessage, true);
    }
  }, [isOpen, bpmnFileId, analysisResult]);

  const handleSendMessage = async (messageText?: string, isInitial = false) => {
    const message = messageText || inputMessage.trim();
    if (!message || loading) return;

    if (!isInitial) {
      setInputMessage('');
    }
    
    setLoading(true);
    console.log('💬 Sending AI chat message:', { message, bpmnFileId, sessionId });

    // Add user message to UI immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const requestPayload = {
        sessionId,
        message,
        bpmnFileId,
        bpmnContext: {
          ...bpmnContext,
          analysisResult: analysisResult ? {
            summary: analysisResult.summary,
            processIntelligence: analysisResult.processIntelligence,
            findingsCount: analysisResult.findings?.length || 0
          } : null
        }
      };

      console.log('📤 AI chat request payload:', requestPayload);

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: requestPayload
      });

      console.log('📥 AI chat response:', { data, error });

      if (error) {
        console.error('❌ AI chat error:', error);
        throw new Error(error.message || 'Failed to get AI response');
      }

      if (!data || !data.response) {
        console.error('❌ Invalid AI response format:', data);
        throw new Error('Invalid response format from AI service');
      }

      // Update session ID if new
      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        console.log('✅ Session ID updated:', data.sessionId);
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      console.log('✅ AI response added to chat:', assistantMessage.content.substring(0, 100) + '...');

      toast({
        title: "AI Response",
        description: "Got insights from your HRIS process expert.",
      });

    } catch (error: any) {
      console.error('❌ Chat error details:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${error.message || 'Unknown error'}. Please try again or clear the conversation to start fresh.`,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, errorMessage]);

      toast({
        title: "Chat Error",
        description: error.message || "Failed to get AI response.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      console.log('🏁 AI chat request completed, loading state cleared');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setSessionId(null);
    toast({
      title: "Conversation Cleared",
      description: "Started a new chat session.",
    });
  };

  const handleExportChat = async () => {
    if (!bpmnContext || messages.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No chat messages to export yet",
        variant: "destructive",
      });
      return;
    }

    try {
      const exportMessages = messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          created_at: msg.timestamp,
        }));
      await exportChatToPDF(exportMessages, bpmnContext.fileName);
      toast({
        title: "Success",
        description: "Chat conversation exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export chat conversation",
        variant: "destructive",
      });
    }
  };

  if (!isOpen) {
    return (
      <Card className="fixed bottom-4 right-4 w-80">
        <CardContent className="p-4">
          <Button 
            onClick={() => setIsOpen(true)}
            className="w-full flex items-center gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Ask AI about this process
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 h-[600px] flex flex-col shadow-lg">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5" />
              HRIS Process AI
            </CardTitle>
            <CardDescription>
              Expert guidance for your BPMN analysis
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportChat}
                disabled={loading}
              >
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearConversation}
              disabled={loading}
            >
              Clear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              ×
            </Button>
          </div>
        </div>
        {sessionId && (
          <Badge variant="outline" className="w-fit text-xs">
            Session Active
          </Badge>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                Ask me anything about this HRIS process!
              </p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
              }`}>
                {message.role === 'user' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              
              <div className={`flex-1 min-w-0 ${
                message.role === 'user' ? 'text-right' : ''
              }`}>
                <div className={`inline-block max-w-full rounded-lg p-3 text-sm break-words ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}>
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {message.content}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1 px-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="inline-block bg-muted rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} className="h-1" />
        </div>

        <div className="p-4 border-t flex-shrink-0 bg-background">
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about process optimization, risks, best practices..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={loading || !inputMessage.trim()}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AiChatInterface;