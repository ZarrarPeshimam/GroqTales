'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  Wand2,
  BookOpen,
  Users,
  Sparkles,
  Zap,
  MessageSquare,
  Save,
  Wallet,
  Settings,
  Target,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import { useWeb3 } from '@/components/providers/web3-provider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { truncateAddress } from '@/lib/utils';
import { generateContentHash } from '@/lib/story-hash';

interface AIStoryGeneratorProps {
  className?: string;
}

const DRAFT_KEY = "groqtales_story_draft_v1";

interface StoryDraft {
  prompt: string;
  storyTitle: string;
  selectedGenres: string[];
  storyLength: string;
  mainCharacterName: string;
  characterTraits: string[];
  updatedAt: number;
}

const genresList = [
  'Fantasy', 'Sci-Fi', 'Horror', 'Mystery', 'Romance', 
  'Adventure', 'Comedy', 'Cyberpunk', 'Thriller', 'Drama'
];

const characterTraitOptions = ['Brave', 'Cunning', 'Mysterious', 'Compassionate', 'Ruthless', 'Wise', 'Impulsive', 'Loyal'];

export default function AIStoryGenerator({ className = '' }: AIStoryGeneratorProps) {
  const { account, connected, connectWallet } = useWeb3();
  const { toast } = useToast();
  
  // States
  const [prompt, setPrompt] = useState('');
  const [storyTitle, setStoryTitle] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [storyLength, setStoryLength] = useState('medium');
  const [mainCharacterName, setMainCharacterName] = useState('');
  const [characterTraits, setCharacterTraits] = useState<string[]>([]);
  const [temperature, setTemperature] = useState([0.7]);
  
  // UI States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStory, setGeneratedStory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('input');
  const [isMinting, setIsMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState<'idle' | 'minted' | 'pending' | 'failed'>('idle');
  const [mintedNftUrl, setMintedNftUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveredDraft, setRecoveredDraft] = useState<StoryDraft | null>(null);

  const mintSessionLock = useRef(false);

  // Draft Recovery Logic
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft?.prompt?.trim()) {
          setRecoveredDraft(draft);
          setShowRecoveryModal(true);
        }
      } catch (e) {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, []);

  // Autosave
  useEffect(() => {
    if (!prompt.trim()) return;
    const timeout = setTimeout(() => {
      const draft: StoryDraft = {
        prompt, storyTitle, selectedGenres, storyLength, 
        mainCharacterName, characterTraits, updatedAt: Date.now()
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 2000);
    return () => clearTimeout(timeout);
  }, [prompt, storyTitle, selectedGenres, storyLength, mainCharacterName, characterTraits]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setActiveTab('preview');

    try {
      const response = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          prompt,
          options: { title: storyTitle, genres: selectedGenres, length: storyLength, temp: temperature[0] }
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      
      setGeneratedStory(data.result || data.story);
      toast({ title: 'BOOM! STORY GENERATED!', className: 'font-bangers bg-green-400 border-4 border-black' });
    } catch (error: any) {
      toast({ title: 'KABOOM!', description: error.message, variant: 'destructive' });
      setActiveTab('input');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = useCallback(async () => {
    if (!generatedStory) return;
    await navigator.clipboard.writeText(generatedStory);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied to clipboard!' });
  }, [generatedStory, toast]);

  const resetForm = () => {
    setPrompt('');
    setGeneratedStory(null);
    setActiveTab('input');
    localStorage.removeItem(DRAFT_KEY);
  };

  return (
    <div className={`w-full max-w-5xl mx-auto ${className}`}>
      <Card className="border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-gray-900 overflow-hidden rounded-3xl">
        <CardHeader className="bg-yellow-400 border-b-4 border-black p-6">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white p-2 rounded-full border-4 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Wand2 className="h-8 w-8 text-black" />
              </div>
              <span className="font-bangers text-4xl text-black">STORY MAKER 3000</span>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-black p-2 flex justify-center gap-4 border-b-4 border-black h-auto rounded-none">
                <TabsTrigger value="input" className="font-bangers text-xl text-white data-[state=active]:bg-white data-[state=active]:text-black">1. INPUT</TabsTrigger>
                <TabsTrigger value="preview" disabled={!generatedStory && !isGenerating} className="font-bangers text-xl text-white data-[state=active]:bg-white data-[state=active]:text-black">2. PREVIEW</TabsTrigger>
                <TabsTrigger value="mint" disabled={!generatedStory} className="font-bangers text-xl text-white data-[state=active]:bg-white data-[state=active]:text-black">3. MINT NFT</TabsTrigger>
            </TabsList>

            <div className="p-6 md:p-10">
              <TabsContent value="input" className="space-y-8 mt-0">
                <div className="space-y-4">
                  <Label className="font-bangers text-2xl flex items-center gap-2"><MessageSquare /> WHAT'S THE STORY, HERO?</Label>
                  <Textarea 
                    placeholder="Enter your prompt here..." 
                    className="border-4 border-black rounded-xl p-6 text-lg min-h-[150px]" 
                    value={prompt} 
                    onChange={(e) => setPrompt(e.target.value)} 
                  />
                </div>

                <Accordion type="single" collapsible className="border-4 border-black rounded-xl overflow-hidden">
                  <AccordionItem value="advanced" className="border-none">
                    <AccordionTrigger className="px-6 bg-gray-50 font-bangers text-xl">ADVANCED CUSTOMIZATION</AccordionTrigger>
                    <AccordionContent className="p-6 space-y-6">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Story Title</Label>
                          <Input value={storyTitle} onChange={(e) => setStoryTitle(e.target.value)} className="border-2 border-black" />
                        </div>
                        <div className="space-y-2">
                          <Label>Main Character</Label>
                          <Input value={mainCharacterName} onChange={(e) => setMainCharacterName(e.target.value)} className="border-2 border-black" />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <Button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-red-500 hover:bg-red-600 text-white font-bangers text-3xl py-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                  {isGenerating ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />} 
                  GENERATE STORY!
                </Button>
              </TabsContent>

              <TabsContent value="preview" className="mt-0">
                {isGenerating ? (
                  <div className="text-center py-20"><Loader2 className="h-20 w-20 animate-spin mx-auto" /><h2 className="font-bangers text-3xl mt-4">WRITING...</h2></div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-xl prose max-w-none">
                      <pre className="whitespace-pre-wrap font-sans">{generatedStory}</pre>
                    </div>
                    <div className="flex gap-4">
                      <Button onClick={handleCopy} variant="outline" className="flex-1 border-4 border-black font-bangers">
                        {copied ? <Check className="mr-2" /> : <Copy className="mr-2" />} {copied ? 'COPIED!' : 'COPY STORY'}
                      </Button>
                      <Button onClick={resetForm} variant="outline" className="border-4 border-black font-bangers"><RotateCcw className="mr-2" /> START OVER</Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="mint" className="text-center py-10">
                <Wallet className="h-20 w-20 mx-auto mb-6" />
                <h3 className="font-bangers text-4xl mb-6">MINT AS NFT?</h3>
                {!connected ? (
                  <Button onClick={connectWallet} className="bg-black text-white font-bangers text-xl px-10 py-4 border-4 border-black">CONNECT WALLET</Button>
                ) : (
                  <Button className="bg-purple-500 text-white font-bangers text-2xl px-10 py-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">MINT MASTERPIECE</Button>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}