import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Clock, Plus, Trash2, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { useBusinessSmartSlotRules, useSmartSlotsEnabled } from "@/hooks/useSmartSlotRules";
import { SmartSlotSettings } from "./SmartSlotSettings";
import { DemandHeatmap } from "./DemandHeatmap";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface SmartSlotsBusinessSettingsProps {
  businessId: string;
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

export const SmartSlotsBusinessSettings = ({ businessId }: SmartSlotsBusinessSettingsProps) => {
  const { enabled, isLoading: enabledLoading, toggleEnabled } = useSmartSlotsEnabled(businessId);
  const { rules: shopWideRules, isLoading: rulesLoading, createRule, deleteRule, toggleRule } = useBusinessSmartSlotRules(businessId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({
    day_of_week: 1,
    rule_type: 'discount' as 'discount' | 'premium',
    start_time: '09:00',
    end_time: '11:00',
    modifier_percentage: 10,
    label: '',
    priority: 0,
    require_deposit: false,
    deposit_amount: 0
  });

  // Fetch staff members for the per-staff selector
  const { data: staffMembers = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff-members-for-smart-slots', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('id, display_name, full_name')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('display_name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!businessId
  });

  const handleCreateShopWideRule = () => {
    createRule.mutate({
      day_of_week: newRule.day_of_week,
      start_time: newRule.start_time,
      end_time: newRule.end_time,
      rule_type: newRule.rule_type,
      modifier_percentage: newRule.modifier_percentage,
      label: newRule.label || undefined,
      priority: newRule.priority,
      require_deposit: newRule.require_deposit,
      deposit_amount: newRule.require_deposit ? newRule.deposit_amount : undefined,
      business_id: businessId
    }, {
      onSuccess: () => {
        setShowAddForm(false);
        setNewRule({
          day_of_week: 1,
          rule_type: 'discount',
          start_time: '09:00',
          end_time: '11:00',
          modifier_percentage: 10,
          label: '',
          priority: 0,
          require_deposit: false,
          deposit_amount: 0
        });
      }
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (enabledLoading || staffLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          Smart Slots
        </h2>
        <p className="text-muted-foreground">
          Dynamic pricing rules for your salon. Offer discounts during slow periods or add surge pricing for peak times.
        </p>
      </div>

      {/* Master Kill Switch */}
      <Card className={!enabled ? "border-destructive bg-destructive/5" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {!enabled && <AlertTriangle className="h-5 w-5 text-destructive" />}
            Master Toggle
          </CardTitle>
          <CardDescription>
            {enabled 
              ? "Smart pricing is active. Rules will apply to bookings."
              : "KILL SWITCH ACTIVE - All smart pricing is disabled salon-wide."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="master-toggle" className="font-medium">
                Enable Smart Slots
              </Label>
              <p className="text-sm text-muted-foreground">
                Turn off to instantly disable all pricing rules
              </p>
            </div>
            <Switch
              id="master-toggle"
              checked={enabled}
              onCheckedChange={(checked) => toggleEnabled.mutate(checked)}
              disabled={toggleEnabled.isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="shop-wide" className="space-y-4">
        <TabsList>
          <TabsTrigger value="shop-wide">Shop-Wide Rules</TabsTrigger>
          <TabsTrigger value="per-staff">Per-Staff Rules</TabsTrigger>
          <TabsTrigger value="heatmap">Demand Heatmap</TabsTrigger>
        </TabsList>

        {/* Shop-Wide Rules Tab */}
        <TabsContent value="shop-wide" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Shop-Wide Rules</CardTitle>
                <CardDescription>
                  These rules apply to ALL staff members automatically
                </CardDescription>
              </div>
              <Button 
                onClick={() => setShowAddForm(!showAddForm)}
                size="sm"
                disabled={!enabled}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Rule
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {!enabled && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                  Smart Slots are currently disabled. Enable the master toggle to use pricing rules.
                </div>
              )}

              {/* Add Rule Form */}
              {showAddForm && enabled && (
                <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
                  <h4 className="font-medium">New Shop-Wide Rule</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Day</Label>
                      <Select
                        value={newRule.day_of_week.toString()}
                        onValueChange={(v) => setNewRule({ ...newRule, day_of_week: parseInt(v) })}
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
                        onValueChange={(v: 'discount' | 'premium') => setNewRule({ ...newRule, rule_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="discount">Discount (Lower Price)</SelectItem>
                          <SelectItem value="premium">Premium (Surge Price)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={newRule.start_time}
                        onChange={(e) => setNewRule({ ...newRule, start_time: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={newRule.end_time}
                        onChange={(e) => setNewRule({ ...newRule, end_time: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        {newRule.rule_type === 'discount' ? 'Discount %' : 'Surge %'}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={newRule.modifier_percentage}
                        onChange={(e) => setNewRule({ ...newRule, modifier_percentage: parseInt(e.target.value) || 0 })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Label (optional)</Label>
                      <Input
                        placeholder="e.g., Happy Hour"
                        value={newRule.label}
                        onChange={(e) => setNewRule({ ...newRule, label: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Input
                        type="number"
                        min={0}
                        value={newRule.priority}
                        onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-muted-foreground">Higher = takes precedence</p>
                    </div>

                    {newRule.rule_type === 'premium' && (
                      <div className="col-span-2 space-y-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            id="require-deposit"
                            checked={newRule.require_deposit}
                            onCheckedChange={(checked) => setNewRule({ ...newRule, require_deposit: checked })}
                          />
                          <Label htmlFor="require-deposit">Require Deposit</Label>
                        </div>
                        {newRule.require_deposit && (
                          <div className="space-y-2">
                            <Label>Deposit Amount (€)</Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={newRule.deposit_amount === 0 ? '' : newRule.deposit_amount}
                              onChange={(e) => setNewRule({ ...newRule, deposit_amount: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleCreateShopWideRule} disabled={createRule.isPending}>
                      {createRule.isPending ? 'Creating...' : 'Create Rule'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Existing Rules List */}
              {rulesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : shopWideRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No shop-wide rules yet</p>
                  <p className="text-sm">Create rules that apply to all staff automatically</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shopWideRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        !rule.is_active ? 'opacity-50 bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, is_active: checked })}
                          disabled={!enabled}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            {rule.rule_type === 'discount' ? (
                              <TrendingDown className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingUp className="h-4 w-4 text-amber-500" />
                            )}
                            <span className="font-medium">
                              {DAYS_OF_WEEK.find(d => d.value === rule.day_of_week)?.label}
                            </span>
                            <span className="text-muted-foreground">
                              {formatTime(rule.start_time)} - {formatTime(rule.end_time)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant={rule.rule_type === 'discount' ? 'secondary' : 'default'}>
                              {rule.rule_type === 'discount' ? `-${rule.modifier_percentage}%` : `+${rule.modifier_percentage}%`}
                            </Badge>
                            {rule.label && (
                              <span className="text-muted-foreground">"{rule.label}"</span>
                            )}
                            {rule.require_deposit && (
                              <Badge variant="outline">€{rule.deposit_amount} deposit</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">Priority: {rule.priority}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRule.mutate(rule.id)}
                        disabled={deleteRule.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per-Staff Rules Tab */}
        <TabsContent value="per-staff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Per-Staff Rules</CardTitle>
              <CardDescription>
                Select a staff member to view and manage their individual pricing rules
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!enabled && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                  Smart Slots are currently disabled. Enable the master toggle to use pricing rules.
                </div>
              )}

              <div className="space-y-2">
                <Label>Select Staff Member</Label>
                <Select
                  value={selectedStaffId || ""}
                  onValueChange={(v) => setSelectedStaffId(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a staff member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffMembers.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.display_name || staff.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedStaffId && enabled && (
                <SmartSlotSettings staffId={selectedStaffId} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demand Heatmap Tab */}
        <TabsContent value="heatmap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demand Heatmap</CardTitle>
              <CardDescription>
                Visualize booking density to inform your pricing decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Staff Member</Label>
                  <Select
                    value={selectedStaffId || ""}
                    onValueChange={(v) => setSelectedStaffId(v || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a staff member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {staffMembers.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.display_name || staff.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedStaffId && (
                  <DemandHeatmap staffId={selectedStaffId} />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
