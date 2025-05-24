import React, { useState, useEffect } from 'react';
import { debugService, DebugCategory, DebugLevel } from '@shared/debug';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

const categories: { value: DebugCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'auth', label: 'Authentication' },
  { value: 'badge', label: 'Badge System' },
  { value: 'scan', label: 'Scanning' },
  { value: 'api', label: 'API' },
  { value: 'db', label: 'Database' },
];

const levels: { value: DebugLevel; label: string }[] = [
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warning' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' },
  { value: 'verbose', label: 'Verbose' },
];

export function DebugControls() {
  const [isVisible, setIsVisible] = useState(false);
  const [config, setConfig] = useState(debugService.getConfig());

  useEffect(() => {
    // Check if debug settings are in local storage
    const storedConfig = localStorage.getItem('debug-config');
    if (storedConfig) {
      try {
        const parsedConfig = JSON.parse(storedConfig);
        debugService.setGlobalEnabled(parsedConfig.enabled);
        setConfig(debugService.getConfig());
      } catch (e) {
        console.error('Failed to parse stored debug config', e);
      }
    }
  }, []);

  // Update localStorage when config changes
  useEffect(() => {
    localStorage.setItem('debug-config', JSON.stringify(config));
  }, [config]);

  // Toggle global debug state
  const toggleDebug = () => {
    debugService.setGlobalEnabled(!config.enabled);
    setConfig(debugService.getConfig());
  };

  // Toggle a specific category
  const toggleCategory = (category: DebugCategory) => {
    debugService.setEnabled(!config.categories[category], category);
    setConfig(debugService.getConfig());
  };

  // Set debug level
  const setLevel = (level: DebugLevel) => {
    const newConfig = { ...config, level };
    setConfig(newConfig);
    // Update the debug service (would need to add this method to debugService)
    (debugService as any).config.level = level;
  };

  // Only show in development mode or if specifically enabled
  if (!import.meta.env.DEV && !localStorage.getItem('force-debug-ui')) {
    return null;
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(true)}
          className="bg-white dark:bg-gray-900 shadow-md"
        >
          Debug Controls
        </Button>
      </div>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-xl">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-md">Debug Controls</CardTitle>
        <Button variant="ghost" size="icon" onClick={() => setIsVisible(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between py-2">
          <Label htmlFor="debug-toggle" className="font-medium">
            Enable Debugging
          </Label>
          <Switch
            id="debug-toggle"
            checked={config.enabled}
            onCheckedChange={toggleDebug}
          />
        </div>

        <Separator className="my-2" />

        <div className="mb-2">
          <Label htmlFor="debug-level" className="font-medium block mb-1">
            Log Level
          </Label>
          <Select value={config.level} onValueChange={(val) => setLevel(val as DebugLevel)}>
            <SelectTrigger id="debug-level">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {levels.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator className="my-2" />

        <div className="mb-2">
          <Label className="font-medium block mb-1">Categories</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {categories.map((category) => (
              <Badge
                key={category.value}
                variant={config.categories[category.value] ? "default" : "outline"}
                className={`cursor-pointer ${
                  config.categories[category.value] ? "bg-primary" : "bg-secondary/30"
                }`}
                onClick={() => toggleCategory(category.value)}
              >
                {category.label}
              </Badge>
            ))}
          </div>
        </div>

        <Separator className="my-2" />

        <div className="flex justify-between mt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              localStorage.removeItem('debug-config');
              debugService.setGlobalEnabled(import.meta.env.DEV);
              setConfig(debugService.getConfig());
            }}
          >
            Reset Defaults
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              debugService.setGlobalEnabled(false);
              setConfig(debugService.getConfig());
            }}
          >
            Disable All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}