import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { debug, debugService } from '@shared/debug';
import { Separator } from '@/components/ui/separator';

/**
 * Example component to demonstrate debug usage
 */
export function DebugExample() {
  const [counter, setCounter] = useState(0);
  
  // Only show in development mode
  if (!import.meta.env.DEV) {
    return null;
  }
  
  const handleClick = () => {
    // Increment counter and log the action with different debug categories
    setCounter(counter + 1);
    
    // Log with different levels and categories
    debug(`Button clicked, counter now: ${counter + 1}`, 'all');
    debug(`Auth example debug message: ${counter + 1}`, 'auth', 'debug');
    debug(`Badge example verbose message: ${counter + 1}`, 'badge', 'verbose');
    debug(`API example warning: ${counter + 1}`, 'api', 'warn');
    debug(`Database example error: ${counter + 1}`, 'db', 'error');
    debug(`Scan example info: ${counter + 1}`, 'scan', 'info');
  };

  return (
    <Card className="mt-4 max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Debug System Example</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4">
          Click the button below to see debug messages in the console.
          Use the Debug Controls panel to toggle different categories and levels.
        </p>
        
        <div className="mb-4">
          <p>Current counter value: <strong>{counter}</strong></p>
        </div>
        
        <Separator className="my-4" />
        
        <div className="flex justify-between">
          <Button onClick={handleClick}>
            Test Debug Messages
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => {
              // Toggle debug state
              const currentState = debugService.getConfig();
              debugService.setGlobalEnabled(!currentState.enabled);
              
              // Log the change
              debug(`Debug system ${currentState.enabled ? 'disabled' : 'enabled'}`, 'all');
            }}
          >
            Toggle Debug System
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}