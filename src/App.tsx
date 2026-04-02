/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { Send, Sparkles, User, Bot, Trash2, Heart, Mic, MicOff, Smile } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
import { cn } from "@/src/lib/utils";
import { Message, SYSTEM_PROMPT } from "./types";

const MODEL_NAME = "gemini-3-flash-preview";
const BOT_AVATAR_URL = "https://picsum.photos/seed/nusrat_v3_grayscale/200/200?grayscale";
const USER_AVATAR_URL = "https://picsum.photos/seed/user/200/200";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [chat, setChat] = useState<any>(null);
  const recognitionRef = useRef<any>(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load history from localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem('nusrat_chat_history');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed);
      } catch (e) {
        console.error("Failed to parse saved history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('nusrat_chat_history', JSON.stringify(messages));
    }
  }, [messages]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US'; // Default, but will pick up Bangla if spoken usually

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
        inputRef.current?.focus();
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        inputRef.current?.focus();
      };

      recognition.onend = () => {
        setIsListening(false);
        inputRef.current?.focus();
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (error) {
        console.error("Failed to start recognition:", error);
      }
    }
  };

  // Initialize Gemini Chat
  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    
    // Convert our messages to Gemini history format
    const savedMessages = localStorage.getItem('nusrat_chat_history');
    let initialHistory = [];
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages) as Message[];
        initialHistory = parsed
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          }));
      } catch (e) {
        console.error("Failed to load history for Gemini", e);
      }
    }

    const newChat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
      history: initialHistory,
    });
    setChat(newChat);
    
    // Initial greeting if no history
    if (initialHistory.length === 0) {
      const greet = async () => {
        setIsLoading(true);
        try {
          const response = await newChat.sendMessage({ message: "Hi! Introduce yourself as NusratBot and mention that Rafid created you (Rafid amake baniyeche)." });
          setMessages([{
            role: 'assistant',
            content: response.text || "Hey there! I'm NusratBot. Ready to chat? 😏",
            timestamp: Date.now()
          }]);
        } catch (error) {
          console.error("Failed to greet:", error);
        } finally {
          setIsLoading(false);
        }
      };
      greet();
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !chat) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    inputRef.current?.focus();

    try {
      const response = await chat.sendMessage({ message: input });
      const botMessage: Message = {
        role: 'assistant',
        content: response.text || "I'm not sure what to say to that... but you're cute! 😉",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Oops, something went wrong. Even I have my moments! Try again? 😘",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('nusrat_chat_history');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const newChat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
    });
    setChat(newChat);
  };

  const onEmojiClick = (emojiData: any) => {
    setInput(prev => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-2xl mx-auto bg-[#0f0f0f] shadow-2xl sm:border-x border-white/5 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-[#1c1c1c] border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-brand-primary/30 shadow-lg">
              <img 
                src={BOT_AVATAR_URL} 
                alt="NusratBot" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#1c1c1c] rounded-full"></div>
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight flex items-center gap-2">
              NusratBot <Heart className="w-3 h-3 text-pink-500 fill-pink-500" />
            </h1>
            <p className="text-xs text-white/50">Online</p>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white"
          title="Clear chat"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </header>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        <AnimatePresence mode="popLayout">
          {messages.map((msg, idx) => (
            <motion.div
              key={msg.timestamp + idx}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex w-full",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "flex gap-3 max-w-[85%]",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-full flex-shrink-0 overflow-hidden mt-1 border border-white/10",
                  msg.role === 'user' ? "bg-brand-primary/20" : "bg-white/10"
                )}>
                  <img 
                    src={msg.role === 'user' ? USER_AVATAR_URL : BOT_AVATAR_URL} 
                    alt={msg.role} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className={cn(
                  "p-3 rounded-2xl text-sm leading-relaxed",
                  msg.role === 'user' 
                    ? "bg-brand-primary text-white rounded-tr-none shadow-lg shadow-brand-primary/10" 
                    : "bg-[#1c1c1c] text-white/90 rounded-tl-none border border-white/5"
                )}>
                  <div className="markdown-body prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="flex gap-3 items-center bg-[#1c1c1c] p-3 rounded-2xl rounded-tl-none border border-white/5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce"></span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#0f0f0f] border-t border-white/10 relative">
        {showEmojiPicker && (
          <div 
            ref={emojiPickerRef}
            className="absolute bottom-full left-0 right-0 sm:left-4 sm:right-auto mb-2 z-50 shadow-2xl px-2 sm:px-0"
          >
            <EmojiPicker 
              onEmojiClick={onEmojiClick}
              theme={Theme.DARK}
              emojiStyle={EmojiStyle.NATIVE}
              lazyLoadEmojis={true}
              searchPlaceholder="Search emoji..."
              width="100%"
              height={350}
            />
          </div>
        )}
        
        <div className="relative flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={toggleListening}
              className={cn(
                "p-3 rounded-full transition-all shrink-0",
                isListening 
                  ? "bg-red-500 text-white animate-pulse" 
                  : "bg-[#1c1c1c] text-white/50 hover:text-white border border-white/10"
              )}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn(
                "p-3 rounded-full transition-all shrink-0 bg-[#1c1c1c] border border-white/10",
                showEmojiPicker ? "text-brand-primary border-brand-primary/30" : "text-white/50 hover:text-white"
              )}
              title="Add emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>
          
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isListening ? "Listening..." : "Type a message..."}
              className="w-full bg-[#1c1c1c] border border-white/10 rounded-full py-3 px-5 pr-12 focus:outline-none focus:border-brand-primary/50 transition-all text-sm placeholder:text-white/30"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={cn(
                "absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all",
                input.trim() && !isLoading 
                  ? "bg-brand-primary text-white hover:scale-105 active:scale-95" 
                  : "text-white/20 cursor-not-allowed"
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-center mt-3 text-white/20 flex items-center justify-center gap-1">
          Powered by Gemini <Sparkles className="w-2 h-2" />
        </p>
      </div>
    </div>
  );
}
