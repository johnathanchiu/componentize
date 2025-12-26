import type { LayoutDef } from '../layout-types';

// Analytics Dashboard Layout
export const dashboardLayout: LayoutDef = {
  pageStyle: {
    background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
    width: 1200,
  },
  sections: [
    {
      name: "header",
      layout: "column",
      components: [
        { name: "DashboardHeader", size: { width: 1200, height: 64 }, gap: 0 },
      ],
    },
    {
      name: "stats",
      layout: "row",
      components: [
        { name: "StatCardRevenue", size: { width: 270, height: 140 }, gap: 30 },
        { name: "StatCardUsers", size: { width: 270, height: 140 }, gap: 20 },
        { name: "StatCardOrders", size: { width: 270, height: 140 }, gap: 20 },
        { name: "StatCardGrowth", size: { width: 270, height: 140 }, gap: 20 },
      ],
    },
    {
      name: "charts",
      layout: "row",
      components: [
        { name: "ChartPlaceholder", size: { width: 720, height: 280 }, gap: 30 },
        { name: "ActivityFeed", size: { width: 400, height: 280 }, gap: 20 },
      ],
    },
  ],
  layers: [],
};
