import { transform } from 'sucrase';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSharedState } from './sharedStore';
import { Stack, Flex, Grid as LayoutGrid, Container } from './layoutPrimitives';

// Import all shadcn components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

// Import lucide-react icons (commonly used ones)
import {
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit,
  ExternalLink,
  Eye,
  EyeOff,
  File,
  Filter,
  Heart,
  Home,
  Image,
  Info,
  Link,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Minus,
  Moon,
  MoreHorizontal,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share,
  ShoppingCart,
  Sparkles,
  Star,
  Sun,
  Trash,
  Trash2,
  Upload,
  User,
  Users,
  X,
  Zap,
  AlertCircle,
  AlertTriangle,
  Bell,
  Bookmark,
  Calendar,
  Camera,
  CreditCard,
  Database,
  Folder,
  Gift,
  Globe,
  Grid,
  HelpCircle,
  Inbox,
  Layers,
  Layout,
  List,
  MapPin,
  Maximize,
  Minimize,
  Monitor,
  Package,
  Pause,
  Play,
  Power,
  Printer,
  Radio,
  Save,
  Shield,
  Smartphone,
  Speaker,
  Tag,
  Target,
  Terminal,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  TrendingDown,
  Truck,
  Tv,
  Type,
  Umbrella,
  Underline,
  Unlock,
  Video,
  Wifi,
  Wind,
  Award,
  BarChart,
  Briefcase,
  Building,
  Code,
  Coffee,
  Compass,
  Cpu,
  DollarSign,
  Feather,
  Flag,
  Headphones,
  Key,
  Lightbulb,
  Mic,
  Music,
  PenTool,
  Percent,
  PieChart,
  Rocket,
  Scissors,
  Server,
  Sliders,
  Smile,
  Snowflake,
  Timer,
  ToggleLeft,
  ToggleRight,
  Trophy,
  Wrench,
  Quote,
  // Social/brand icons
  Github,
  Twitter,
  Linkedin,
  Facebook,
  Instagram,
  Youtube,
} from 'lucide-react';

// The scope of dependencies available to components
const COMPONENT_SCOPE: Record<string, unknown> = {
  // React core
  React,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,

  // Shared state (inter-component communication)
  useSharedState,

  // shadcn/ui components
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Separator,
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,

  // Lucide icons
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit,
  ExternalLink,
  Eye,
  EyeOff,
  File,
  Filter,
  Heart,
  Home,
  Image,
  Info,
  Link,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Minus,
  Moon,
  MoreHorizontal,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share,
  ShoppingCart,
  Sparkles,
  Star,
  Sun,
  Trash,
  Trash2,
  Upload,
  User,
  Users,
  X,
  Zap,
  AlertCircle,
  AlertTriangle,
  Bell,
  Bookmark,
  Calendar,
  Camera,
  CreditCard,
  Database,
  Folder,
  Gift,
  Globe,
  Grid,
  HelpCircle,
  Inbox,
  Layers,
  Layout,
  List,
  MapPin,
  Maximize,
  Minimize,
  Monitor,
  Package,
  Pause,
  Play,
  Power,
  Printer,
  Radio,
  Save,
  Shield,
  Smartphone,
  Speaker,
  Tag,
  Target,
  Terminal,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  TrendingDown,
  Truck,
  Tv,
  Type,
  Umbrella,
  Underline,
  Unlock,
  Video,
  Wifi,
  Wind,
  Award,
  BarChart,
  Briefcase,
  Building,
  Code,
  Coffee,
  Compass,
  Cpu,
  DollarSign,
  Feather,
  Flag,
  Headphones,
  Key,
  Lightbulb,
  Mic,
  Music,
  PenTool,
  Percent,
  PieChart,
  Rocket,
  Scissors,
  Server,
  Sliders,
  Smile,
  Snowflake,
  Timer,
  ToggleLeft,
  ToggleRight,
  Trophy,
  Wrench,
  Quote,
  // Social/brand icons
  Github,
  Twitter,
  Linkedin,
  Facebook,
  Instagram,
  Youtube,

  // Layout primitives (LayoutGrid to avoid conflict with lucide Grid icon)
  Stack,
  Flex,
  LayoutGrid,
  Container,
};

/**
 * Extract the default export component name from code
 */
function extractDefaultExportName(code: string): string | null {
  // Match: export default function ComponentName
  const funcMatch = code.match(/export\s+default\s+function\s+(\w+)/);
  if (funcMatch) return funcMatch[1];

  // Match: export default ComponentName (at end or followed by statement)
  const directMatch = code.match(/export\s+default\s+(\w+)\s*(?:;|$)/m);
  if (directMatch) return directMatch[1];

  return null;
}

/**
 * Prepare source code for execution:
 * - Strip import statements
 * - Convert export default to regular declarations
 */
function prepareSource(code: string): string {
  return code
    // Remove import statements (single and multi-line)
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '')
    // Convert "export default function X" to "function X"
    .replace(/export\s+default\s+function\s+/g, 'function ')
    // Convert "export default class X" to "class X"
    .replace(/export\s+default\s+class\s+/g, 'class ')
    // Remove standalone "export default X;" or "export default X"
    .replace(/^export\s+default\s+\w+\s*;?\s*$/gm, '')
    // Remove "export " from named exports
    .replace(/^export\s+(?=const|let|var|function|class)/gm, '')
    .trim();
}

/**
 * Load and compile a component from source code
 */
export function compileComponent(
  source: string,
  componentName?: string
): React.ComponentType {
  // Find the component name before transformations
  const exportName = componentName || extractDefaultExportName(source) || 'Component';

  // Prepare source: strip imports and exports BEFORE compiling
  const prepared = prepareSource(source);

  // Compile JSX/TypeScript to JavaScript
  const compiled = transform(prepared, {
    transforms: ['jsx', 'typescript'],
    jsxRuntime: 'classic',
    jsxPragma: 'React.createElement',
    jsxFragmentPragma: 'React.Fragment',
  }).code;

  // Create function that returns the component
  // The function receives all scope variables as arguments
  const scopeKeys = Object.keys(COMPONENT_SCOPE);
  const scopeValues = Object.values(COMPONENT_SCOPE);

  try {
    const fn = new Function(
      ...scopeKeys,
      `${compiled}; return typeof ${exportName} !== 'undefined' ? ${exportName} : null;`
    );

    const Component = fn(...scopeValues);

    if (!Component) {
      throw new Error(`Component "${exportName}" not found in source`);
    }

    return Component;
  } catch (error) {
    console.error('Component compilation error:', error);
    console.error('Compiled code:', compiled);
    throw error;
  }
}

/**
 * Fetch and load a component from the API
 */
export async function loadComponent(
  projectId: string,
  componentName: string
): Promise<React.ComponentType> {
  const res = await fetch(`/api/projects/${projectId}/components/${componentName}`);

  if (!res.ok) {
    throw new Error(`Failed to load component: ${res.statusText}`);
  }

  const source = await res.text();
  return compileComponent(source, componentName);
}

/**
 * Get the list of available scope keys (for debugging/documentation)
 */
export function getAvailableScope(): string[] {
  return Object.keys(COMPONENT_SCOPE);
}
