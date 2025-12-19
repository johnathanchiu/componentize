/**
 * Agent Benchmark Script
 *
 * Runs live generation requests against the Claude API to measure:
 * - Time to complete
 * - Iterations used
 * - Success rate
 * - Streaming event verification
 *
 * Usage: npx tsx scripts/benchmark.ts
 */

import 'dotenv/config';
import { componentAgent } from '../src/agents';
import { projectService } from '../src/services/projectService';
import type { StreamEvent } from '../../shared/types';

// Test prompts at different complexity levels
const BENCHMARK_PROMPTS = [
  // Simple - single atomic component
  { name: 'simple-button', prompt: 'Create a blue button', expectedComponents: 1 },
  { name: 'simple-card', prompt: 'Create a simple card component', expectedComponents: 1 },

  // Medium - single component with more detail
  { name: 'medium-pricing', prompt: 'Create a pricing card with title, price, and 3 features', expectedComponents: 1 },

  // Complex - multi-component (may trigger plan_components)
  { name: 'complex-3cards', prompt: 'Create 3 different pricing tiers: Basic, Pro, Enterprise', expectedComponents: 3 },
];

interface EventCounts {
  progress: number;
  thinking: number;
  tool_start: number;
  tool_result: number;
  code_streaming: number;
  code_complete: number;
  canvas_update: number;
  todo_update: number;
  success: number;
  error: number;
  tool_error: number;
}

interface BenchmarkResult {
  name: string;
  prompt: string;
  status: 'SUCCESS' | 'FAILURE' | 'ERROR';
  timeMs: number;
  iterations: number;
  componentsCreated: number;
  expectedComponents: number;
  eventCounts: EventCounts;
  errorMessage?: string;
}

function createEventCounts(): EventCounts {
  return {
    progress: 0,
    thinking: 0,
    tool_start: 0,
    tool_result: 0,
    code_streaming: 0,
    code_complete: 0,
    canvas_update: 0,
    todo_update: 0,
    success: 0,
    error: 0,
    tool_error: 0,
  };
}

async function runBenchmark(
  projectId: string,
  name: string,
  prompt: string,
  expectedComponents: number
): Promise<BenchmarkResult> {
  const startTime = Date.now();
  const eventCounts = createEventCounts();
  let iterations = 0;
  let componentsCreated = 0;
  let status: 'SUCCESS' | 'FAILURE' | 'ERROR' = 'FAILURE';
  let errorMessage: string | undefined;

  // Set project context
  componentAgent.setProjectContext(projectId);

  try {
    // Stream through all events
    for await (const event of componentAgent.generate(prompt)) {
      // Count event types
      const eventType = event.type as keyof EventCounts;
      if (eventType in eventCounts) {
        eventCounts[eventType]++;
      }

      // Track iterations from progress events
      if (event.type === 'progress' && event.data?.iteration) {
        iterations = Math.max(iterations, event.data.iteration as number);
      }

      // Count canvas updates (component creations)
      if (event.type === 'canvas_update') {
        componentsCreated++;
      }

      // Check for success
      if (event.type === 'success') {
        status = 'SUCCESS';
      }

      // Check for errors
      if (event.type === 'error') {
        status = 'ERROR';
        errorMessage = event.message;
      }

      // Log events in real-time for visibility
      if (event.type === 'tool_start') {
        console.log(`    → ${event.data?.toolName}`);
      } else if (event.type === 'canvas_update') {
        console.log(`    ✓ Created: ${event.data?.canvasComponent?.componentName}`);
      } else if (event.type === 'error' || event.type === 'tool_error') {
        console.log(`    ✗ Error: ${event.message}`);
      }
    }
  } catch (err) {
    status = 'ERROR';
    errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.log(`    ✗ Exception: ${errorMessage}`);
  } finally {
    componentAgent.clearProjectContext();
  }

  const timeMs = Date.now() - startTime;

  // Check if we got expected number of components
  if (status === 'SUCCESS' && componentsCreated < expectedComponents) {
    status = 'FAILURE';
    errorMessage = `Expected ${expectedComponents} components, got ${componentsCreated}`;
  }

  return {
    name,
    prompt,
    status,
    timeMs,
    iterations,
    componentsCreated,
    expectedComponents,
    eventCounts,
    errorMessage,
  };
}

function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatEventCounts(counts: EventCounts): string {
  const lines: string[] = [];
  const eventOrder: (keyof EventCounts)[] = [
    'progress', 'thinking', 'tool_start', 'code_streaming',
    'code_complete', 'tool_result', 'canvas_update', 'success', 'error'
  ];

  for (const key of eventOrder) {
    const count = counts[key];
    if (count > 0) {
      const check = key === 'error' ? '✗' : '✓';
      lines.push(`       ${key}: ${count} ${check}`);
    }
  }

  return lines.join('\n');
}

