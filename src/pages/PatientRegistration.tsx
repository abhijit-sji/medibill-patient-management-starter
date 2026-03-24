import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Camera, Upload, CheckCircle2, Calendar } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function PatientRegistration() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const signatureRef = useRef<SignatureCanvas>(null);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: 'NY',
    zip: ''
  });
  const [insuranceCard, setInsuranceCard] = useState<File | null>(null);
  const [insuranceData, setInsuranceData] = useState({ carrier: '', memberId: '', groupNumber: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [tokenValid, setTokenValid] = useState(true);

  // Validate registration token on mount
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      validateToken(token);
    }
  }, [searchParams]);

  const validateToken = async (token: string) => {
    try {
      // Cast to bypass type checking since the DB schema has columns not in types.ts
      const { data, error } = await (supabase
        .from('kiosk_sessions' as any)
        .select('id, token, expires_at, appointment_id, patient_id, clinic_id, consent_signed, medical_history_completed')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle() as unknown as Promise<{ data: any; error: any }>);

      if (error || !data) {
        toast.error('Invalid or expired registration link');
        setTokenValid(false);
        return;
      }

      if (data.consent_signed === true || data.medical_history_completed === true) {
        toast.error('This registration link has already been used.');
        setTokenValid(false);
        return;
      }

      setSessionData(data);
      toast.success('Registration link validated successfully');
    } catch (err) {
      console.error('Token validation error:', err);
      toast.error('Failed to validate registration link');
      setTokenValid(false);
    }
  };

  const handleNext = () => {
    if (step === 2 && insuranceCard && !insuranceData.carrier) {
      // Simulate OCR processing
      setIsProcessing(true);
      const toastId = toast.loading('Processing insurance card...');
      setTimeout(() => {
        setInsuranceData({
          carrier: 'Blue Cross Blue Shield',
          memberId: 'AA1234567',
          groupNumber: 'GRP123456'
        });
        setIsProcessing(false);
        toast.dismiss(toastId);
        toast.success('Insurance information extracted!');
      }, 2000);
      return;
    }
    setStep(step + 1);
  };

  const handleComplete = async () => {
    setIsSaving(true);
    const token = searchParams.get('token');

    try {
      if (!token) {
        toast.error('Registration token is missing or invalid.');
        setIsSaving(false);
        return;
      }

      // Get signature data
      const signatureData = signatureRef.current?.toDataURL() || null;

      const { data, error } = await supabase.functions.invoke('complete-registration', {
        body: {
          token,
          firstName: formData.firstName,
          lastName: formData.lastName,
          dob: formData.dob,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          insuranceProvider: insuranceData.carrier,
          insuranceId: insuranceData.memberId,
          insuranceGroup: insuranceData.groupNumber,
          signatureData,
        },
      } as any);

      if (error || !data?.success) {
        console.error('Registration completion error:', error || data);
        toast.error(data?.error || 'Failed to complete registration');
        setIsSaving(false);
        return;
      }

      toast.success('Registration complete!');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      setStep(4);
    } catch (err) {
      console.error('Registration error:', err);
      toast.error('An error occurred during registration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToCalendar = () => {
    const event = {
      title: 'Dr. Rojas - Annual Physical',
      description: 'Annual Physical Examination at Rojas Family Practice',
      location: 'Rojas Family Practice',
      start: new Date('2025-03-20T15:30:00'),
      end: new Date('2025-03-20T16:30:00'),
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Rojas Family Practice//EN',
      'BEGIN:VEVENT',
      `DTSTART:${event.start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTEND:${event.end.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description}`,
      `LOCATION:${event.location}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'appointment.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Calendar event downloaded!');
  };

  const progress = (step / 3) * 100;

  // Show error if token is invalid
  if (!tokenValid && searchParams.get('token')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center space-y-4">
          <div className="text-destructive text-6xl">⚠️</div>
          <h2 className="text-2xl font-bold">Invalid Registration Link</h2>
          <p className="text-muted-foreground">
            This registration link is invalid or has expired. Please contact the clinic to request a new registration link.
          </p>
          <Button onClick={() => navigate('/')}>Go to Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold mb-2">Patient Registration</h1>
          <p className="text-muted-foreground">Complete your registration in 3 easy steps</p>
          {searchParams.get('token') && (
            <p className="text-muted-foreground text-sm mt-2">
              This link was sent to you by our clinic. It expires after you submit or in 72 hours.
            </p>
          )}
        </div>

        <Card className="p-8">
          <Progress value={progress} className="mb-8" />

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h2 className="text-2xl font-semibold mb-6">Personal Information</h2>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-1">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 col-span-1">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" value={formData.state} disabled />
                  </div>
                  <div className="space-y-2 col-span-1">
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input
                      id="zip"
                      value={formData.zip}
                      onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    />
                  </div>
                </div>

                <Button onClick={handleNext} className="w-full" size="lg">
                  Next: Insurance →
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-semibold mb-6">Insurance Information</h2>

                <div className="border-2 border-dashed border-border rounded-xl p-12 text-center space-y-4">
                  {!insuranceCard ? (
                    <>
                      <Upload className="h-16 w-16 mx-auto text-muted-foreground" />
                      <div>
                        <p className="font-medium">Upload Insurance Card</p>
                        <p className="text-sm text-muted-foreground">
                          Front and back of your insurance card
                        </p>
                      </div>
                      <div className="flex gap-3 justify-center">
                        <Button
                          variant="outline"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e: any) => {
                              setInsuranceCard(e.target.files[0]);
                              toast.success('Insurance card uploaded');
                            };
                            input.click();
                          }}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Choose File
                        </Button>
                        <Button variant="outline">
                          <Camera className="h-4 w-4 mr-2" />
                          Take Photo
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <CheckCircle2 className="h-16 w-16 mx-auto text-success" />
                      <p className="font-medium">Insurance card uploaded!</p>
                      {isProcessing && (
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                          <span className="text-sm">Extracting information...</span>
                        </div>
                      )}
                      {insuranceData.carrier && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-success/10 p-4 rounded-lg text-left"
                        >
                          <p className="text-sm font-medium mb-2">Extracted Information:</p>
                          <div className="space-y-1 text-sm">
                            <p>Carrier: {insuranceData.carrier}</p>
                            <p>Member ID: {insuranceData.memberId}</p>
                            <p>Group #: {insuranceData.groupNumber}</p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2 text-left">
                    <p className="text-sm font-medium">Or enter insurance details manually</p>
                    <p className="text-xs text-muted-foreground">
                      If you prefer not to upload a card, you can type your insurance information below.
                    </p>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4 text-left">
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="insurance-carrier">Carrier</Label>
                      <Input
                        id="insurance-carrier"
                        value={insuranceData.carrier}
                        onChange={(e) =>
                          setInsuranceData((prev) => ({ ...prev, carrier: e.target.value }))
                        }
                        placeholder="e.g. Blue Cross Blue Shield"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="insurance-memberId">Member ID</Label>
                      <Input
                        id="insurance-memberId"
                        value={insuranceData.memberId}
                        onChange={(e) =>
                          setInsuranceData((prev) => ({ ...prev, memberId: e.target.value }))
                        }
                        placeholder="e.g. AA1234567"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="insurance-groupNumber">Group #</Label>
                      <Input
                        id="insurance-groupNumber"
                        value={insuranceData.groupNumber}
                        onChange={(e) =>
                          setInsuranceData((prev) => ({ ...prev, groupNumber: e.target.value }))
                        }
                        placeholder="e.g. GRP123456"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                    ← Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={
                      isProcessing ||
                      (!insuranceCard &&
                        !insuranceData.carrier &&
                        !insuranceData.memberId &&
                        !insuranceData.groupNumber)
                    }
                    className="flex-1"
                  >
                    {insuranceData.carrier || insuranceData.memberId || insuranceData.groupNumber
                      ? 'Next: Review →'
                      : 'Process Card'}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-semibold mb-6">Review & Sign</h2>

                <div className="bg-muted/50 p-6 rounded-lg space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Personal Information</h3>
                    <p className="text-sm">
                      {formData.firstName} {formData.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{formData.email}</p>
                    <p className="text-sm text-muted-foreground">{formData.phone}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Insurance</h3>
                    <p className="text-sm">{insuranceData.carrier}</p>
                    <p className="text-sm text-muted-foreground">
                      Member ID: {insuranceData.memberId}
                    </p>
                  </div>
                </div>

                <div>
                  <Label>Electronic Signature</Label>
                  <div className="border-2 border-border rounded-lg mt-2">
                    <SignatureCanvas
                      ref={signatureRef}
                      canvasProps={{
                        className: 'w-full h-40 rounded-lg',
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    By signing above, you acknowledge that the information provided is accurate.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => setStep(2)} variant="outline" className="flex-1" disabled={isSaving}>
                    ← Back
                  </Button>
                  <Button onClick={handleComplete} className="flex-1" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Complete Registration'}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12 space-y-6"
              >
                <CheckCircle2 className="h-24 w-24 mx-auto text-success" />
                <p className="text-muted-foreground">Thank you for registering with us. An Agent will contact you shortly.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </div>
  );
}
