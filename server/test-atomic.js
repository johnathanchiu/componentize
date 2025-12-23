const http = require('http');

const PROJECT_ID = 'bf6930f8-57d1-4a75-9ba2-f46f1eb112c8';
const prompt = 'Create a simple hero section with a headline and two buttons side by side';

// Step 1: Start generation
const postData = JSON.stringify({ prompt });

const startOptions = {
  hostname: 'localhost',
  port: 5001,
  path: `/api/projects/${PROJECT_ID}/generate`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Starting generation...');

const startReq = http.request(startOptions, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`Start response (${res.statusCode}):`, body);

    if (res.statusCode === 200 || res.statusCode === 202) {
      // Step 2: Connect to stream
      console.log('\nConnecting to stream...');

      const streamOptions = {
        hostname: 'localhost',
        port: 5001,
        path: `/api/projects/${PROJECT_ID}/stream`,
        method: 'GET'
      };

      const streamReq = http.request(streamOptions, (streamRes) => {
        console.log(`Stream status: ${streamRes.statusCode}\n`);

        streamRes.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'todo_update') {
                  console.log('📋 TODOS:', data.todos?.map(t => `[${t.status}] ${t.content}`).join(' | '));
                } else if (data.type === 'canvas_update') {
                  const comp = data.component;
                  console.log(`🎨 COMPONENT: ${comp?.componentName} at (${comp?.position?.x}, ${comp?.position?.y}) size ${comp?.size?.width}x${comp?.size?.height}`);
                } else if (data.type === 'tool_result') {
                  console.log('🔧 RESULT:', data.result?.message?.slice(0, 120));
                } else if (data.type === 'done') {
                  console.log('\n✅ GENERATION COMPLETE');
                }
              } catch (e) {
                // ignore parse errors
              }
            }
          }
        });

        streamRes.on('end', () => {
          console.log('\nStream ended. Checking results...');
          checkResults();
        });
      });

      streamReq.on('error', (e) => console.error('Stream error:', e.message));
      streamReq.end();
    }
  });
});

startReq.on('error', (e) => console.error('Start error:', e.message));
startReq.write(postData);
startReq.end();

function checkResults() {
  const fs = require('fs');
  const path = `/Users/johnathanchiu/Projects/componentize/server/.workspace/projects/${PROJECT_ID}`;

  console.log('\n=== RESULTS ===');

  // List files
  const files = fs.readdirSync(path).filter(f => f.endsWith('.tsx'));
  console.log(`\nComponents created: ${files.length}`);
  files.forEach(f => console.log(`  - ${f}`));

  // Show canvas
  const canvas = JSON.parse(fs.readFileSync(`${path}/canvas.json`));
  console.log(`\nCanvas entries: ${canvas.length}`);
  canvas.forEach(c => {
    console.log(`  - ${c.componentName} at (${c.position.x}, ${c.position.y}) size ${c.size?.width}x${c.size?.height}`);
  });

  // Check if buttons are side-by-side (same y)
  const buttons = canvas.filter(c => c.componentName.toLowerCase().includes('button'));
  if (buttons.length >= 2) {
    const sameY = buttons[0].position.y === buttons[1].position.y;
    console.log(`\n${sameY ? '✅' : '❌'} Buttons side-by-side: ${sameY ? 'YES' : 'NO'} (y values: ${buttons.map(b => b.position.y).join(', ')})`);
  }

  // Show line counts
  console.log('\nComponent sizes:');
  files.forEach(f => {
    const content = fs.readFileSync(`${path}/${f}`, 'utf8');
    const lines = content.split('\n').length;
    console.log(`  - ${f}: ${lines} lines ${lines <= 25 ? '✅' : '❌ TOO LARGE'}`);
  });

  process.exit(0);
}

// Timeout
setTimeout(() => {
  console.log('\nTimeout - forcing results check...');
  checkResults();
}, 120000);
