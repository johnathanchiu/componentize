import { useState } from 'react';

// Component imports - these are generated components from /generated/components/
// Make sure the component files exist in the ../components/ directory
import RandomButton from '../components/RandomButton';
import TitleBar from '../components/TitleBar';

export default function MyPage() {
  return (
    <div className="relative w-full min-h-screen bg-gray-50">
      <div className="absolute" style={{ left: 48.51171875, top: 113.8359375, width: 322, height: 113 }}>
        <RandomButton />
      </div>
      <div className="absolute" style={{ left: 76.82421875, top: 17.51171875, width: 735, height: 60 }}>
        <TitleBar />
      </div>
    </div>
  );
}
