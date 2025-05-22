# Bareeq Installer Rewards Program - Code Documentation

## Table of Contents
1. [Frontend Components](#frontend-components)
2. [Backend Services](#backend-services)
3. [Authentication Implementation](#authentication-implementation)
4. [Badge System Implementation](#badge-system-implementation)
5. [QR Code Scanning Implementation](#qr-code-scanning-implementation)
6. [Database Operations](#database-operations)
7. [Utility Functions](#utility-functions)

## Frontend Components

### Authentication Components

#### `LoginPage.tsx`
```typescript
// Main authentication entry point that provides SMS and WhatsApp login options
export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Handles SMS login request
  const handleSmsLogin = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/request-otp", { phone: phoneNumber });
      // Process response and navigate to OTP verification
    } catch (error) {
      // Show error message
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handles WhatsApp login via Wasage
  const handleWasageLogin = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/wasage/otp", { phone: phoneNumber });
      // Process response and navigate to wasage verification status page
    } catch (error) {
      // Show error message 
    } finally {
      setIsLoading(false);
    }
  };
}
```

#### `OtpVerificationPage.tsx`
```typescript
// Handles OTP verification after user receives code via SMS
export default function OtpVerificationPage() {
  const { login } = useAuth();
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Submit OTP for verification
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    
    try {
      const response = await apiRequest("POST", "/api/auth/verify-otp", { 
        phone: phoneNumber, 
        otp: otp 
      });
      
      if (response.ok) {
        const data = await response.json();
        // Process successful login
        login(data.user);
        navigate("/installer/dashboard");
      } else {
        // Handle verification error
      }
    } catch (error) {
      // Display error message
    } finally {
      setIsVerifying(false);
    }
  };
}
```

### Badge Display Components

#### `AchievementCard.tsx`
```typescript
// Displays a single badge with progress indicator
export function AchievementCard({ badge, progress, earned }) {
  // Calculate completion percentage
  const calculateCompletion = () => {
    if (!badge) return 0;
    
    // Handle points requirement
    const pointsCompletion = badge.requiredPoints 
      ? Math.min(100, Math.floor((progress.points / badge.requiredPoints) * 100)) 
      : 0;
    
    // Handle installations requirement
    const installationsCompletion = badge.minInstallations 
      ? Math.min(100, Math.floor((progress.installations / badge.minInstallations) * 100)) 
      : 0;
    
    // Overall completion is the minimum of both requirements
    return Math.min(pointsCompletion, installationsCompletion);
  };
  
  // Format tooltip message showing progress details
  const getTooltipMessage = () => {
    if (!badge) return "";
    
    let message = badge.description || badge.name;
    
    // Add points progress if required
    if (badge.requiredPoints) {
      const pointsPercent = Math.min(100, Math.floor((progress.points / badge.requiredPoints) * 100));
      message += `\nنقاط: ${progress.points}/${badge.requiredPoints} (${pointsPercent}%)`;
    }
    
    // Add installations progress if required
    if (badge.minInstallations) {
      const installPercent = Math.min(100, Math.floor((progress.installations / badge.minInstallations) * 100));
      message += `\nتركيبات: ${progress.installations}/${badge.minInstallations} (${installPercent}%)`;
    }
    
    return message;
  };
  
  return (
    <Tooltip content={getTooltipMessage()}>
      <div className="relative">
        {/* Badge icon with circular progress indicator */}
        <div className="relative w-16 h-16">
          <CircularProgress value={calculateCompletion()} />
          <div className="absolute inset-0 flex items-center justify-center">
            <img src={badge.icon} alt={badge.name} className="w-10 h-10" />
          </div>
        </div>
        <p className="text-xs text-center mt-1">{badge.name}</p>
      </div>
    </Tooltip>
  );
}
```

### Dashboard Components

#### `InstallerDashboard.tsx`
```typescript
// Main dashboard for installers showing stats and achievements
export default function InstallerDashboard() {
  const { user } = useAuth();
  
  // Fetch transactions for point calculations
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: [`/api/transactions?userId=${user?.id}`],
    enabled: !!user?.id,
  });
  
  // Fetch badges
  const { data: badgesData, isLoading: badgesLoading } = useQuery({
    queryKey: ['/api/badges', user?.id],
    queryFn: () => user?.id ? apiRequest('GET', `/api/badges?userId=${user.id}`).then(res => res.json()) : null,
    enabled: !!user?.id,
  });
  
  // Calculate stats from transactions
  const calculateStats = () => {
    if (!transactionsData?.transactions) return { points: 0, installations: 0 };
    
    // Filter transactions by type (case insensitive)
    const earningTransactions = transactionsData.transactions.filter(t => 
      t.type.toLowerCase() === 'earning');
    const redemptionTransactions = transactionsData.transactions.filter(t => 
      t.type.toLowerCase() === 'redemption');
    
    // Calculate total earnings and redemptions
    const totalEarnings = earningTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalRedemptions = redemptionTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate points balance
    const pointsBalance = totalEarnings - totalRedemptions;
    
    // Calculate total installations (number of earning transactions)
    const installationsCount = earningTransactions.length;
    
    return { points: pointsBalance, installations: installationsCount };
  };
  
  // Get user badges - properly handle badge IDs from user object
  const getUserBadges = () => {
    if (!user || !badgesData?.badges) return [];
    
    const userBadgeIds = user.badge_ids || [];
    
    // Convert to number array if it's a string
    const parsedBadgeIds = Array.isArray(userBadgeIds) 
      ? userBadgeIds 
      : (typeof userBadgeIds === 'string' 
          ? JSON.parse(userBadgeIds) 
          : []);
    
    // Filter badges to only those earned by user
    return badgesData.badges.filter(badge => 
      parsedBadgeIds.includes(badge.id)
    );
  };
  
  // Get user progress on all badges
  const getBadgeProgress = () => {
    const stats = calculateStats();
    
    if (!badgesData?.badges) return {};
    
    // Create progress object for each badge
    return badgesData.badges.reduce((progressMap, badge) => {
      progressMap[badge.id] = {
        points: stats.points,
        installations: stats.installations
      };
      return progressMap;
    }, {});
  };
  
  const stats = calculateStats();
  const userBadges = getUserBadges();
  const badgeProgress = getBadgeProgress();
  
  return (
    <InstallerLayout>
      <div className="p-4 space-y-4">
        {/* Stats Section */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                title="رصيد النقاط"
                value={stats.points}
                icon={<Coins className="h-5 w-5" />}
              />
              <StatCard
                title="إجمالي التركيبات"
                value={stats.installations}
                icon={<Activity className="h-5 w-5" />}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Achievements Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">الإنجازات</CardTitle>
          </CardHeader>
          <CardContent>
            {badgesLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : userBadges.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {userBadges.map(badge => (
                  <AchievementCard
                    key={badge.id}
                    badge={badge}
                    progress={badgeProgress[badge.id]}
                    earned={true}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                لم تحصل على أي إنجازات بعد. قم بتركيب المزيد من المنتجات لكسب الشارات!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </InstallerLayout>
  );
}
```

### Scanning Components

#### `AdvancedScanPage.tsx`
```typescript
// Advanced QR scanner using Scandit SDK with OCR capabilities
export default function AdvancedScanPage() {
  const scannerRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const { user, refreshUser } = useAuth();
  
  // Function to validate QR code
  const validateQrCode = async (url: string) => {
    setIsValidating(true);
    setError(null);
    setResult(null);
    
    try {
      // Step 1: URL shape validation
      const warrantyUrlRegex = /^https:\/\/warranty\.bareeq\.lighting\/p\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
      const shortUrlRegex = /^https:\/\/w\.bareeq\.lighting\/p\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
      
      const warrantyMatch = url.match(warrantyUrlRegex);
      const shortMatch = url.match(shortUrlRegex);
      
      if (!warrantyMatch && !shortMatch) {
        setError("صيغة رمز QR غير صالحة");
        setIsValidating(false);
        return;
      }

      const uuid = warrantyMatch ? warrantyMatch[1] : shortMatch![1];
      
      // Step 2: UUID validation
      if (!isValidUUIDv4(uuid)) {
        setError("رمز المنتج UUID غير صالح");
        setIsValidating(false);
        return;
      }

      // Step 3: Send to server for validation and processing
      const scanResult = await apiRequest(
        "POST", 
        `/api/scan-qr`, 
        { uuid }
      );
      
      const result = await scanResult.json();
      
      if (!result.success) {
        setError(result.message);
        setIsValidating(false);
        return;
      }
      
      // Success path
      setIsValidating(false);
      setResult(`تم التحقق من المنتج: ${result.productName}`);
      
      // Call refreshUser to update user data directly in auth context
      refreshUser();
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/transactions?userId=${user?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/badges', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
      
    } catch (err) {
      console.error("Validation error:", err);
      setError("خطأ في التحقق من رمز QR");
      setIsValidating(false);
    }
  };
  
  // Initialize Scandit scanner
  useEffect(() => {
    let context: any = null;
    let barcodeCapture: any = null;
    
    const initializeScanner = async () => {
      try {
        // Load Scandit libraries
        const core = await import("@scandit/web-datacapture-core");
        const barcode = await import("@scandit/web-datacapture-barcode");
        const id = await import("@scandit/web-datacapture-id");
        
        // Create data capture context with license
        context = await core.DataCaptureContext.create("YOUR_SCANDIT_LICENSE_KEY");
        
        // Configure camera
        const camera = core.Camera.default;
        const cameraSettings = core.CameraSettings.default;
        cameraSettings.preferredResolution = core.VideoResolution.FullHD;
        await camera.applySettings(cameraSettings);
        
        // Create barcode capture settings
        const settings = new barcode.BarcodeCaptureSettings();
        settings.enableSymbology(barcode.Symbology.QR, true);
        settings.enableSymbology(barcode.Symbology.DataMatrix, true);
        
        // Create barcode capture mode
        barcodeCapture = barcode.BarcodeCapture.forContext(context, settings);
        
        // Add listener for scan events
        barcodeCapture.addListener({
          didScan: (mode: any, session: any) => {
            const barcode = session.newlyRecognizedBarcodes[0];
            const data = barcode.data;
            validateQrCode(data);
          }
        });
        
        // Set up view
        const view = core.DataCaptureView.forContext(context);
        view.connectToElement(scannerRef.current!);
        view.addControl(new core.ZoomSwitchControl());
        
        // Add overlay
        const overlay = barcode.BarcodeCaptureOverlay.withBarcodeCaptureForView(barcodeCapture, view);
        overlay.viewfinder = new core.RectangularViewfinder();
        
        // Start camera
        context.setFrameSource(camera);
        camera.switchToDesiredState(core.FrameSourceState.On);
        barcodeCapture.isEnabled = true;
        
      } catch (error) {
        console.error("Error initializing scanner:", error);
        setError("خطأ في تهيئة الماسح الضوئي");
      }
    };
    
    initializeScanner();
    
    // Cleanup
    return () => {
      if (barcodeCapture) {
        barcodeCapture.isEnabled = false;
      }
      if (context) {
        context.dispose();
      }
    };
  }, []);
  
  return (
    <InstallerLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Scanner view */}
        <div 
          ref={scannerRef} 
          className="flex-1 relative overflow-hidden bg-black"
        />
        
        {/* Result/error display */}
        {(result || error || isValidating) && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
            {isValidating && (
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="animate-spin h-5 w-5" />
                <p>جاري التحقق من الرمز...</p>
              </div>
            )}
            
            {result && (
              <div className="flex items-center text-green-600">
                <CheckCircle2 className="mr-2 h-5 w-5" />
                <p>{result}</p>
              </div>
            )}
            
            {error && (
              <div className="flex items-center text-red-500">
                <AlertCircle className="mr-2 h-5 w-5" />
                <p>{error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </InstallerLayout>
  );
}
```

### Version Display Component

#### `VersionDisplay.tsx`
```typescript
// Component to display current application version
export function VersionDisplay() {
  const [version, setVersion] = useState<string>("loading...");
  
  // Fetch version info from server
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch("/api/version");
        if (response.ok) {
          const data = await response.json();
          setVersion(data.version);
        }
      } catch (error) {
        console.error("Error fetching version:", error);
        setVersion("unknown");
      }
    };
    
    fetchVersion();
  }, []);
  
  return (
    <div className="text-xs text-muted-foreground text-center py-2">
      نسخة التطبيق: {version}
    </div>
  );
}
```

## Backend Services

### Auth Provider

```typescript
// Context providing authentication state and functions
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Check server for active session on load
  useEffect(() => {
    console.log("[AUTH] Initializing auth state");
    const checkServerSession = async () => {
      console.log("[AUTH] Checking server session");
      try {
        const response = await fetch("/api/users/me", {
          credentials: "include",
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData.user);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error("[AUTH] Error checking session:", error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkServerSession();
  }, []);
  
  // Function to handle user login
  const login = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
  };
  
  // Function to handle user logout
  const logout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      
      setUser(null);
      setIsAuthenticated(false);
      navigate("/");
      
      toast({
        title: "تم تسجيل الخروج بنجاح",
        description: "تم إنهاء جلستك بنجاح",
      });
    } catch (error) {
      console.error("[AUTH] Logout error:", error);
      toast({
        title: "خطأ في تسجيل الخروج",
        description: "حدث خطأ أثناء تسجيل الخروج. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
    }
  };
  
  // Function to refresh user data
  const refreshUser = async () => {
    console.log("[AUTH] Refreshing user data");
    try {
      const response = await fetch("/api/users/me", {
        credentials: "include",
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData.user);
        console.log("[AUTH] User data refreshed successfully");
        return userData.user;
      } else {
        // Handle auth error/expiration
        if (response.status === 401) {
          console.log("[AUTH] Session invalid during refresh, logging out");
          setUser(null);
          setIsAuthenticated(false);
          navigate("/");
        }
        throw new Error("Failed to refresh user data");
      }
    } catch (error) {
      console.error("[AUTH] Error refreshing user:", error);
      throw error;
    }
  };
  
  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoading, 
      login, 
      logout,
      refreshUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

## Authentication Implementation

### Server-Side Authentication

```typescript
// Server routes for authentication
// Setup authentication middleware and routes
export async function setupAuth(app: Express) {
  // Initialize session management
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  // Configure session middleware with PostgreSQL store
  app.use(
    session({
      store: new PgStore({
        pool: pgPool,
        tableName: "sessions",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "bareeq-session-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction || isReplit,
        httpOnly: true,
        maxAge: SESSION_TTL_MINUTES * 60 * 1000,
        sameSite: isReplit ? 'none' : 'lax'
      }
    })
  );
  
  // Initialize passport with local strategy for OTP
  passport.use(new LocalStrategy(
    {
      usernameField: 'phone',
      passwordField: 'otp',
    },
    async (phone, otp, done) => {
      try {
        // Verify OTP using SMS service
        const isValid = await smsService.verifyOtp(phone, otp);
        
        if (!isValid) {
          return done(null, false, { message: 'Invalid OTP' });
        }
        
        // Get or create user by phone number
        const user = await getUserByPhone(phone);
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));
  
  // Serialize and deserialize user
  passport.serializeUser((user: User, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
  
  app.use(passport.initialize());
  app.use(passport.session());
}

// Authentication check middleware
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({
    success: false,
    message: "غير مصرح. يرجى تسجيل الدخول.",
    error_code: "UNAUTHORIZED"
  });
};
```

### SMS Authentication Service

```typescript
// Mock SMS service for OTP generation and verification
export class MockSmsService {
  private pool: Pool;
  
  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.initializeOtpTable();
    
    // Cleanup expired OTPs every hour
    setInterval(() => this.cleanupExpiredOtps(), 60 * 60 * 1000);
    
    console.log("[sms] Mock SMS Service initialized");
  }
  
  // Create OTP table if it doesn't exist
  private async initializeOtpTable() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS otp_codes (
          id SERIAL PRIMARY KEY,
          phone_number TEXT NOT NULL,
          otp TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL
        )
      `);
      console.log("[sms] OTP table initialized");
    } catch (error) {
      console.error("[sms] Error initializing OTP table:", error);
    }
  }
  
  // Remove expired OTPs
  private async cleanupExpiredOtps() {
    try {
      await this.pool.query(`
        DELETE FROM otp_codes
        WHERE expires_at < NOW()
      `);
    } catch (error) {
      console.error("[sms] Error cleaning up expired OTPs:", error);
    }
  }
  
  // Generate a 6-digit OTP
  generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  // Store OTP in database
  async storeOtp(phoneNumber: string, otp: string): Promise<void> {
    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    try {
      // Delete any existing OTPs for this phone number
      await this.pool.query(
        "DELETE FROM otp_codes WHERE phone_number = $1",
        [phoneNumber]
      );
      
      // Store new OTP
      await this.pool.query(
        "INSERT INTO otp_codes (phone_number, otp, expires_at) VALUES ($1, $2, $3)",
        [phoneNumber, otp, expiresAt]
      );
    } catch (error) {
      console.error("[sms] Error storing OTP:", error);
      throw error;
    }
  }
  
  // Verify OTP against database
  async verifyOtp(phoneNumber: string, otp: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        "SELECT * FROM otp_codes WHERE phone_number = $1 AND otp = $2 AND expires_at > NOW()",
        [phoneNumber, otp]
      );
      
      if (result.rows.length === 0) {
        return false;
      }
      
      // Delete the used OTP
      await this.pool.query(
        "DELETE FROM otp_codes WHERE phone_number = $1",
        [phoneNumber]
      );
      
      return true;
    } catch (error) {
      console.error("[sms] Error verifying OTP:", error);
      return false;
    }
  }
  
  // Send SMS (mock implementation)
  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    // Log the SMS for testing purposes
    console.log(`[sms] 📱 SMS to ${phoneNumber}: ${message}`);
    return true;
  }
  
  // Generate and send OTP
  async sendOtp(phoneNumber: string): Promise<{ success: boolean; otp?: string }> {
    try {
      const otp = this.generateOtp();
      await this.storeOtp(phoneNumber, otp);
      
      const message = `رمز التحقق الخاص بك لبرنامج مكافآت بريق هو: ${otp}`;
      const sent = await this.sendSms(phoneNumber, message);
      
      if (sent) {
        console.log(`[sms] OTP sent to ${phoneNumber}: ${otp}`);
        return { success: true, otp };
      } else {
        return { success: false };
      }
    } catch (error) {
      console.error("[sms] Error sending OTP:", error);
      return { success: false };
    }
  }
}

// Export singleton instance
export const smsService = new MockSmsService();
```

## Badge System Implementation

### Badge Calculation Logic

```typescript
// Function to calculate which badges a user qualifies for
async function calculateUserBadgeQualifications(userId: number, forceUpdate = false): Promise<{
  userBadgeIds: number[];
  badgeChanges: boolean;
}> {
  console.log(`[BADGE SYSTEM] Calculating badge qualifications for user ${userId}, forceUpdate=${forceUpdate}`);
  
  try {
    // Step 1: Get all active badges with their requirements
    const badges = await storage.listBadges(true);
    console.log(`[BADGE SYSTEM] Found ${badges.length} active badges to check`);
    
    // Step 2: Get the user's transactions
    const transactions = await storage.getTransactionsByUserId(userId);
    console.log(`[BADGE SYSTEM] Retrieved ${transactions.length} transactions for user ${userId}`);
    
    // Step 3: Calculate user's stats from transactions
    // Filter earning transactions (case insensitive)
    const installationTransactions = transactions.filter(
      t => t.type.toLowerCase() === 'earning'
    );
    
    // Calculate total installations (count of earning transactions)
    const totalInstallations = installationTransactions.length;
    console.log(`[BADGE SYSTEM] User ${userId} has completed ${totalInstallations} total installations`);
    
    // Calculate point totals
    const earningTransactions = transactions.filter(
      t => t.type.toLowerCase() === 'earning'
    );
    const redemptionTransactions = transactions.filter(
      t => t.type.toLowerCase() === 'redemption'
    );
    
    const totalEarnings = earningTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalRedemptions = redemptionTransactions.reduce((sum, t) => sum + t.amount, 0);
    const pointsBalance = totalEarnings - totalRedemptions;
    
    console.log(`[BADGE SYSTEM] User ${userId} has ${pointsBalance} points balance (${totalEarnings} earned, ${totalRedemptions} redeemed)`);
    
    // Step 4: Get user's current badge IDs
    const user = await storage.getUser(userId);
    if (!user) {
      console.log(`[BADGE SYSTEM] User ${userId} not found`);
      return { userBadgeIds: [], badgeChanges: false };
    }
    
    // Parse badge IDs (could be string or array)
    let currentBadgeIds: number[] = [];
    
    if (user.badge_ids) {
      if (typeof user.badge_ids === 'string') {
        try {
          currentBadgeIds = JSON.parse(user.badge_ids);
        } catch (e) {
          console.error(`[BADGE SYSTEM] Error parsing badge_ids for user ${userId}:`, e);
        }
      } else if (Array.isArray(user.badge_ids)) {
        currentBadgeIds = user.badge_ids;
      }
    }
    
    // Step 5: Determine which badges the user qualifies for
    const qualifiedBadgeIds: number[] = [];
    
    for (const badge of badges) {
      // Check if user meets the badge requirements
      let qualifiesForPoints = true;
      let qualifiesForInstallations = true;
      
      // Check points requirement if specified
      if (badge.requiredPoints && badge.requiredPoints > 0) {
        qualifiesForPoints = pointsBalance >= badge.requiredPoints;
        
        if (!qualifiesForPoints) {
          console.log(`[BADGE SYSTEM] User ${userId} does not meet points requirement (${pointsBalance}/${badge.requiredPoints}) for badge ${badge.id} (${badge.name})`);
        }
      }
      
      // Check installations requirement if specified
      if (badge.minInstallations && badge.minInstallations > 0) {
        qualifiesForInstallations = totalInstallations >= badge.minInstallations;
        
        if (!qualifiesForInstallations) {
          console.log(`[BADGE SYSTEM] User ${userId} does not meet installation requirement (${totalInstallations}/${badge.minInstallations}) for badge ${badge.id} (${badge.name})`);
        }
      }
      
      // User qualifies if they meet both requirements
      if (qualifiesForPoints && qualifiesForInstallations) {
        console.log(`[BADGE SYSTEM] User ${userId} qualifies for badge ${badge.id} (${badge.name})`);
        qualifiedBadgeIds.push(badge.id);
      }
    }
    
    // Step 6: Determine if there are changes in badge assignments
    function areBadgeArraysDifferent(arr1: number[], arr2: number[]): boolean {
      if (arr1.length !== arr2.length) return true;
      
      const set1 = new Set(arr1);
      for (const id of arr2) {
        if (!set1.has(id)) return true;
      }
      
      return false;
    }
    
    const badgeChanges = areBadgeArraysDifferent(currentBadgeIds, qualifiedBadgeIds);
    
    // Step 7: Update user's badges if there are changes or force update is requested
    if (badgeChanges || forceUpdate) {
      console.log(`[BADGE SYSTEM] Updating badges for user ${userId}`);
      console.log(`[BADGE SYSTEM] Old badges: ${JSON.stringify(currentBadgeIds)}`);
      console.log(`[BADGE SYSTEM] New badges: ${JSON.stringify(qualifiedBadgeIds)}`);
      
      await storage.updateUser(userId, {
        badge_ids: qualifiedBadgeIds
      });
      
      return { userBadgeIds: qualifiedBadgeIds, badgeChanges: true };
    } else {
      console.log(`[BADGE SYSTEM] No badge changes for user ${userId}`);
      return { userBadgeIds: currentBadgeIds, badgeChanges: false };
    }
    
  } catch (error) {
    console.error(`[BADGE SYSTEM] Error calculating badges for user ${userId}:`, error);
    return { userBadgeIds: [], badgeChanges: false };
  }
}
```

## QR Code Scanning Implementation

### QR Code Scanner API Endpoint

```typescript
// Server endpoint to handle QR code scanning
app.post("/api/scan-qr", async (req: Request, res: Response) => {
  try {
    // Ensure user is authenticated
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({
        success: false,
        message: "غير مصرح. يرجى تسجيل الدخول.",
        error_code: "UNAUTHORIZED"
      });
    }
    
    const { uuid } = req.body;
    
    // Validate UUID
    if (!uuid || typeof uuid !== 'string' || !isValidUUIDv4(uuid)) {
      return res.status(400).json({
        success: false,
        message: "رمز UUID غير صالح",
        error_code: "INVALID_UUID"
      });
    }
    
    // Check if UUID has already been scanned
    const existingCode = await storage.checkScannedCode(uuid);
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: "تم مسح هذا المنتج مسبقًا",
        error_code: "DUPLICATE_SCAN",
        details: { duplicate: true, scannedBy: existingCode.scannedBy }
      });
    }
    
    // Get or create a product record for this UUID
    const productName = await getProductNameBySerialNumber(uuid);
    
    // Record the scan
    const userId = req.user.id;
    const scan = await storage.createScannedCode({
      uuid,
      scannedBy: userId,
      productName: productName || "منتج غير معروف"
    });
    
    // Create a points transaction for the scan
    const pointsAwarded = 69; // Standard points for successful scan
    
    await storage.createTransaction({
      userId,
      amount: pointsAwarded,
      type: "EARNING",
      description: `تركيب ${productName || "منتج غير معروف"}`,
      transactionDate: new Date()
    });
    
    // Recalculate user's badges
    await calculateUserBadgeQualifications(userId);
    
    // Return success response
    return res.json({
      success: true,
      message: "تم التحقق من المنتج بنجاح",
      productName: productName || "منتج غير معروف",
      pointsAwarded,
      scannedAt: scan.createdAt
    });
    
  } catch (error) {
    console.error("Error in scan-qr endpoint:", error);
    
    return res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء معالجة المسح",
      error_code: "SCAN_ERROR"
    });
  }
});
```

### UUID Validation Utility

```typescript
// Validate if the UUID is a valid v4 UUID
function isValidUUIDv4(uuid: string): boolean {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}
```

## Database Operations

### Storage Implementation

```typescript
// Database storage implementation for all data operations
export class DatabaseStorage implements IStorage {
  private db: any;
  
  constructor() {
    this.db = drizzle(pool, { schema });
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
      return user;
    } catch (error) {
      console.error("Error getting user:", error);
      return undefined;
    }
  }
  
  async getUserByPhone(phone: string): Promise<User | undefined> {
    try {
      const [user] = await this.db.select().from(schema.users).where(eq(schema.users.phone, phone));
      return user;
    } catch (error) {
      console.error("Error getting user by phone:", error);
      return undefined;
    }
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await this.db.insert(schema.users).values(insertUser).returning();
      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    try {
      const [user] = await this.db
        .update(schema.users)
        .set(userData)
        .where(eq(schema.users.id, id))
        .returning();
      return user;
    } catch (error) {
      console.error("Error updating user:", error);
      return undefined;
    }
  }
  
  // Transaction operations
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    try {
      const [transaction] = await this.db
        .insert(schema.transactions)
        .values(insertTransaction)
        .returning();
      return transaction;
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }
  
  async getTransactionsByUserId(userId: number, limit = 1000000): Promise<Transaction[]> {
    try {
      return await this.db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.userId, userId))
        .orderBy(desc(schema.transactions.transactionDate))
        .limit(limit);
    } catch (error) {
      console.error("Error getting transactions by user:", error);
      return [];
    }
  }
  
  async calculateUserPointsBalance(userId: number): Promise<number> {
    try {
      // Get all user's transactions
      const transactions = await this.getTransactionsByUserId(userId);
      
      // Calculate points from transactions
      const earningTransactions = transactions.filter(
        t => t.type.toLowerCase() === 'earning'
      );
      const redemptionTransactions = transactions.filter(
        t => t.type.toLowerCase() === 'redemption'
      );
      
      const totalEarnings = earningTransactions.reduce((sum, t) => sum + t.amount, 0);
      const totalRedemptions = redemptionTransactions.reduce((sum, t) => sum + t.amount, 0);
      
      // Return balance
      return totalEarnings - totalRedemptions;
    } catch (error) {
      console.error("Error calculating user points:", error);
      return 0;
    }
  }
  
  // Badge operations
  async createBadge(insertBadge: InsertBadge): Promise<Badge> {
    try {
      const [badge] = await this.db
        .insert(schema.badges)
        .values(insertBadge)
        .returning();
      return badge;
    } catch (error) {
      console.error("Error creating badge:", error);
      throw error;
    }
  }
  
  async getBadge(id: number): Promise<Badge | undefined> {
    try {
      const [badge] = await this.db
        .select()
        .from(schema.badges)
        .where(eq(schema.badges.id, id));
      return badge;
    } catch (error) {
      console.error("Error getting badge:", error);
      return undefined;
    }
  }
  
  async listBadges(active?: boolean): Promise<Badge[]> {
    try {
      if (active !== undefined) {
        return await this.db
          .select()
          .from(schema.badges)
          .where(eq(schema.badges.active, active ? 1 : 0));
      } else {
        return await this.db.select().from(schema.badges);
      }
    } catch (error) {
      console.error("Error listing badges:", error);
      return [];
    }
  }
  
  async updateBadge(id: number, data: Partial<Badge>): Promise<Badge | undefined> {
    try {
      const [badge] = await this.db
        .update(schema.badges)
        .set(data)
        .where(eq(schema.badges.id, id))
        .returning();
      return badge;
    } catch (error) {
      console.error("Error updating badge:", error);
      return undefined;
    }
  }
  
  // Scanned codes operations
  async checkScannedCode(uuid: string): Promise<ScannedCode | undefined> {
    try {
      const [code] = await this.db
        .select()
        .from(schema.scannedCodes)
        .where(eq(schema.scannedCodes.uuid, uuid));
      return code;
    } catch (error) {
      console.error("Error checking scanned code:", error);
      return undefined;
    }
  }
  
  async createScannedCode(data: { 
    uuid: string; 
    scannedBy: number; 
    productName?: string; 
    productId?: number 
  }): Promise<ScannedCode> {
    try {
      const [code] = await this.db
        .insert(schema.scannedCodes)
        .values({
          uuid: data.uuid,
          scannedBy: data.scannedBy,
          productName: data.productName,
          productId: data.productId,
          createdAt: new Date()
        })
        .returning();
      return code;
    } catch (error) {
      console.error("Error creating scanned code:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const storage = new DatabaseStorage();
```

## Utility Functions

### Version Management

```typescript
/**
 * Increments version number based on type (major, minor, patch)
 * @param {string} currentVersion - Current version string (e.g., 'v1.0.1')
 * @param {string} type - Type of increment ('major', 'minor', or 'patch')
 * @returns {string} - New version string
 */
function incrementVersion(currentVersion, type = 'minor') {
  // Remove 'v' prefix if present
  if (currentVersion.startsWith('v')) {
    currentVersion = currentVersion.substring(1);
  }
  
  // Split version into components
  const parts = currentVersion.split('.');
  const major = parseInt(parts[0], 10) || 0;
  const minor = parseInt(parts[1], 10) || 0;
  const patch = parseInt(parts[2], 10) || 0;
  
  // Increment based on type
  if (type === 'major') {
    return `v${major + 1}.0.0`;
  } else if (type === 'minor') {
    return `v${major}.${minor + 1}.0`;
  } else {
    return `v${major}.${minor}.${patch + 1}`;
  }
}

/**
 * Updates the version file with the new version
 */
function updateVersionFile() {
  // Read current version
  const versionPath = path.join(__dirname, '../shared/version.json');
  
  try {
    // Create version file if it doesn't exist
    if (!fs.existsSync(versionPath)) {
      fs.writeFileSync(versionPath, JSON.stringify({ version: 'v1.0.0' }, null, 2));
    }
    
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    const currentVersion = versionData.version;
    
    // Get increment type from arguments or default to minor
    const incrementType = process.argv[2] || 'minor';
    
    // Increment version
    const newVersion = incrementVersion(currentVersion, incrementType);
    
    // Update version file
    fs.writeFileSync(
      versionPath,
      JSON.stringify({ version: newVersion }, null, 2)
    );
    
    console.log(`Version updated from ${currentVersion} to ${newVersion}`);
  } catch (error) {
    console.error('Error updating version:', error);
    process.exit(1);
  }
}
```

### Enhanced Logout Utility

```typescript
/**
 * Enhanced logout utility that ensures complete session termination
 * in all environments including Replit deployments.
 */

/**
 * Handles comprehensive logout to ensure proper session termination
 * and cookie clearing in all environments.
 */
export function performEnhancedLogout(req: Request, res: Response) {
  console.log("[LOGOUT] Enhanced logout requested");
  
  // Helper function to clear all possible cookies with all possible settings
  function clearAllCookies() {
    // Get all cookie names
    const cookies = req.cookies;
    const cookieNames = Object.keys(cookies);
    
    // Common cookie paths to try
    const paths = ['/', '/api', ''];
    
    // Clear each cookie with multiple possible configurations to ensure thorough cleanup
    cookieNames.forEach(name => {
      paths.forEach(path => {
        // Standard cookie clearing
        res.clearCookie(name, { path });
        
        // Secure cookie clearing
        res.clearCookie(name, { path, secure: true });
        
        // HttpOnly cookie clearing
        res.clearCookie(name, { path, httpOnly: true });
        
        // Combined secure + httpOnly
        res.clearCookie(name, { path, secure: true, httpOnly: true });
        
        // SameSite variations
        ['strict', 'lax', 'none'].forEach(sameSite => {
          res.clearCookie(name, { 
            path, 
            secure: true, 
            httpOnly: true,
            sameSite: sameSite as 'strict' | 'lax' | 'none'
          });
        });
      });
    });
  }
  
  // Helper function to send final response
  function completeLogoutResponse() {
    // Check if JSON response expected
    const acceptJson = req.headers.accept?.includes('application/json');
    
    if (acceptJson) {
      res.status(200).json({
        success: true,
        message: "تم تسجيل الخروج بنجاح"
      });
    } else {
      console.log("[LOGOUT] HTML logout page requested - sending HTML with auto-redirect");
      res.send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>تم تسجيل الخروج</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background: #f8f9fa;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              direction: rtl;
            }
            .logout-container {
              background: white;
              border-radius: 8px;
              padding: 2rem;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              text-align: center;
            }
            h1 { color: #333; }
            p { color: #666; margin: 1rem 0; }
            .redirect-text { font-size: 0.9rem; color: #888; }
            .btn {
              background: #0070f3;
              color: white;
              border: none;
              padding: 0.75rem 1.5rem;
              border-radius: 4px;
              cursor: pointer;
              font-size: 1rem;
              margin-top: 1rem;
              text-decoration: none;
              display: inline-block;
            }
          </style>
          <script>
            // Auto-redirect to login after 3 seconds
            setTimeout(() => {
              window.location.href = '/';
            }, 3000);
          </script>
        </head>
        <body>
          <div class="logout-container">
            <h1>تم تسجيل الخروج بنجاح</h1>
            <p>شكراً لاستخدامك تطبيق مكافآت بريق</p>
            <p class="redirect-text">سيتم إعادة توجيهك لصفحة تسجيل الدخول تلقائياً خلال 3 ثوان...</p>
            <a href="/" class="btn">العودة للصفحة الرئيسية</a>
          </div>
        </body>
        </html>
      `);
    }
  }
  
  // 1. First clear session data from req object
  if (req.session) {
    req.session.destroy(err => {
      if (err) {
        console.error("[LOGOUT] Error destroying session:", err);
      } else {
        console.log("[LOGOUT] Session destroyed successfully");
      }
      
      // 2. Call passport logout to remove user from request
      req.logout(err => {
        if (err) {
          console.error("[LOGOUT] Error during passport logout:", err);
        } else {
          console.log("[LOGOUT] Passport logout successful");
        }
        
        // 3. Clear all cookies to ensure complete logout
        clearAllCookies();
        
        // 4. Send response
        completeLogoutResponse();
      });
    });
  } else {
    // If no session, just clear cookies and send response
    clearAllCookies();
    completeLogoutResponse();
  }
}
```

## Database Schema

```typescript
// Database schema definitions using Drizzle

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  role: text('role').notNull(),
  name: text('name').notNull(),
  points: integer('points').notNull().default(0),
  phone: text('phone').notNull().unique(),
  region: text('region'),
  status: text('status').notNull().default('ACTIVE'),
  invitedBy: integer('invited_by'),
  level: integer('level').notNull().default(1),
  badge_ids: jsonb('badge_ids'),
  profileImageUrl: text('profile_image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Transactions table
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  amount: integer('amount').notNull(),
  type: text('type').notNull(),
  description: text('description'),
  transactionDate: timestamp('transaction_date', { withTimezone: true }).defaultNow()
});

// Badges table
export const badges = pgTable('badges', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  description: text('description'),
  requiredPoints: integer('required_points'),
  minInstallations: integer('min_installations'),
  active: integer('active').notNull().default(1)
});

// Scanned codes table
export const scannedCodes = pgTable('scanned_codes', {
  id: serial('id').primaryKey(),
  uuid: text('uuid').notNull().unique(),
  scannedBy: integer('scanned_by').notNull().references(() => users.id),
  productName: text('product_name'),
  productId: integer('product_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Local products table
export const localProducts = pgTable('local_products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  pointsValue: integer('points_value').notNull().default(50),
  active: integer('active').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
});

// Insert types using Zod
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true });
export const insertBadgeSchema = createInsertSchema(badges).omit({ id: true });
export const insertScannedCodeSchema = createInsertSchema(scannedCodes).omit({ id: true });
export const insertLocalProductSchema = createInsertSchema(localProducts).omit({ id: true });

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type Badge = typeof badges.$inferSelect;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;

export type ScannedCode = typeof scannedCodes.$inferSelect;
export type InsertScannedCode = z.infer<typeof insertScannedCodeSchema>;

export type LocalProduct = typeof localProducts.$inferSelect;
export type InsertLocalProduct = z.infer<typeof insertLocalProductSchema>;
```