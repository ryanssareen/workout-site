'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { getAuthInstance, getDbInstance } from '@/lib/firebase/config';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { collection, addDoc, getDocs, query, limit, deleteDoc, doc } from 'firebase/firestore';

type TestStatus = 'pending' | 'running' | 'success' | 'error';

interface Test {
  status: TestStatus;
  message: string;
}

export default function FirebaseTestPage() {
  const [tests, setTests] = useState<Record<string, Test>>({
    config: { status: 'pending', message: 'Waiting to test...' },
    auth: { status: 'pending', message: 'Waiting to test...' },
    firestore: { status: 'pending', message: 'Waiting to test...' },
    cleanup: { status: 'pending', message: 'Waiting to test...' },
  });
  const [testing, setTesting] = useState(false);

  const updateTest = (name: string, status: TestStatus, message: string) => {
    setTests(prev => ({
      ...prev,
      [name]: { status, message }
    }));
  };

  const runTests = async () => {
    setTesting(true);
    let testUser: any = null;
    let testDocId: string | null = null;

    // Test 1: Configuration
    updateTest('config', 'running', 'Checking Firebase configuration...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // Try to get Firebase instances to check if initialized
      const authInstance = getAuthInstance();
      const dbInstance = getDbInstance();
      
      if (!authInstance || !dbInstance) {
        throw new Error('Firebase not initialized. Check .env.local file.');
      }
      
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (!projectId || projectId === 'your_project_id') {
        throw new Error('Firebase credentials not configured in .env.local');
      }
      
      updateTest('config', 'success', `Connected to project: ${projectId}`);
    } catch (error: any) {
      updateTest('config', 'error', error.message);
      setTesting(false);
      return;
    }

    // Test 2: Authentication
    updateTest('auth', 'running', 'Testing Firebase Authentication...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const testEmail = `test-${Date.now()}@firebase-test.com`;
      const testPassword = 'TestPass123!@#';
      
      const userCredential = await createUserWithEmailAndPassword(getAuthInstance(), testEmail, testPassword);
      testUser = userCredential.user;
      
      updateTest('auth', 'success', `User created: ${testEmail}`);
    } catch (error: any) {
      updateTest('auth', 'error', `Auth failed: ${error.message}`);
      setTesting(false);
      return;
    }

    // Test 3: Firestore
    updateTest('firestore', 'running', 'Testing Firestore database...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const testData = {
        testField: 'Firebase connection test',
        timestamp: new Date().toISOString(),
        createdBy: testUser.uid,
      };
      
      const docRef = await addDoc(collection(getDbInstance(), 'test_connection'), testData);
      testDocId = docRef.id;
      
      // Try to read it back
      const q = query(collection(getDbInstance(), 'test_connection'), limit(1));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        throw new Error('Could not read from Firestore');
      }
      
      updateTest('firestore', 'success', `Document created: ${docRef.id}`);
    } catch (error: any) {
      updateTest('firestore', 'error', `Firestore failed: ${error.message}`);
      setTesting(false);
      return;
    }

    // Test 4: Cleanup
    updateTest('cleanup', 'running', 'Cleaning up test data...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // Delete test document
      if (testDocId) {
        await deleteDoc(doc(getDbInstance(), 'test_connection', testDocId));
      }
      
      // Delete test user
      if (testUser) {
        await deleteUser(testUser);
      }
      
      updateTest('cleanup', 'success', 'Test data cleaned up successfully');
    } catch (error: any) {
      updateTest('cleanup', 'error', `Cleanup warning: ${error.message}`);
    }

    setTesting(false);
  };

  const getStatusIcon = (status: TestStatus) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
    }
  };

  const getStatusBadge = (status: TestStatus) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="secondary">Testing...</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Firebase Connection Test</h1>
          <p className="text-muted-foreground mt-2">
            Test your Firebase configuration to ensure everything is set up correctly
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connection Tests</CardTitle>
            <CardDescription>
              Run these tests to verify Firebase Authentication and Firestore are working
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(tests).map(([name, test]) => (
              <div key={name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(test.status)}
                  <div>
                    <h3 className="font-semibold capitalize">{name} Test</h3>
                    <p className="text-sm text-muted-foreground">{test.message}</p>
                  </div>
                </div>
                {getStatusBadge(test.status)}
              </div>
            ))}

            <Button 
              onClick={runTests} 
              disabled={testing}
              className="w-full"
              size="lg"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                'Run All Tests'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="font-medium">Project ID:</div>
              <div className="text-muted-foreground">
                {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Not configured'}
              </div>
              
              <div className="font-medium">Auth Domain:</div>
              <div className="text-muted-foreground truncate">
                {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'Not configured'}
              </div>
              
              <div className="font-medium">API Key:</div>
              <div className="text-muted-foreground">
                {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓ Configured' : 'Not configured'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>If tests fail, check:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Firebase credentials in .env.local are correct</li>
              <li>Authentication is enabled in Firebase Console</li>
              <li>Firestore database is created</li>
              <li>Development server was restarted after adding credentials</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
