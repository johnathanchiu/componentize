import archiver from 'archiver';
import { Readable } from 'stream';
import { fileService } from './fileService';
import type { PageLayout, ExportFile } from '../../../shared/types';
import { PACKAGE_JSON_TEMPLATE } from '../../../shared/constants';

export class ExportService {
  /**
   * Generate page code from layout
   */
  private generatePageCode(pageName: string, layout: PageLayout): string {
    const { components } = layout;

    // Get unique component names
    const componentNames = [...new Set(components.map(c => c.componentName))];

    // Generate imports
    const imports = componentNames
      .map(name => `import ${name} from '../components/${name}';`)
      .join('\n');

    // Generate component instances with positioning
    const componentInstances = components.map((comp, index) => {
      const { componentName, position, size, interactions } = comp;

      const style = [
        `left: ${position.x}px`,
        `top: ${position.y}px`,
        size ? `width: ${size.width}px` : null,
        size ? `height: ${size.height}px` : null
      ].filter(Boolean).join(', ');

      // Generate event handlers if interactions exist
      const handlers = interactions && interactions.length > 0
        ? interactions.map(i => `${i.type}={${i.handlerName}}`).join(' ')
        : '';

      return `        <div key="${index}" className="absolute" style={{ ${style} }}>
          <${componentName}${handlers ? ` ${handlers}` : ''} />
        </div>`;
    }).join('\n');

    // Generate state and handlers from interactions
    const allInteractions = components.flatMap(c => c.interactions || []);
    const stateDeclarations = allInteractions
      .flatMap(i => i.state || [])
      .map(s => `  const [${s.name}, set${s.name.charAt(0).toUpperCase() + s.name.slice(1)}] = useState<${s.type}>(${JSON.stringify(s.initialValue)});`)
      .join('\n');

    const handlerFunctions = allInteractions
      .map(i => `  ${i.code}`)
      .join('\n\n');

    // Generate final page code
    return `import { useState } from 'react';
${imports}

export default function ${pageName}() {
${stateDeclarations ? stateDeclarations + '\n' : ''}
${handlerFunctions ? handlerFunctions + '\n' : ''}
  return (
    <div className="relative w-full min-h-screen bg-gray-50">
${componentInstances}
    </div>
  );
}
`;
  }

  /**
   * Generate README.md content
   */
  private generateReadme(pageName: string): string {
    return `# ${pageName}

This is an exported page from Componentize.

## Setup

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Run development server:
\`\`\`bash
npm run dev
\`\`\`

## Structure

- \`/components\` - Individual React components
- \`/pages\` - Page layouts
- \`package.json\` - Project dependencies
- \`tsconfig.json\` - TypeScript configuration
- \`tailwind.config.js\` - Tailwind CSS configuration
- \`vite.config.ts\` - Vite configuration

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS v4
- Vite

---

Generated with ❤️ by [Componentize](https://github.com/yourrepo/componentize)
`;
  }

  /**
   * Generate tsconfig.json
   */
  private generateTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true
      },
      include: ['**/*.ts', '**/*.tsx'],
      references: [{ path: './tsconfig.node.json' }]
    }, null, 2);
  }

  /**
   * Generate Vite config
   */
  private generateViteConfig(): string {
    return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`;
  }

  /**
   * Generate Tailwind config
   */
  private generateTailwindConfig(): string {
    return `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;
  }

  /**
   * Export page with all dependencies as ZIP
   */
  async exportPageAsZip(pageName: string, layout: PageLayout): Promise<Readable> {
    // Generate page code
    const pageCode = this.generatePageCode(pageName, layout);

    // Get all component files
    const componentNames = [...new Set(layout.components.map(c => c.componentName))];
    const componentFiles: ExportFile[] = [];

    for (const name of componentNames) {
      const result = await fileService.readComponent(name);
      if (result.status === 'success' && result.content) {
        componentFiles.push({
          path: `components/${name}.tsx`,
          content: result.content
        });
      }
    }

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Add files to archive
    archive.append(pageCode, { name: `pages/${pageName}.tsx` });

    componentFiles.forEach(file => {
      archive.append(file.content, { name: file.path });
    });

    // Add configuration files
    archive.append(JSON.stringify(PACKAGE_JSON_TEMPLATE, null, 2), { name: 'package.json' });
    archive.append(this.generateReadme(pageName), { name: 'README.md' });
    archive.append(this.generateTsConfig(), { name: 'tsconfig.json' });
    archive.append(this.generateViteConfig(), { name: 'vite.config.ts' });
    archive.append(this.generateTailwindConfig(), { name: 'tailwind.config.js' });

    // Add index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${pageName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
    archive.append(indexHtml, { name: 'index.html' });

    // Add main.tsx entry point
    const mainTsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import ${pageName} from './pages/${pageName}'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <${pageName} />
  </React.StrictMode>,
)
`;
    archive.append(mainTsx, { name: 'src/main.tsx' });

    // Add index.css with Tailwind directives
    const indexCss = `@import "tailwindcss";`;
    archive.append(indexCss, { name: 'src/index.css' });

    // Finalize archive
    archive.finalize();

    return archive;
  }
}

// Export singleton instance
export const exportService = new ExportService();
