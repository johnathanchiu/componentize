// Layout DSL Types

export interface PageStyle {
  background: string;
  width: number;
}

export interface ComponentDef {
  name: string;
  section: string;
  sectionLayout?: 'row' | 'column';
  size?: { width: number; height: number };
  gap?: number;
  layer?: string;
}

export interface Section {
  name: string;
  layout: 'row' | 'column';
  components: Array<{ name: string; size: { width: number; height: number }; gap: number }>;
}

export interface Layer {
  name: string;
  type: 'modal' | 'drawer' | 'tooltip';
  components: string[];
}

export interface LayoutDef {
  pageStyle: PageStyle;
  sections: Section[];
  layers: Layer[];
}

// Calculate positions from layout definition
export function calculatePositions(layout: LayoutDef): Map<string, { x: number; y: number; width: number; height: number }> {
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>();
  const pageWidth = layout.pageStyle.width;
  let currentY = 0;
  const sectionGap = 60;

  for (const section of layout.sections) {
    if (section.layout === 'column') {
      // Column: stack vertically, each centered
      for (const comp of section.components) {
        const x = (pageWidth - comp.size.width) / 2;
        positions.set(comp.name, { x, y: currentY, ...comp.size });
        currentY += comp.size.height + comp.gap;
      }
    } else {
      // Row: side-by-side, row centered
      const totalWidth = section.components.reduce((sum, c, i) =>
        sum + c.size.width + (i > 0 ? c.gap : 0), 0);
      let x = (pageWidth - totalWidth) / 2;
      const rowHeight = Math.max(...section.components.map(c => c.size.height));

      for (const comp of section.components) {
        positions.set(comp.name, { x, y: currentY, ...comp.size });
        x += comp.size.width + comp.gap;
      }
      currentY += rowHeight;
    }
    currentY += sectionGap;
  }

  return positions;
}