function printResult(result: BenchmarkResult, index: number, total: number): void {
  const statusIcon = result.status === 'SUCCESS' ? '✓' : '✗';
  const statusColor = result.status === 'SUCCESS' ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';

  console.log(`\n[${index}/${total}] "${result.prompt}"`);
  console.log(`  ├─ Status: ${statusColor}${result.status}${reset} ${statusIcon}`);
  console.log(`  ├─ Time: ${formatTime(result.timeMs)}`);
  console.log(`  ├─ Iterations: ${result.iterations}`);
  console.log(`  ├─ Components: ${result.componentsCreated}/${result.expectedComponents}`);

  if (result.errorMessage) {
    console.log(`  ├─ Error: ${result.errorMessage}`);
  }

  console.log(`  └─ Streaming events:`);
  console.log(formatEventCounts(result.eventCounts));
}

function printSummary(results: BenchmarkResult[]): void {
  const total = results.length;
  const successes = results.filter(r => r.status === 'SUCCESS').length;
  const failures = results.filter(r => r.status === 'FAILURE').length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  const simpleResults = results.filter(r => r.expectedComponents === 1);
  const complexResults = results.filter(r => r.expectedComponents > 1);

  const avgSimpleTime = simpleResults.length > 0
    ? simpleResults.reduce((sum, r) => sum + r.timeMs, 0) / simpleResults.length
    : 0;
  const avgComplexTime = complexResults.length > 0
    ? complexResults.reduce((sum, r) => sum + r.timeMs, 0) / complexResults.length
    : 0;

  // Check streaming health (thinking is optional - Claude may skip reasoning with tool_choice)
  const allHaveToolStart = results.every(r => r.eventCounts.tool_start > 0);
  const allHaveToolResult = results.every(r => r.eventCounts.tool_result > 0);
  const allHaveCanvasUpdate = results.every(r => r.eventCounts.canvas_update > 0);
  const streamingHealthy = allHaveToolStart && allHaveToolResult && allHaveCanvasUpdate;
  const anyHaveThinking = results.some(r => r.eventCounts.thinking > 0);

  console.log('\n' + '='.repeat(50));
  console.log('=== Summary ===');
  console.log('='.repeat(50));
  console.log(`Total runs: ${total}`);
  console.log(`Success: ${successes} | Failure: ${failures} | Error: ${errors}`);
  console.log(`Success rate: ${((successes / total) * 100).toFixed(0)}%`);

  if (simpleResults.length > 0) {
    console.log(`Avg time (simple): ${formatTime(avgSimpleTime)}`);
  }
  if (complexResults.length > 0) {
    console.log(`Avg time (complex): ${formatTime(avgComplexTime)}`);
  }

  const streamIcon = streamingHealthy ? '✓' : '✗';
  const streamColor = streamingHealthy ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(`Streaming: ${streamColor}${streamingHealthy ? 'Core events verified' : 'Missing events'} ${streamIcon}${reset}`);

  if (!streamingHealthy) {
    if (!allHaveToolStart) console.log('  - Missing: tool_start events');
    if (!allHaveToolResult) console.log('  - Missing: tool_result events');
    if (!allHaveCanvasUpdate) console.log('  - Missing: canvas_update events');
  }

  // Report on optional thinking events
  if (anyHaveThinking) {
    console.log(`Thinking events: Present in some runs`);
  } else {
    console.log(`Thinking events: None (Claude went straight to tools)`);
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('=== Agent Benchmark ===');
  console.log('='.repeat(50));
  console.log(`Running ${BENCHMARK_PROMPTS.length} benchmark prompts...`);

  // Create a test project for benchmarks
  const testProject = await projectService.createProject(`benchmark-${Date.now()}`);
  console.log(`Created test project: ${testProject.id}`);

  const results: BenchmarkResult[] = [];

  for (let i = 0; i < BENCHMARK_PROMPTS.length; i++) {
    const { name, prompt, expectedComponents } = BENCHMARK_PROMPTS[i];
    console.log(`\n--- Running: ${name} ---`);

    const result = await runBenchmark(testProject.id, name, prompt, expectedComponents);
    results.push(result);
    printResult(result, i + 1, BENCHMARK_PROMPTS.length);
  }

  printSummary(results);

  // Cleanup: delete test project
  try {
    await projectService.deleteProject(testProject.id);
    console.log(`\nCleaned up test project: ${testProject.id}`);
  } catch (err) {
    console.log(`\nFailed to clean up project: ${err}`);
  }
}

main().catch(console.error);
