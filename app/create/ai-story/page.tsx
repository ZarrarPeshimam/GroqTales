'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  BookText,
  Zap,
  Send,
  RotateCcw,
  Copy,
  Check,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  Download,
  FileText,
  ChevronDown,
  ChevronRight,
  PenSquare,
  Layers,
  Hash,
  AlignLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

import { ParameterPanel } from '@/components/parameter-panel';
import { StoryCanvas } from '@/components/story-canvas';
import { GuidedTour, AI_STORY_TOUR_STEPS } from '@/components/guided-tour';
import { useStoryCanvas } from '@/hooks/useStoryCanvas';
import * as canvasUtils from '@/lib/canvas-utils';

// Story Studio components
import { PanelProgressTracker } from './components/panel-progress-tracker';
import { GenreLockIndicator } from './components/genre-lock-indicator';
import { StoryMemoryDisplay } from './components/story-memory-display';
import { PanelCreationForm } from './components/panel-creation-form';
import { StoryOutputDisplay } from './components/story-output-display';

// Services & types
import { PanelLifecycleManager } from '@/lib/services/panel-lifecycle-manager';
import { StoryMemoryManager } from '@/lib/services/story-memory-manager';
import { AIOrchestrationService } from '@/lib/services/ai-orchestration-service';
import { lockGenres, canModifyGenres } from '@/lib/utils/genre-manager';
import {
  StorySession,
  PanelData,
  PanelParameters,
  StoryMemory,
} from '@/lib/types/story-session';

interface StoryPrompt {
  title: string;
  mainCharacters: string;
  plotOutline: string;
  setting: string;
  themes: string;
}

const availableGenres = [
  'Fantasy', 'Sci-Fi', 'Mystery', 'Romance', 'Thriller',
  'Horror', 'Adventure', 'Comedy', 'Drama', 'Historical',
];

export default function AIStoryGeneratorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-black">
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <PenSquare className="w-12 h-12 text-emerald-500" />
          </motion.div>
        </div>
      }
    >
      <AIStoryContent />
    </Suspense>
  );
}

function AIStoryContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const { canvasState, setCanvasState } = useStoryCanvas({
    storageKey: 'aiStoryCanvasState',
    autoSave: true,
  });

  // ── Services (stable refs) ──────────────────────────────────────
  const lifecycleRef = useRef(new PanelLifecycleManager());
  const memoryMgrRef = useRef(new StoryMemoryManager());
  const orchestratorRef = useRef(
    new AIOrchestrationService(memoryMgrRef.current)
  );

  // ── Story Session State ──────────────────────────────────────────
  const [session, setSession] = useState<StorySession>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('storyStudioSession');
        if (saved) return JSON.parse(saved) as StorySession;
      } catch { /* start fresh */ }
    }
    return createEmptySession();
  });

  // ── UI State ────────────────────────────────────────────────────
  const [storyPrompt, setStoryPrompt] = useState<StoryPrompt>({
    title: session.title || '',
    mainCharacters: '',
    plotOutline: '',
    setting: '',
    themes: '',
  });
  const [selectedGenre, setSelectedGenre] = useState('Fantasy');
  const [storyDescription, setStoryDescription] = useState('');
  const [selectedParameters, setSelectedParameters] = useState<Set<string>>(new Set());
  const [parameterValues, setParameterValues] = useState<Record<string, unknown>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editorTab, setEditorTab] = useState<'chapter' | 'compiled'>('chapter');
  const [currentChapterContent, setCurrentChapterContent] = useState('');
  const [expandedParamCategories, setExpandedParamCategories] = useState<Set<string>>(
    new Set(['Tone & Style', 'Plot Structure'])
  );

  const genre = searchParams.get('genre') || 'fantasy';
  const currentPanelIndex = lifecycleRef.current.getNextPanelIndex(session.panels);
  const effectiveCurrentPanel = currentPanelIndex === -1 ? session.panels.length : currentPanelIndex;

  // ── Load import from Shakti Spark ───────────────────────────────
  useEffect(() => {
    try {
      const imported = localStorage.getItem('vedascript_import');
      if (imported) {
        const data = JSON.parse(imported);
        if (data.content) setCurrentChapterContent(data.content);
        if (data.genre) setSelectedGenre(data.genre);
        if (data.prompt) setStoryPrompt(prev => ({ ...prev, plotOutline: data.prompt }));
        localStorage.removeItem('vedascript_import');
      }
    } catch { /* ignore */ }
  }, []);

  // ── Persist session to localStorage ─────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem('storyStudioSession', JSON.stringify(session));
    } catch { /* quota exceeded, silently ignore */ }
  }, [session]);

  // ── Canvas sync — create chapter nodes ──────────────────────────
  useEffect(() => {
    if (canvasState.nodes.length === 0 && selectedParameters.size > 0) {
      let newState = canvasUtils.createEmptyCanvasState();
      const chapterNode = canvasUtils.createNode('chapter' as any, 'Chapter 1', 100, 100);
      newState = canvasUtils.addNode(newState, chapterNode);
      setCanvasState(newState);
    }
  }, [selectedParameters.size]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ────────────────────────────────────────────────────
  const handleParameterChange = useCallback((id: string, value: unknown) => {
    setParameterValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleParameterToggle = useCallback((id: string, enabled: boolean) => {
    setSelectedParameters((prev) => {
      const next = new Set(prev);
      enabled ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const handleGenreChange = useCallback((genres: string[]) => {
    setSession((prev) => ({ ...prev, genres }));
  }, []);

  const handleAddChapter = useCallback(() => {
    const count = canvasState.nodes.length;
    const newNode = canvasUtils.createNode(
      'chapter' as any,
      `Chapter ${count + 1}`,
      100,
      100 + count * 120
    );
    const newState = canvasUtils.addNode(canvasState, newNode);
    setCanvasState(newState);
    toast({ title: 'Chapter added', description: `Chapter ${count + 1} created` });
  }, [canvasState, setCanvasState, toast]);

  const handleDeleteChapter = useCallback(() => {
    if (canvasState.nodes.length <= 1) return;
    const lastNode = canvasState.nodes[canvasState.nodes.length - 1];
    if (!lastNode) return;
    const newState = canvasUtils.deleteNode(canvasState, lastNode.id);
    setCanvasState(newState);
    toast({ title: 'Chapter removed' });
  }, [canvasState, setCanvasState, toast]);

  const handleGeneratePanel = useCallback(async () => {
    const panelIdx = currentPanelIndex;
    if (panelIdx === -1) {
      toast({ title: 'Story Complete', description: 'All panels have been generated!' });
      return;
    }

    // Lock genres on Panel 1 completion
    if (panelIdx === 1 && !session.genresLocked && session.genres.length > 0) {
      const locked = lockGenres(session.genres);
      setSession((prev) => ({ ...prev, genres: [...locked], genresLocked: true }));
    }

    setIsGenerating(true);
    setGenerationError(null);

    const panelParams = parameterValues as PanelParameters;

    try {
      const result = await orchestratorRef.current.generatePanel(
        panelIdx,
        panelParams,
        session.storyMemory,
        session.genres,
        session.panels
      );

      const newPanel: PanelData = {
        panelIndex: panelIdx,
        title: storyPrompt.title || `Chapter ${panelIdx}`,
        parameters: panelParams,
        generatedContent: result.content,
        wordCount: result.wordCount,
        status: 'complete',
        metadata: {
          createdAt: new Date(),
          generatedAt: new Date(),
          tokensUsed: result.tokensUsed,
        },
      };

      const updatedMemory = orchestratorRef.current.updateStoryMemory(
        newPanel,
        session.storyMemory
      );

      setSession((prev) => ({
        ...prev,
        panels: [...prev.panels, newPanel],
        storyMemory: updatedMemory,
        title: storyPrompt.title || prev.title,
        metadata: {
          ...prev.metadata,
          updatedAt: new Date(),
          totalWordCount: prev.metadata.totalWordCount + result.wordCount,
        },
        status: panelIdx === 7 ? 'complete' : 'in-progress',
      }));

      setCurrentChapterContent(result.content);
      setEditorTab('chapter');
      toast({
        title: `Chapter ${panelIdx} Generated!`,
        description: `${result.wordCount} words in ${(result.generationTime / 1000).toFixed(1)}s`,
      });
    } catch (error) {
      const errMsg = (error as Error).message || 'Generation failed';
      setGenerationError(errMsg);
      toast({ title: 'Generation Failed', description: errMsg, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  }, [currentPanelIndex, session, storyPrompt.title, parameterValues, toast]);

  const handleCopyStory = useCallback(async () => {
    const fullText = session.panels
      .sort((a, b) => a.panelIndex - b.panelIndex)
      .map((p) => `## Chapter ${p.panelIndex}: ${p.title}\n\n${p.generatedContent}`)
      .join('\n\n---\n\n');
    try {
      await navigator.clipboard.writeText(fullText || currentChapterContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied!', description: 'Story copied to clipboard' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  }, [session.panels, currentChapterContent, toast]);

  const handleReset = useCallback(() => {
    setSession(createEmptySession());
    setStoryPrompt({ title: '', mainCharacters: '', plotOutline: '', setting: '', themes: '' });
    setSelectedParameters(new Set());
    setParameterValues({});
    setGenerationError(null);
    setCurrentChapterContent('');
    setCanvasState(canvasUtils.createEmptyCanvasState());
    localStorage.removeItem('storyStudioSession');
  }, [setCanvasState]);

  const handleSaveDraft = useCallback(() => {
    try {
      localStorage.setItem(
        'aiStoryDraft',
        JSON.stringify({
          prompt: storyPrompt,
          selectedParameters: Array.from(selectedParameters),
          parameterValues,
          session,
          currentChapterContent,
          savedAt: new Date().toISOString(),
        })
      );
      toast({ title: 'Draft saved', description: 'Your work has been saved locally.' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  }, [storyPrompt, selectedParameters, parameterValues, session, currentChapterContent, toast]);

  // ── Derived data ────────────────────────────────────────────────
  const panelStatuses = Array.from({ length: 7 }, (_, i) => {
    const panel = session.panels.find((p) => p.panelIndex === i + 1);
    return panel ? panel.status : ('pending' as const);
  });

  const completedCount = lifecycleRef.current.getCompletePanelCount(session.panels);
  const totalWordCount = session.metadata.totalWordCount + currentChapterContent.split(/\s+/).filter(Boolean).length;
  const totalChapters = canvasState.nodes.length;

  const compiledStory = session.panels
    .sort((a, b) => a.panelIndex - b.panelIndex)
    .map((p) => `## Chapter ${p.panelIndex}: ${p.title}\n\n${p.generatedContent}`)
    .join('\n\n---\n\n');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-black text-white font-sans"
    >
      <GuidedTour steps={AI_STORY_TOUR_STEPS} tourId="ai-story-creation" enabled={true} autoStart={true} />

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(16,185,129,0.06),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(59,130,246,0.05),_transparent_50%)]" />
      </div>

      <div className="relative z-10">
        {/* ═══ TOP BAR ═══ */}
        <div className="border-b border-white/[0.06] bg-black/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <PenSquare className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white tracking-tight">VedaScript Engine</h1>
                  <p className="text-xs text-white/40">Deep narrative control for AI-native stories.</p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 rounded-lg bg-white/5 border border-white/[0.06]">
                <FileText className="w-3.5 h-3.5 text-white/40" />
                <span className="text-sm text-white/60 truncate max-w-[200px]">
                  {storyPrompt.title || 'Untitled Story'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveDraft}
                className="bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
              >
                <Save className="w-4 h-4 mr-1.5" />
                Save Draft
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyStory}
                disabled={completedCount === 0 && !currentChapterContent}
                className="bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
              >
                {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Download className="w-4 h-4 mr-1.5" />}
                Export
              </Button>
              <Link href="/create">
                <button className="group flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Forge
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* ═══ MAIN 3-COLUMN LAYOUT ═══ */}
        <div className="max-w-[1800px] mx-auto px-4 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

            {/* ── LEFT: Story Structure Canvas ── */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-3"
              data-tour="canvas"
            >
              <div className="sticky top-[72px] space-y-4">
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl overflow-hidden">
                  {/* Canvas Header */}
                  <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookText className="w-4 h-4 text-blue-400" />
                      <span className="font-semibold text-sm text-white/90">Story Structure</span>
                    </div>
                    <span className="text-xs text-white/30">{totalChapters} chapter{totalChapters !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Canvas Body */}
                  <div className="h-[420px]">
                    {canvasState.nodes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-white/40 px-4">
                        <BookText className="w-10 h-10 mb-3 opacity-20" />
                        <p className="text-sm text-center">No chapters yet. Add your first chapter to begin.</p>
                      </div>
                    ) : (
                      <StoryCanvas
                        state={canvasState}
                        onChange={setCanvasState}
                        width={400}
                        height={420}
                        readOnly={false}
                      />
                    )}
                  </div>

                  {/* Canvas Controls */}
                  <div className="px-4 py-3 border-t border-white/[0.06] flex gap-2">
                    <button
                      onClick={handleAddChapter}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/15 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Chapter
                    </button>
                    <button
                      onClick={handleDeleteChapter}
                      disabled={canvasState.nodes.length <= 1}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/15 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Story Memory (below canvas) */}
                <StoryMemoryDisplay
                  memory={session.storyMemory}
                  panelCount={completedCount}
                />
              </div>
            </motion.div>

            {/* ── MIDDLE: Story Details + Parameters ── */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-4 space-y-5"
              data-tour="parameters"
            >
              {/* Story Details */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-sm text-white/90">Story Details</span>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <Label className="text-xs font-semibold text-white/60 mb-1.5 block">Title</Label>
                    <Input
                      placeholder="Your story title..."
                      value={storyPrompt.title}
                      onChange={(e) => setStoryPrompt({ ...storyPrompt, title: e.target.value })}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/25 rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-white/60 mb-1.5 block">Genre</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableGenres.map((g) => (
                        <button
                          key={g}
                          onClick={() => setSelectedGenre(g)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                            selectedGenre === g
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                              : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-white/60 mb-1.5 block">Description</Label>
                    <Textarea
                      placeholder="A brief overview of your story..."
                      value={storyDescription}
                      onChange={(e) => setStoryDescription(e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/25 rounded-lg resize-none h-16 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold text-white/60 mb-1.5 block">Characters</Label>
                      <Textarea
                        placeholder="Main characters..."
                        value={storyPrompt.mainCharacters}
                        onChange={(e) => setStoryPrompt({ ...storyPrompt, mainCharacters: e.target.value })}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/25 rounded-lg resize-none h-14 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-white/60 mb-1.5 block">Setting</Label>
                      <Textarea
                        placeholder="Where and when..."
                        value={storyPrompt.setting}
                        onChange={(e) => setStoryPrompt({ ...storyPrompt, setting: e.target.value })}
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/25 rounded-lg resize-none h-14 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* VedaScript Parameters */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-sm text-white/90">VedaScript Parameters</span>
                  </div>
                  <span className="text-xs text-white/30">{selectedParameters.size} active</span>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  <ParameterPanel
                    onParameterChange={handleParameterChange}
                    onParameterToggle={handleParameterToggle}
                    selectedParameters={Array.from(selectedParameters)}
                    defaultPreset="standard"
                    compact={true}
                    showStats={true}
                  />
                </div>
                {/* Sticky Parameter Footer */}
                <div className="px-5 py-3 border-t border-white/[0.06] flex gap-2 bg-black/40 backdrop-blur-md">
                  <button
                    onClick={() => {
                      setSelectedParameters(new Set());
                      setParameterValues({});
                    }}
                    className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-sm hover:text-white/80 hover:bg-white/10 transition-all"
                  >
                    Reset to defaults
                  </button>
                  <button
                    className="flex-1 py-2 rounded-lg bg-emerald-600/80 border border-emerald-500/30 text-white text-sm font-medium hover:bg-emerald-600 transition-all"
                    onClick={() => toast({ title: 'Settings applied', description: `${selectedParameters.size} parameters active` })}
                  >
                    Apply settings
                  </button>
                </div>
              </div>
            </motion.div>

            {/* ── RIGHT: Story Content Editor ── */}
            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-5 space-y-4"
            >
              <div className="sticky top-[72px]">
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl overflow-hidden">
                  {/* Editor Header with Tabs */}
                  <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditorTab('chapter')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          editorTab === 'chapter'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'text-white/50 hover:text-white/80'
                        }`}
                      >
                        Current Chapter
                      </button>
                      <button
                        onClick={() => setEditorTab('compiled')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          editorTab === 'compiled'
                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            : 'text-white/50 hover:text-white/80'
                        }`}
                      >
                        Compiled Story ({completedCount})
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/30">
                      <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{totalWordCount} words</span>
                      <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{totalChapters} ch</span>
                    </div>
                  </div>

                  {/* Editor Body */}
                  <div className="min-h-[440px]">
                    {editorTab === 'chapter' ? (
                      <div className="p-5">
                        <Textarea
                          placeholder="Start writing your chapter here, or hit 'Generate with VedaScript' to create AI content..."
                          value={currentChapterContent}
                          onChange={(e) => setCurrentChapterContent(e.target.value)}
                          className="w-full min-h-[360px] bg-transparent border-0 text-white/90 placeholder:text-white/20 resize-none focus:ring-0 focus-visible:ring-0 text-sm leading-relaxed p-0"
                        />
                      </div>
                    ) : (
                      <div className="p-5">
                        {compiledStory ? (
                          <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-white/80 leading-relaxed">
                            {compiledStory}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-[360px] text-white/30">
                            <AlignLeft className="w-10 h-10 mb-3 opacity-20" />
                            <p className="text-sm">No compiled content yet.</p>
                            <p className="text-xs mt-1">Generate chapters to see your full story here.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Editor Footer: Generate Button + Actions */}
                  <div className="px-5 py-4 border-t border-white/[0.06] space-y-3">
                    {/* Generation Error */}
                    <AnimatePresence>
                      {generationError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                        >
                          {generationError}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Primary Generate Button */}
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleGeneratePanel}
                      disabled={isGenerating}
                      className={`
                        w-full py-3 rounded-xl font-bold text-sm
                        bg-gradient-to-r from-emerald-600 to-emerald-700
                        hover:from-emerald-500 hover:to-emerald-600
                        text-white shadow-lg shadow-emerald-500/15
                        border border-emerald-400/15
                        flex items-center justify-center gap-2
                        transition-all duration-300
                        disabled:opacity-40 disabled:cursor-not-allowed
                        active:shadow-inner
                      `}
                    >
                      {isGenerating ? (
                        <>
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                            <Zap className="w-4 h-4" />
                          </motion.div>
                          Generating with VedaScript…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate with VedaScript
                        </>
                      )}
                    </motion.button>

                    {/* Secondary Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyStory}
                        disabled={completedCount === 0 && !currentChapterContent}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white/50 text-sm hover:text-white/80 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400/60 text-sm hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                {/* Panel Progress */}
                <div className="mt-4">
                  <PanelProgressTracker
                    completedPanels={completedCount}
                    currentPanel={effectiveCurrentPanel}
                    panelStatuses={panelStatuses}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Helper ────────────────────────────────────────────────────────
function createEmptySession(): StorySession {
  return {
    sessionId: typeof crypto !== 'undefined' ? crypto.randomUUID() : `s-${Date.now()}`,
    title: '',
    panels: [],
    genres: [],
    genresLocked: false,
    storyMemory: {
      characters: [],
      worldBuilding: {
        setting: '',
        timePeriod: '',
        rules: [],
        locations: [],
        cultures: [],
      },
      majorEvents: [],
      unresolvedQuestions: [],
      establishedFacts: [],
      themes: [],
      tone: '',
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      totalWordCount: 0,
      estimatedReadingTime: 0,
    },
    status: 'draft',
  };
}
