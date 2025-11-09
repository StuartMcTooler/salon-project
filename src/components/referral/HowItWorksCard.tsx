import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Lightbulb } from "lucide-react";
import { useState } from "react";

interface HowItWorksCardProps {
  title: string;
  steps: string[];
  example?: {
    title: string;
    description: string;
  };
  color?: 'blue' | 'green' | 'purple';
}

export const HowItWorksCard = ({ title, steps, example, color = 'blue' }: HowItWorksCardProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const colorClasses = {
    blue: 'border-blue-200 dark:border-blue-900',
    green: 'border-green-200 dark:border-green-900',
    purple: 'border-purple-200 dark:border-purple-900'
  };

  const iconColorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400'
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={colorClasses[color]}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lightbulb className={`h-5 w-5 ${iconColorClasses[color]}`} />
                <CardTitle className="text-left">{title}</CardTitle>
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full ${iconColorClasses[color]} bg-accent flex items-center justify-center text-sm font-semibold`}>
                    {index + 1}
                  </div>
                  <p className="text-sm text-muted-foreground pt-0.5">{step}</p>
                </div>
              ))}
            </div>

            {example && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                <div className="font-semibold text-sm mb-2">{example.title}</div>
                <p className="text-sm text-muted-foreground">{example.description}</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};