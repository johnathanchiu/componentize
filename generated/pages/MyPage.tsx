import { useState } from 'react';

// Component imports - these are generated components from /generated/components/
// Make sure the component files exist in the ../components/ directory
import PricingCard from '../components/PricingCard';
import TitleBar from '../components/TitleBar';

export default function MyPage() {
  return (
    <div className="relative w-full min-h-screen bg-gray-50">
      <div className="absolute" style={{ left: 457.734375, top: 0 }}>
        <PricingCard />
      </div>
      <div className="absolute" style={{ left: 62.6640625, top: 119.9296875, width: 717, height: 60 }}>
        <TitleBar />
      </div>
    </div>
  );
}
