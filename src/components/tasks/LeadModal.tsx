"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
// Clerk handles authentication automatically via cookies - no need for fetch

type Lead = { 
  phone: string; 
  name?: string | null; 
  source?: string | null; 
  stage?: string | null;
  email?: string | null;
  address?: string | null;
  alternateNumber?: string | null;
};

interface LeadModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
}

// Memoized event item component
const EventItem = React.memo(({ event, userNames }: { 
  event: any; 
  userNames: Map<string, string> 
}) => (
  <div className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg">
    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>                                                                                                                                                                                                                                                                                                                                                 
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-900">
          {event.type.replace(/_/g, ' ').toUpperCase()}
        </span>
        <span className="text-xs text-slate-500">
          {new Date(event.at).toLocaleString()}
        </span>
      </div>
      {event.actorId && (
        <div className="text-xs text-slate-600 mt-1">
          by {userNames.get(event.actorId) || event.actorId}
        </div>
      )}
      {event.data && Object.keys(event.data).length > 0 && (
        <div className="text-xs text-slate-600 mt-1">
          {JSON.stringify(event.data, null, 2)}
        </div>
      )}
    </div>
  </div>
));

export default function LeadModal({ lead, isOpen, onClose }: LeadModalProps) {
  const [leadDetails, setLeadDetails] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  
  // Edit fields state
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState<string>("");
  const [savingName, setSavingName] = useState(false);
  
  const [editingEmail, setEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState<string>("");
  const [savingEmail, setSavingEmail] = useState(false);
  
  const [editingAddress, setEditingAddress] = useState(false);
  const [editedAddress, setEditedAddress] = useState<string>("");
  const [savingAddress, setSavingAddress] = useState(false);
  
  const [editingAlternateNumber, setEditingAlternateNumber] = useState(false);
  const [editedAlternateNumber, setEditedAlternateNumber] = useState<string>("");
  const [savingAlternateNumber, setSavingAlternateNumber] = useState(false);

  // Memoized fetch functions
  const fetchUserNames = useCallback(async () => {
    try {
      const response = await fetch("/api/tl/users");
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.users) {
          const nameMap = new Map<string, string>();
          Object.entries(data.users).forEach(([code, name]) => {
            nameMap.set(code, name as string);
          });
          setUserNames(nameMap);
        }
      }
    } catch (error) {
      console.error("Failed to fetch user names:", error);
    }
  }, []);

  const fetchLeadDetails = useCallback(async () => {
    if (!lead?.phone) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/tl/leads?phone=${encodeURIComponent(lead.phone)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.leads.length > 0) {
          setLeadDetails(data.leads[0]);
          setEditedName(data.leads[0].name || "");
          setEditedEmail(data.leads[0].email || "");
          setEditedAddress(data.leads[0].address || "");
          setEditedAlternateNumber(data.leads[0].alternateNumber || "");
        }
      }
    } catch (error) {
      console.error("Failed to fetch lead details:", error);
    } finally {
      setLoading(false);
    }
  }, [lead?.phone]);

  const fetchEvents = useCallback(async () => {
    if (!lead?.phone) return;
    
    try {
      const response = await fetch(`/api/tl/leads/events?phone=${encodeURIComponent(lead.phone)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEvents(data.events || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  }, [lead?.phone]);

  useEffect(() => {
    if (lead && isOpen) {
      fetchLeadDetails();
      fetchUserNames();
      fetchEvents();
    }
  }, [lead, isOpen, fetchLeadDetails, fetchUserNames, fetchEvents]);

  // Memoized save functions
  const saveField = useCallback(async (field: string, value: string, setSaving: (saving: boolean) => void) => {
    if (!lead?.phone) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/tl/leads/${encodeURIComponent(lead.phone)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLeadDetails(data.lead);
        }
      }
    } catch (error) {
      console.error(`Failed to save ${field}:`, error);
    } finally {
      setSaving(false);
    }
  }, [lead?.phone]);

  // Memoized event list
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [events]);

  if (!lead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Lead Details</span>
            <Badge variant="outline">{lead.phone}</Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">View and edit lead details</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Lead Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Name</label>
                  {editingName ? (
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="flex-1"
                      />
                      <button
                        onClick={() => {
                          saveField('name', editedName, setSavingName);
                          setEditingName(false);
                        }}
                        disabled={savingName}
                        className="px-3 py-1 bg-primary text-white rounded text-sm"
                      >
                        {savingName ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingName(false)}
                        className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div 
                      className="mt-1 p-2 border rounded cursor-pointer hover:bg-slate-50"
                      onClick={() => setEditingName(true)}
                    >
                      {leadDetails?.name || 'Click to add name'}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  {editingEmail ? (
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="email"
                        value={editedEmail}
                        onChange={(e) => setEditedEmail(e.target.value)}
                        className="flex-1"
                      />
                      <button
                        onClick={() => {
                          saveField('email', editedEmail, setSavingEmail);
                          setEditingEmail(false);
                        }}
                        disabled={savingEmail}
                        className="px-3 py-1 bg-primary text-white rounded text-sm"
                      >
                        {savingEmail ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingEmail(false)}
                        className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div 
                      className="mt-1 p-2 border rounded cursor-pointer hover:bg-slate-50"
                      onClick={() => setEditingEmail(true)}
                    >
                      {leadDetails?.email || 'Click to add email'}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Address</label>
                  {editingAddress ? (
                    <div className="flex gap-2 mt-1">
                      <Textarea
                        value={editedAddress}
                        onChange={(e) => setEditedAddress(e.target.value)}
                        className="flex-1"
                        rows={3}
                      />
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => {
                            saveField('address', editedAddress, setSavingAddress);
                            setEditingAddress(false);
                          }}
                          disabled={savingAddress}
                          className="px-3 py-1 bg-primary text-white rounded text-sm"
                        >
                          {savingAddress ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingAddress(false)}
                          className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="mt-1 p-2 border rounded cursor-pointer hover:bg-slate-50 min-h-[80px]"
                      onClick={() => setEditingAddress(true)}
                    >
                      {leadDetails?.address || 'Click to add address'}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Alternate Number</label>
                  {editingAlternateNumber ? (
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={editedAlternateNumber}
                        onChange={(e) => setEditedAlternateNumber(e.target.value)}
                        className="flex-1"
                      />
                      <button
                        onClick={() => {
                          saveField('alternateNumber', editedAlternateNumber, setSavingAlternateNumber);
                          setEditingAlternateNumber(false);
                        }}
                        disabled={savingAlternateNumber}
                        className="px-3 py-1 bg-primary text-white rounded text-sm"
                      >
                        {savingAlternateNumber ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingAlternateNumber(false)}
                        className="px-3 py-1 bg-slate-200 text-slate-700 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div 
                      className="mt-1 p-2 border rounded cursor-pointer hover:bg-slate-50"
                      onClick={() => setEditingAlternateNumber(true)}
                    >
                      {leadDetails?.alternateNumber || 'Click to add alternate number'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Lead Status */}
            <div className="flex items-center gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Stage</label>
                <div className="mt-1">
                  <Badge variant="outline">{leadDetails?.stage || 'Unknown'}</Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Source</label>
                <div className="mt-1">
                  <Badge variant="secondary">{leadDetails?.source || 'Unknown'}</Badge>
                </div>
              </div>
            </div>

            {/* Activity Timeline */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Activity Timeline</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sortedEvents.length > 0 ? (
                  sortedEvents.map((event, index) => (
                    <EventItem key={index} event={event} userNames={userNames} />
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    No activity recorded yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}





