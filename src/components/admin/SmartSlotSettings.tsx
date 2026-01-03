import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Zap, Clock, TrendingDown, TrendingUp } from "lucide-react";
import { useSmartSlotRules } from "@/hooks/useSmartSlotRules";
import { cn } from "@/lib/utils";

interface SmartSlotSettingsProps {
  staffId: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const SmartSlotSettings = ({ staffId }: SmartSlotSettingsProps) => {
  const { rules, isLoading, createRule, deleteRule, toggleRule } = useSmartSlotRules(staffId);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({
    day_of_week: 1,
    start_time: '09:00',
    end_time: '11:00',
    rule_type: 'discount' as 'discount' | 'premium',
    modifier_percentage: 10,
    require_deposit: false,
    deposit_amount: 10,
    label: '',
    priority: 0
  });

  const handleCreateRule = () => {
    createRule.mutate({
      staff_id: staffId,
      ...newRule,
      label: newRule.label || undefined,
      deposit_amount: newRule.require_deposit ? newRule.deposit_amount : undefined
    });
    setShowAddForm(false);
    setNewRule({
      day_of_week: 1,
      start_time: '09:00',
      end_time: '11:00',
      rule_type: 'discount',
      modifier_percentage: 10,
      require_deposit: false,
      deposit_amount: 10,
      label: '',
      priority: 0
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <CardTitle>Smart Slots</CardTitle>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            variant={showAddForm ? "outline" : "default"}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Rule
          </Button>
        </div>
        <CardDescription>
          Set dynamic pricing for specific time slots. Discounts fill slow periods, premiums protect peak times.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Rule Form */}
        {showAddForm && (
          <Card className="border-dashed border-primary/50 bg-primary/5">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Day</Label>
                  <Select
                    value={newRule.day_of_week.toString()}
                    onValueChange={(v) => setNewRule(prev => ({ ...prev, day_of_week: parseInt(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map(day => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={newRule.rule_type}
                    onValueChange={(v: 'discount' | 'premium') => setNewRule(prev => ({ ...prev, rule_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discount">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-green-600" />
                          Discount
                        </div>
                      </SelectItem>
                      <SelectItem value="premium">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-amber-600" />
                          Premium
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={newRule.start_time}
                    onChange={(e) => setNewRule(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={newRule.end_time}
                    onChange={(e) => setNewRule(prev => ({ ...prev, end_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{newRule.rule_type === 'discount' ? 'Discount %' : 'Surge %'}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={newRule.modifier_percentage}
                    onChange={(e) => setNewRule(prev => ({ ...prev, modifier_percentage: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Label (optional)</Label>
                  <Input
                    placeholder="e.g., Happy Hour, Prime Time"
                    value={newRule.label}
                    onChange={(e) => setNewRule(prev => ({ ...prev, label: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={newRule.priority}
                    onChange={(e) => setNewRule(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                    placeholder="Higher wins on overlap"
                  />
                </div>
              </div>

              {newRule.rule_type === 'premium' && (
                <div className="flex items-center gap-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newRule.require_deposit}
                      onCheckedChange={(v) => setNewRule(prev => ({ ...prev, require_deposit: v }))}
                    />
                    <Label className="font-normal">Require deposit</Label>
                  </div>
                  {newRule.require_deposit && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">€</span>
                      <Input
                        type="number"
                        min={1}
                        className="w-20"
                        value={newRule.deposit_amount === 0 ? '' : newRule.deposit_amount}
                        onChange={(e) => setNewRule(prev => ({ ...prev, deposit_amount: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleCreateRule} disabled={createRule.isPending}>
                  Create Rule
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing Rules List */}
        {rules.length === 0 && !showAddForm ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No smart slot rules yet</p>
            <p className="text-sm">Add your first rule to enable dynamic pricing</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  rule.is_active 
                    ? rule.rule_type === 'discount' 
                      ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                      : "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
                    : "border-muted bg-muted/50 opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, is_active: checked })}
                  />
                  
                  <div>
                    <div className="flex items-center gap-2">
                      {rule.rule_type === 'discount' ? (
                        <TrendingDown className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-amber-600" />
                      )}
                      <span className="font-medium">
                        {DAYS_OF_WEEK.find(d => d.value === rule.day_of_week)?.label}
                      </span>
                      <span className="text-muted-foreground">
                        {formatTime(rule.start_time)} - {formatTime(rule.end_time)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant={rule.rule_type === 'discount' ? 'default' : 'secondary'}
                        className={cn(
                          rule.rule_type === 'discount' 
                            ? "bg-green-600 hover:bg-green-700" 
                            : "bg-amber-600 hover:bg-amber-700 text-white"
                        )}
                      >
                        {rule.rule_type === 'discount' ? `-${rule.modifier_percentage}%` : `+${rule.modifier_percentage}%`}
                      </Badge>
                      {rule.label && (
                        <Badge variant="outline">{rule.label}</Badge>
                      )}
                      {rule.require_deposit && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          €{rule.deposit_amount} deposit
                        </Badge>
                      )}
                      {rule.priority > 0 && (
                        <span className="text-xs text-muted-foreground">Priority: {rule.priority}</span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteRule.mutate(rule.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Weekly Preview */}
        {rules.length > 0 && (
          <div className="mt-6">
            <Label className="text-sm text-muted-foreground mb-2 block">Weekly Preview</Label>
            <div className="grid grid-cols-7 gap-1">
              {DAYS_OF_WEEK.map(day => {
                const dayRules = rules.filter(r => r.day_of_week === day.value && r.is_active);
                const hasDiscount = dayRules.some(r => r.rule_type === 'discount');
                const hasPremium = dayRules.some(r => r.rule_type === 'premium');
                
                return (
                  <div
                    key={day.value}
                    className={cn(
                      "p-2 text-center text-xs rounded border",
                      hasDiscount && hasPremium && "bg-gradient-to-b from-green-100 to-amber-100 dark:from-green-950 dark:to-amber-950 border-primary/30",
                      hasDiscount && !hasPremium && "bg-green-100 dark:bg-green-950 border-green-300",
                      !hasDiscount && hasPremium && "bg-amber-100 dark:bg-amber-950 border-amber-300",
                      !hasDiscount && !hasPremium && "bg-muted border-muted"
                    )}
                  >
                    <div className="font-medium">{day.label.slice(0, 3)}</div>
                    <div className="text-muted-foreground">{dayRules.length} rules</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
