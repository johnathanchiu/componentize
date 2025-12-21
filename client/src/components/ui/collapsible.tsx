"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { cn } from "@/lib/utils";

function Collapsible({ ...props }: CollapsiblePrimitive.CollapsibleProps) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  className,
  ...props
}: CollapsiblePrimitive.CollapsibleTriggerProps) {
  return (
    <CollapsiblePrimitive.Trigger
      className={cn("cursor-pointer", className)}
      data-slot="collapsible-trigger"
      {...props}
    />
  );
}

function CollapsiblePanel({
  className,
  ...props
}: CollapsiblePrimitive.CollapsibleContentProps) {
  return (
    <CollapsiblePrimitive.Content
      className={cn(
        "overflow-hidden transition-all duration-200",
        "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        className
      )}
      data-slot="collapsible-panel"
      {...props}
    />
  );
}

export {
  Collapsible,
  CollapsibleTrigger,
  CollapsiblePanel,
  CollapsiblePanel as CollapsibleContent,
};
