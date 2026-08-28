import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Bot, 
  Send, 
  User, 
  Mail, 
  MapPin, 
  FileText, 
  AlertTriangle, 
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { createRequest } from '../services/api';
import FormField from '../components/ui/FormField';

export default function ReportIssuePage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    requesterName: '',
    requesterEmail: '',
    location: '',
    description: ''
  });

  const [errors, setErrors] = useState({
    requesterName: '',
    requesterEmail: '',
    location: '',
    description: ''
  });

  const [touched, setTouched] = useState({
    requesterName: false,
    requesterEmail: false,
    location: false,
    description: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Email format validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateField = (name, value) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';

    switch (name) {
      case 'requesterName':
        if (!trimmed) {
          return 'Please enter your name.';
        }
        if (trimmed.length < 2) {
          return 'Name must contain at least 2 characters.';
        }
        return '';

      case 'requesterEmail':
        if (!trimmed) {
          return 'Please enter your email address.';
        }
        if (!emailRegex.test(trimmed)) {
          return 'Please enter a valid email address (e.g. name@campus.edu).';
        }
        return '';

      case 'location':
        if (!trimmed) {
          return 'Please provide the location of the issue.';
        }
        return '';

      case 'description':
        if (!trimmed) {
          return 'Please describe the issue.';
        }
        if (trimmed.length < 10) {
          return `Description must contain at least 10 characters (${trimmed.length}/10).`;
        }
        return '';

      default:
        return '';
    }
  };

  const validateAll = (data = formData) => {
    const newErrors = {
      requesterName: validateField('requesterName', data.requesterName),
      requesterEmail: validateField('requesterEmail', data.requesterEmail),
      location: validateField('location', data.location),
      description: validateField('description', data.description)
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(err => err.length > 0);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (serverError) setServerError('');

    if (touched[name] || submitAttempted) {
      const errorMsg = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: errorMsg }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const errorMsg = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: errorMsg }));
  };

  const handleQuickFill = (preset) => {
    setFormData({
      requesterName: preset.requesterName,
      requesterEmail: preset.requesterEmail,
      location: preset.location,
      description: preset.description
    });
    setErrors({
      requesterName: '',
      requesterEmail: '',
      location: '',
      description: ''
    });
    setTouched({
      requesterName: true,
      requesterEmail: true,
      location: true,
      description: true
    });
    setServerError('');
    setSubmitAttempted(false);
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting) return; // Prevent double clicks

    setSubmitAttempted(true);
    setServerError('');

    setTouched({
      requesterName: true,
      requesterEmail: true,
      location: true,
      description: true
    });

    const isValid = validateAll();
    if (!isValid) return;

    setIsSubmitting(true);

    try {
      const response = await createRequest(formData);
      if (response && response.success && response.data) {
        // Programmatically navigate to dedicated success route passing real response data
        navigate(`/report/success/${response.data.id}`, { 
          state: { data: response.data } 
        });
      } else {
        setServerError(response?.message || 'Unable to process your report. Please try again.');
        setIsSubmitting(false);
      }
    } catch (err) {
      setServerError(err.message || 'Unable to connect to ResolveAI. Please verify the backend service is reachable.');
      setIsSubmitting(false);
    }
  };

  const presets = [
    {
      label: 'Water pipe leak',
      requesterName: 'Sarah Connor',
      requesterEmail: 'sarah.c@campus.edu',
      location: 'Hostel Block B Room 302',
      description: 'Major water leakage from bathroom ceiling pipe. Water is accumulating rapidly across the floor.'
    },
    {
      label: 'AC unit failure',
      requesterName: 'Alice Green',
      requesterEmail: 'alice.g@campus.edu',
      location: 'Hostel Block A Room 101',
      description: 'Air conditioning cooling compressor failed. Unit is vibrating loudly and blowing warm air.'
    },
    {
      label: 'Projector display issue',
      requesterName: 'Charlie Brown',
      requesterEmail: 'charlie.b@campus.edu',
      location: 'Academic Block 3 Lab 202',
      description: 'Overhead classroom optical projector display is flickering continuously with severe video distortion.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Minimal Header */}
      <header className="sticky top-0 z-40 bg-[#0b0f17]/90 border-b border-slate-800/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to home</span>
          </Link>

          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bot className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-white">Resolve<span className="text-indigo-400">AI</span></span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Report an issue
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
            Share the details below and we'll route your request to the right team.
          </p>
        </div>

        {/* Quick Sample Presets */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-medium text-slate-400">
            Quick fill with sample issues:
          </span>
          <div className="flex flex-wrap gap-2">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleQuickFill(p)}
                className="px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-rose-200 block font-semibold">Unable to submit report</strong>
                <span className="text-xs text-rose-300/90">{serverError}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-3 py-1 rounded-md bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 text-xs font-medium transition-colors cursor-pointer shrink-0"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Main Form Container */}
        <form onSubmit={handleSubmit} noValidate className="space-y-8">
          
          {/* Section 1: Your details */}
          <div className="surface-card p-6 sm:p-7 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">
                Your details
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                We'll use this information to keep you updated on progress.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                id="requesterName"
                name="requesterName"
                label="Your name"
                required={true}
                type="text"
                disabled={isSubmitting}
                value={formData.requesterName}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. Sarah Connor"
                error={errors.requesterName}
                icon={User}
              />

              <FormField
                id="requesterEmail"
                name="requesterEmail"
                label="Email address"
                required={true}
                type="email"
                disabled={isSubmitting}
                value={formData.requesterEmail}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. sarah.c@campus.edu"
                error={errors.requesterEmail}
                icon={Mail}
              />
            </div>
          </div>

          {/* Section 2: Issue details */}
          <div className="surface-card p-6 sm:p-7 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">
                Issue details
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Describe where and what happened so we can dispatch the right technicians.
              </p>
            </div>

            <div className="space-y-4">
              <FormField
                id="location"
                name="location"
                label="Where is the issue?"
                required={true}
                type="text"
                disabled={isSubmitting}
                value={formData.location}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g. Hostel Block B Room 302 or Main Library 2nd Floor"
                error={errors.location}
                icon={MapPin}
              />

              <FormField
                id="description"
                name="description"
                label="What happened?"
                required={true}
                isTextarea={true}
                rows={5}
                disabled={isSubmitting}
                value={formData.description}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Describe the issue, when you noticed it, and anything else that may help us understand it."
                error={errors.description}
                icon={FileText}
                counter={`${formData.description.trim().length} characters`}
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
                isSubmitting
                  ? 'bg-indigo-600/70 text-indigo-200 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-indigo-600/25 hover:shadow-indigo-600/40 cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Submitting your report...</span>
                </>
              ) : (
                <>
                  <span>Submit issue</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-500">
              ResolveAI will automatically categorize, prioritize, and assign your request upon submission.
            </p>
          </div>

        </form>

      </main>

      {/* Footer */}
      <footer className="bg-[#0b0f17] border-t border-slate-800/80 px-6 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>ResolveAI &mdash; AI-Powered Request Resolution</span>
          </div>
          <Link to="/" className="text-slate-400 hover:text-white transition-colors">
            Return to Homepage
          </Link>
        </div>
      </footer>

    </div>
  );
}
