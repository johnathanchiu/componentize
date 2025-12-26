import type { LayoutDef } from '../layout-types';

// Full landing page layout matching test-landing-page project
export const layoutDef: LayoutDef = {
  pageStyle: {
    background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
    width: 1200,
  },
  sections: [
    {
      name: "nav",
      layout: "row",
      components: [
        { name: "Logo", size: { width: 120, height: 40 }, gap: 0 },
        { name: "NavLinks", size: { width: 300, height: 40 }, gap: 330 },
        { name: "SignupBtn", size: { width: 120, height: 40 }, gap: 330 },
      ],
    },
    {
      name: "hero",
      layout: "column",
      components: [
        { name: "HeroHeadline", size: { width: 800, height: 180 }, gap: 60 },
        { name: "HeroSubtext", size: { width: 600, height: 60 }, gap: 40 },
        { name: "HeroButtons", size: { width: 400, height: 60 }, gap: 30 },
      ],
    },
    {
      name: "features",
      layout: "row",
      components: [
        { name: "FeatureCard1", size: { width: 350, height: 200 }, gap: 70 },
        { name: "FeatureCard2", size: { width: 350, height: 200 }, gap: 20 },
        { name: "FeatureCard3", size: { width: 350, height: 200 }, gap: 20 },
      ],
    },
    {
      name: "pricing",
      layout: "row",
      components: [
        { name: "PricingFree", size: { width: 350, height: 400 }, gap: 70 },
        { name: "PricingPro", size: { width: 350, height: 400 }, gap: 20 },
        { name: "PricingEnterprise", size: { width: 350, height: 400 }, gap: 20 },
      ],
    },
    {
      name: "footer",
      layout: "column",
      components: [
        { name: "Footer", size: { width: 1200, height: 80 }, gap: 70 },
      ],
    },
  ],
  layers: [],
};
