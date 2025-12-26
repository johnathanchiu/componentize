import type { LayoutDef } from '../layout-types';

// E-commerce Product Page Layout
export const ecommerceLayout: LayoutDef = {
  pageStyle: {
    background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
    width: 1200,
  },
  sections: [
    {
      name: "product-main",
      layout: "row",
      components: [
        { name: "ProductImage", size: { width: 500, height: 500 }, gap: 50 },
        { name: "ProductDetails", size: { width: 550, height: 500 }, gap: 50 },
      ],
    },
    {
      name: "reviews",
      layout: "column",
      components: [
        { name: "ReviewsSection", size: { width: 1100, height: 280 }, gap: 60 },
      ],
    },
  ],
  layers: [],
};
