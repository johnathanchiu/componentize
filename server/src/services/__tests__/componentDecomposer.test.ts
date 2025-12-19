/**
 * Test script to verify the component decomposer works correctly
 *
 * Run with: npx tsx src/services/__tests__/componentDecomposer.test.ts
 */

import { analyzeComplexity } from '../componentAnalyzer';
import { decomposeComponent } from '../componentDecomposer';

const testComponent = `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check } from "lucide-react"

export default function PricingCardPro() {
  return (
    <Card className="w-full h-full flex flex-col border-primary">
      <CardHeader className="flex-none">
        <Badge className="w-fit mb-2 bg-primary">Popular</Badge>
        <CardTitle className="text-2xl">Pro</CardTitle>
        <div className="mt-2">
          <span className="text-3xl font-bold">$29</span>
          <span className="text-muted-foreground">/month</span>
        </div>
        <CardDescription>For growing teams</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-600" />Unlimited projects</li>
          <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-600" />Priority support</li>
          <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-600" />50GB storage</li>
          <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-600" />Advanced analytics</li>
        </ul>
      </CardContent>
      <CardFooter className="flex-none">
        <Button className="w-full">Get Started</Button>
      </CardFooter>
    </Card>
  )
}`;

console.log('=== Testing Component Analyzer ===');
const complexity = analyzeComplexity(testComponent, 'PricingCardPro');
console.log('Complexity Report:', JSON.stringify(complexity, null, 2));

console.log('\n=== Testing Component Decomposer ===');
const decomposed = decomposeComponent(testComponent, 'PricingCardPro', { x: 100, y: 100 });
console.log(`Decomposed into ${decomposed.length} components:`);

decomposed.forEach((comp, i) => {
  console.log(`\n--- Component ${i + 1}: ${comp.name} ---`);
  console.log(`Position: (${comp.position.x}, ${comp.position.y})`);
  console.log(`Size: ${comp.size.width}x${comp.size.height}`);
  console.log('Code:');
  console.log(comp.code);
});
