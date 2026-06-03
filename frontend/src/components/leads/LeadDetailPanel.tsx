'use client';

import React, { useState } from 'react';
import { Lead } from '@/types';
import { leadsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  X,
  Sparkles,
  Search,
  Globe,
  Phone,
  Mail,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Award,
  CircleDollarSign,
  Lightbulb,
  CheckCircle,
  Clock,
  ExternalLink,
  RefreshCcw,
  Check
} from 'lucide-react';

interface LeadDetailPanelProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onEnrichComplete?: (updatedLead: Lead) => void;
}

export function LeadDetailPanel({ lead, isOpen, onClose, onEnrichComplete }: LeadDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'value' | 'pitch'>('overview');
  const [enriching, setEnriching] = useState(false);

  if (!isOpen || !lead) return null;

  const handleManualEnrich = async () => {
    setEnriching(true);
    try {
      const response = await leadsApi.enrich(lead._id);
      if (response.data?.success && response.data?.data?.lead) {
        if (onEnrichComplete) {
          onEnrichComplete(response.data.data.lead);
        }
      }
    } catch (err) {
      console.error('Failed to manually enrich lead:', err);
      alert('Failed to enrich lead. Please make sure GEMINI_API_KEY is configured in backend .env.');
    } finally {
      setEnriching(false);
    }
  };

  const getQualBadgeColor = (status?: string) => {
    switch (status) {
      case 'HOT': return 'bg-rose-500 hover:bg-rose-600 text-white';
      case 'WARM': return 'bg-amber-500 hover:bg-amber-600 text-white';
      case 'COLD': return 'bg-blue-500 hover:bg-blue-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getValidationBadge = (value?: string, label?: string) => {
    const configs: Record<string, { color: string; icon: React.ReactNode }> = {
      valid: { color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
      suspicious: { color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
      invalid: { color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: <X className="h-3.5 w-3.5" /> },
      missing: { color: 'bg-gray-500/10 text-gray-500 border-gray-500/20', icon: <Clock className="h-3.5 w-3.5" /> },
    };
    const current = configs[value || 'missing'] || configs.missing;
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${current.color}`}>
        {current.icon}
        {label}: <span className="capitalize">{value || 'missing'}</span>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity animate-fadeIn" 
        onClick={onClose}
      />
      
      {/* Side Panel */}
      <div className="fixed inset-y-0 right-0 max-w-2xl w-full bg-white dark:bg-gray-950 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-out translate-x-0 border-l border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between bg-gradient-to-r from-indigo-50/50 via-transparent to-transparent">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {lead.businessName || lead.fullName || 'Business Details'}
              </h2>
              {lead.qualificationStatus && (
                <Badge className={getQualBadgeColor(lead.qualificationStatus)}>
                  {lead.qualificationStatus} LEAD
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <span className="font-medium text-indigo-600 dark:text-indigo-400 capitalize">
                {(typeof lead.source === 'object' ? lead.source.platform : lead.source || '').replace('_', ' ')}
              </span>
              {lead.city && (
                <>
                  <span>•</span>
                  <span>{lead.city}, {lead.state || lead.country || 'India'}</span>
                </>
              )}
              {lead.rating && (
                <>
                  <span>•</span>
                  <span className="text-yellow-600 dark:text-yellow-400 font-semibold flex items-center gap-0.5">
                    ★ {lead.rating} ({lead.reviewCount || 0} reviews)
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualEnrich}
              disabled={enriching}
              className="flex items-center gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-400"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${enriching ? 'animate-spin' : ''}`} />
              {enriching ? 'Analyzing...' : 'Enrich AI'}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Validation Bar */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex gap-2 flex-wrap">
          {getValidationBadge(lead.validation?.email, 'Email')}
          {getValidationBadge(lead.validation?.phone, 'Phone')}
          {getValidationBadge(lead.validation?.website, 'Website')}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/20 px-6">
          {[
            { id: 'overview', label: 'AI Overview', icon: <Sparkles className="h-4 w-4" /> },
            { id: 'audit', label: 'Website Audit', icon: <Globe className="h-4 w-4" /> },
            { id: 'value', label: 'Score & Est. Value', icon: <CircleDollarSign className="h-4 w-4" /> },
            { id: 'pitch', label: 'Sales Playbook', icon: <Lightbulb className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Award className="h-5 w-5 text-indigo-500" />
                  Executive Summary
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  {lead.aiSummary || 'No summary available. Click "Enrich AI" to query Gemini.'}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-500" />
                  Opportunity Report
                </h3>
                <div className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 whitespace-pre-line">
                  {lead.aiOpportunityReport || 'Audit opportunity details pending Gemini enrichment.'}
                </div>
              </div>

              {lead.aiRecommendations && lead.aiRecommendations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Key Recommendations</h3>
                  <div className="grid gap-2">
                    {lead.aiRecommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2.5 bg-indigo-50/20 p-3 rounded-lg border border-indigo-500/10 text-sm">
                        <CheckCircle className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                        <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Website Audit Tab */}
          {activeTab === 'audit' && (
            <div className="space-y-6 animate-fadeIn">
              {lead.website ? (
                <>
                  {/* Website URL Block */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase">Website Url</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{lead.website}</p>
                    </div>
                    <a
                      href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 text-indigo-600"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  {/* Qualitative Audit Grades */}
                  {lead.websiteAnalysis ? (
                    <>
                      {/* Overall Grade Card */}
                      <div className="grid grid-cols-3 gap-4 items-center bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl text-white shadow-xl shadow-indigo-500/15">
                        <div className="col-span-2">
                          <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Website Audit</p>
                          <p className="text-2xl font-bold mt-1">Audit Score</p>
                          <p className="text-xs text-white/80 mt-2">Quantitative & qualitative audit grades aggregated by Gemini.</p>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                          <div className="h-20 w-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-4xl font-black">
                            {lead.websiteAnalysis.overallGrade}
                          </div>
                        </div>
                      </div>

                      {/* Grades Grid */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        {[
                          { label: 'Mobile Responsiveness', val: lead.websiteAnalysis.mobileResponsiveness },
                          { label: 'Design Modernity', val: lead.websiteAnalysis.designModernity },
                          { label: 'UI Quality', val: lead.websiteAnalysis.uiQuality },
                          { label: 'UX/Navigation', val: lead.websiteAnalysis.uxQuality },
                          { label: 'Loading Speed', val: lead.websiteAnalysis.loadingSpeed },
                          { label: 'SEO Readiness', val: lead.websiteAnalysis.seoReadiness },
                          { label: 'CTA Effectiveness', val: lead.websiteAnalysis.ctaEffectiveness },
                          { label: 'Trust & Proof Signals', val: lead.websiteAnalysis.trustSignals },
                        ].map((stat, i) => (
                          <div key={i} className="p-3 border border-gray-100 dark:border-gray-800 rounded-lg flex justify-between items-center text-sm">
                            <span className="text-gray-500 font-medium">{stat.label}</span>
                            <span className="font-bold text-gray-900 dark:text-gray-100 capitalize">{stat.val}</span>
                          </div>
                        ))}
                      </div>

                      {/* Issues Checklist */}
                      {lead.websiteAnalysis.detectedIssues && lead.websiteAnalysis.detectedIssues.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-bold text-gray-900 dark:text-gray-100">Audit Flags & Opportunities</h4>
                          <div className="grid gap-2">
                            {lead.websiteAnalysis.detectedIssues.map((issue) => (
                              <div key={issue} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                <span className="font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                                  {issue.replace('_', ' ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-10 text-gray-400">
                      Website URL is logged, but audit data has not been enrichment. Click "Enrich AI" to load.
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-16 space-y-4">
                  <Globe className="h-12 w-12 text-gray-300 mx-auto" />
                  <div className="max-w-md mx-auto space-y-1">
                    <p className="font-bold text-gray-900 dark:text-gray-100">No website discovered</p>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      This lead is missing an online site. This is a top redesign/website creation opportunity for web development agencies!
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scores & Project Value Tab */}
          {activeTab === 'value' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Scores Grid */}
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                {[
                  { label: 'Lead Score', val: lead.leadScore, color: 'text-indigo-500 bg-indigo-500/5 border-indigo-500/15' },
                  { label: 'Agency Fit', val: lead.agencyFitScore, color: 'text-emerald-500 bg-emerald-500/5 border-emerald-500/15' },
                  { label: 'Opportunity', val: lead.opportunityScore, color: 'text-cyan-500 bg-cyan-500/5 border-cyan-500/15' },
                  { label: 'AI Confidence', val: lead.confidenceScore, color: 'text-purple-500 bg-purple-500/5 border-purple-500/15' },
                ].map((score, i) => (
                  <div key={i} className={`p-4 border rounded-xl flex flex-col items-center justify-center text-center ${score.color}`}>
                    <span className="text-3xl font-black">{score.val !== undefined ? `${score.val}` : '--'}</span>
                    <span className="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-wider">{score.label}</span>
                  </div>
                ))}
              </div>

              {/* Project Value Estimate */}
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CircleDollarSign className="h-5 w-5 text-indigo-500" />
                  Estimated Service Values (INR)
                </h3>
                {lead.estimatedProjectValue ? (
                  <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 dark:bg-gray-900 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Service Opportunity</th>
                          <th className="px-4 py-3 text-right">Value Range (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-850">
                        <tr>
                          <td className="px-4 py-3.5 font-medium text-gray-700 dark:text-gray-300">Website Redesign / Dev</td>
                          <td className="px-4 py-3.5 text-right font-semibold text-gray-900 dark:text-gray-100">
                            {lead.estimatedProjectValue.websiteDevelopment || '₹30,000 - ₹75,000'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3.5 font-medium text-gray-700 dark:text-gray-300">Search Engine Optimization (SEO)</td>
                          <td className="px-4 py-3.5 text-right font-semibold text-gray-900 dark:text-gray-100">
                            {lead.estimatedProjectValue.seo || 'N/A'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3.5 font-medium text-gray-700 dark:text-gray-300">Branding & Corporate Identity</td>
                          <td className="px-4 py-3.5 text-right font-semibold text-gray-900 dark:text-gray-100">
                            {lead.estimatedProjectValue.branding || 'N/A'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3.5 font-medium text-gray-700 dark:text-gray-300">Automation Workflows</td>
                          <td className="px-4 py-3.5 text-right font-semibold text-gray-900 dark:text-gray-100">
                            {lead.estimatedProjectValue.automation || 'N/A'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3.5 font-medium text-gray-700 dark:text-gray-300">AI Agents & CRM Integration</td>
                          <td className="px-4 py-3.5 text-right font-semibold text-gray-900 dark:text-gray-100">
                            {lead.estimatedProjectValue.aiIntegration || 'N/A'}
                          </td>
                        </tr>
                        <tr className="bg-indigo-500/5 font-bold">
                          <td className="px-4 py-4 text-indigo-700 dark:text-indigo-400">Total Account Pipeline (Est)</td>
                          <td className="px-4 py-4 text-right text-indigo-700 dark:text-indigo-400">
                            {lead.estimatedProjectValue.totalMin !== undefined && lead.estimatedProjectValue.totalMax !== undefined
                              ? `₹${lead.estimatedProjectValue.totalMin.toLocaleString('en-IN')} - ₹${lead.estimatedProjectValue.totalMax.toLocaleString('en-IN')}`
                              : '₹40,000 - ₹1,50,000'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl">
                    Service pricing estimations pending Gemini enrichment.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sales playbook Tab */}
          {activeTab === 'pitch' && (
            <div className="space-y-6 animate-fadeIn">
              
              <div className="space-y-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">Outreach angle Summary</h4>
                <div className="p-4 bg-indigo-50/20 rounded-xl border border-indigo-500/10 text-sm leading-relaxed text-indigo-900 dark:text-indigo-300 font-medium">
                  {lead.outreachSummary || 'Outreach summaries are generated during Gemini lead evaluation.'}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">Sales Script Pitch</h4>
                <div className="p-4 bg-gray-900 text-gray-100 font-mono rounded-xl border border-gray-800 text-xs leading-relaxed whitespace-pre-line relative group">
                  <div className="absolute top-2 right-2 text-gray-500 group-hover:text-gray-400 cursor-pointer">
                    {/* Copy feature */}
                  </div>
                  {lead.recommendedPitch || 'Recommended elevator pitches are generated by AI analysis.'}
                </div>
              </div>

              {lead.painPointsDetailed && lead.painPointsDetailed.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">Identified Pain Points</h4>
                  <div className="grid gap-2">
                    {lead.painPointsDetailed.map((point, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <X className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lead.serviceRecommendations && lead.serviceRecommendations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">Pitch Services checklist</h4>
                  <div className="grid gap-2">
                    {lead.serviceRecommendations.map((service, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{service}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </>
  );
}
