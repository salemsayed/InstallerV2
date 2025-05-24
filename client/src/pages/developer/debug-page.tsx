import React, { useEffect, useState } from 'react';
import { DebugExample } from '@/components/debug/debug-example';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { debug, debugService } from '@shared/debug';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DebugPage() {
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [category, setCategory] = useState('all');
  const [level, setLevel] = useState('info');
  const [message, setMessage] = useState('Test debug message');
  const [loading, setLoading] = useState(false);
  
  // Only show in development mode
  if (!import.meta.env.DEV) {
    return (
      <div className="container mx-auto mt-8 p-4">
        <h1 className="text-2xl font-bold mb-4">Debug Page</h1>
        <p>Debug tools are only available in development mode.</p>
      </div>
    );
  }
  
  const testServerDebug = async () => {
    try {
      setLoading(true);
      debug(`Testing server debug endpoint with message: ${message}`, 'api');
      
      const url = `/api/debug/test?category=${encodeURIComponent(category)}&level=${encodeURIComponent(level)}&message=${encodeURIComponent(message)}`;
      const response = await fetch(url);
      const data = await response.json();
      
      setApiResponse(data);
      debug(`Received response from server debug endpoint: ${JSON.stringify(data)}`, 'api');
    } catch (error) {
      debug(`Error testing server debug endpoint: ${error}`, 'api', 'error');
      setApiResponse({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    // Log page load with the debug utility
    debug('Debug page loaded', 'all');
  }, []);
  
  return (
    <div className="container mx-auto mt-8 p-4">
      <h1 className="text-2xl font-bold mb-4">Debug Tools</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Client Debug Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Debug Enabled:</Label>
                <p className="font-mono">{debugService.getConfig().enabled ? 'Yes' : 'No'}</p>
              </div>
              
              <div>
                <Label>Debug Level:</Label>
                <p className="font-mono">{debugService.getConfig().level}</p>
              </div>
              
              <div>
                <Label>Enabled Categories:</Label>
                <p className="font-mono">
                  {Object.entries(debugService.getConfig().categories)
                    .filter(([_, enabled]) => enabled)
                    .map(([cat]) => cat)
                    .join(', ')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Server Debug Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="auth">Authentication</SelectItem>
                    <SelectItem value="badge">Badge System</SelectItem>
                    <SelectItem value="scan">Scanning</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="db">Database</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="level">Log Level</Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger id="level">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warn">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="verbose">Verbose</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="message">Message</Label>
                <Input 
                  id="message" 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter debug message"
                />
              </div>
              
              <Button 
                onClick={testServerDebug}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Testing...' : 'Test Server Debug'}
              </Button>
              
              {apiResponse && (
                <div className="mt-4">
                  <Label>Server Response:</Label>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8">
        <DebugExample />
      </div>
    </div>
  );
}