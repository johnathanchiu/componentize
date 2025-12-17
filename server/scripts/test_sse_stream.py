#!/usr/bin/env python3
"""
Debug script to test SSE streaming from the component generation endpoint.
This helps verify that:
1. Events are emitted in the correct order
2. canvas_update events are sent for each component
3. No duplicate events are being emitted
4. Timing between events is reasonable

Usage:
  python test_sse_stream.py <project_id> "<prompt>"

Example:
  python test_sse_stream.py abc123 "create 3 pricing cards"
"""

import sys
import json
import time
import httpx
import asyncio
from collections import defaultdict
from datetime import datetime

API_BASE = "http://localhost:5001/api"

# ANSI colors for output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def color_by_type(event_type: str) -> str:
    """Return color based on event type."""
    colors = {
        'progress': Colors.BLUE,
        'thinking': Colors.CYAN,
        'tool_start': Colors.YELLOW,
        'tool_result': Colors.GREEN,
        'code_streaming': Colors.BLUE,
        'code_complete': Colors.GREEN,
        'canvas_update': Colors.GREEN + Colors.BOLD,
        'success': Colors.GREEN + Colors.BOLD,
        'error': Colors.RED,
    }
    return colors.get(event_type, '')

async def test_generation(project_id: str, prompt: str):
    """Test the generation endpoint and log all SSE events."""

    url = f"{API_BASE}/projects/{project_id}/generate-stream"

    print(f"\n{Colors.HEADER}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}Testing SSE Stream{Colors.ENDC}")
    print(f"{Colors.HEADER}{'='*60}{Colors.ENDC}")
    print(f"Project ID: {project_id}")
    print(f"Prompt: {prompt}")
    print(f"URL: {url}")
    print(f"{Colors.HEADER}{'='*60}{Colors.ENDC}\n")

    # Track events for summary
    event_counts = defaultdict(int)
    canvas_updates = []
    code_completes = []
    errors = []
    start_time = time.time()
    last_event_time = start_time

    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream(
                'POST',
                url,
                json={'prompt': prompt},
                headers={'Content-Type': 'application/json'}
            ) as response:

                if response.status_code != 200:
                    print(f"{Colors.RED}Error: HTTP {response.status_code}{Colors.ENDC}")
                    return

                event_num = 0
                async for line in response.aiter_lines():
                    if not line.startswith('data: '):
                        continue

                    try:
                        event = json.loads(line[6:])
                    except json.JSONDecodeError as e:
                        print(f"{Colors.RED}JSON parse error: {e}{Colors.ENDC}")
                        print(f"  Raw line: {line[:100]}...")
                        continue

                    event_num += 1
                    event_type = event.get('type', 'unknown')
                    message = event.get('message', '')
                    data = event.get('data', {})

                    # Track timing
                    now = time.time()
                    delta = now - last_event_time
                    elapsed = now - start_time
                    last_event_time = now

                    # Count events
                    event_counts[event_type] += 1

                    # Track specific events
                    if event_type == 'canvas_update':
                        comp = data.get('canvasComponent', {})
                        canvas_updates.append(comp.get('componentName', 'unknown'))
                    elif event_type == 'code_complete':
                        code_completes.append(data.get('componentName', 'unknown'))
                    elif event_type == 'error':
                        errors.append(message)

                    # Print event
                    color = color_by_type(event_type)
                    time_str = f"[{elapsed:6.2f}s +{delta:5.2f}s]"
                    type_str = f"[{event_type:15}]"

                    print(f"{Colors.BLUE}{time_str}{Colors.ENDC} {color}{type_str}{Colors.ENDC} {message[:80]}")

                    # Print extra details for important events
                    if event_type == 'canvas_update':
                        comp = data.get('canvasComponent', {})
                        print(f"           {Colors.GREEN}└── Component: {comp.get('componentName')}{Colors.ENDC}")
                        print(f"           {Colors.GREEN}    Position: ({comp.get('position', {}).get('x')}, {comp.get('position', {}).get('y')}){Colors.ENDC}")
                    elif event_type == 'code_complete':
                        print(f"           {Colors.GREEN}└── Component: {data.get('componentName')} ({data.get('lineCount')} lines){Colors.ENDC}")
                    elif event_type == 'tool_start':
                        print(f"           {Colors.YELLOW}└── Tool: {data.get('toolName')}{Colors.ENDC}")
                    elif event_type == 'tool_result':
                        status = data.get('status', 'unknown')
                        status_color = Colors.GREEN if status == 'success' else Colors.RED
                        print(f"           {status_color}└── Status: {status}{Colors.ENDC}")

    except httpx.ConnectError:
        print(f"{Colors.RED}Error: Could not connect to {API_BASE}{Colors.ENDC}")
        print("Make sure the server is running on port 3001")
        return
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.ENDC}")
        return

    # Print summary
    total_time = time.time() - start_time
    print(f"\n{Colors.HEADER}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}Summary{Colors.ENDC}")
    print(f"{Colors.HEADER}{'='*60}{Colors.ENDC}")
    print(f"Total time: {total_time:.2f}s")
    print(f"Total events: {sum(event_counts.values())}")
    print(f"\nEvent counts:")
    for event_type, count in sorted(event_counts.items()):
        print(f"  {event_type}: {count}")

    print(f"\n{Colors.GREEN}code_complete events:{Colors.ENDC}")
    for name in code_completes:
        print(f"  - {name}")

    print(f"\n{Colors.GREEN}canvas_update events:{Colors.ENDC}")
    for name in canvas_updates:
        print(f"  - {name}")

    if errors:
        print(f"\n{Colors.RED}Errors:{Colors.ENDC}")
        for err in errors:
            print(f"  - {err}")

    # Validation checks
    print(f"\n{Colors.HEADER}Validation{Colors.ENDC}")

    # Check: Each code_complete should have a canvas_update
    if set(code_completes) == set(canvas_updates):
        print(f"{Colors.GREEN}✓ All code_complete events have matching canvas_update{Colors.ENDC}")
    else:
        print(f"{Colors.RED}✗ Mismatch between code_complete and canvas_update{Colors.ENDC}")
        print(f"  code_complete: {code_completes}")
        print(f"  canvas_update: {canvas_updates}")

    # Check: No duplicate canvas_updates
    if len(canvas_updates) == len(set(canvas_updates)):
        print(f"{Colors.GREEN}✓ No duplicate canvas_update events{Colors.ENDC}")
    else:
        print(f"{Colors.RED}✗ Duplicate canvas_update events detected{Colors.ENDC}")
        from collections import Counter
        dupes = [k for k, v in Counter(canvas_updates).items() if v > 1]
        print(f"  Duplicates: {dupes}")

    # Check: No duplicate code_complete
    if len(code_completes) == len(set(code_completes)):
        print(f"{Colors.GREEN}✓ No duplicate code_complete events{Colors.ENDC}")
    else:
        print(f"{Colors.RED}✗ Duplicate code_complete events detected{Colors.ENDC}")
        from collections import Counter
        dupes = [k for k, v in Counter(code_completes).items() if v > 1]
        print(f"  Duplicates: {dupes}")


async def list_projects():
    """List available projects."""
    print(f"\n{Colors.HEADER}Available Projects:{Colors.ENDC}")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{API_BASE}/projects")
            if response.status_code == 200:
                data = response.json()
                for project in data.get('projects', []):
                    print(f"  - {project['id']}: {project['name']}")
            else:
                print(f"Error: HTTP {response.status_code}")
    except Exception as e:
        print(f"Error: {e}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        asyncio.run(list_projects())
        return

    if len(sys.argv) < 3:
        print("Error: Missing prompt argument")
        print(__doc__)
        return

    project_id = sys.argv[1]
    prompt = sys.argv[2]

    asyncio.run(test_generation(project_id, prompt))


if __name__ == '__main__':
    main()
