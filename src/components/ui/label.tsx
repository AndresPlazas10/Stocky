import * as React from "react"
import type { LabelHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-primary",
      className
    )}
    {...props}
  />
))
Label.displayName = "Label"

export { Label }
