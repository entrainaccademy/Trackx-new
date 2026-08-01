"use client";

import { useRef, useState, useEffect, useCallback, startTransition } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
// Clerk handles authentication automatically via cookies - no need for fetch
import { normalizeCsvToUtf8 } from "@/utils/normalizeCsvToUtf8";

export function AddLeadModal({ open, onClose, onCreated, onListCreated }: { open: boolean; onClose: () => void; onCreated: () => void; onListCreated?: (list: { id: number; name: string }) => void }) {
  const [form, setForm] = useState<{ phone: string; name?: string; email?: string; address?: string; alternateNumber?: string; source?: string; stage?: string; score?: number; notes?: string; ownerId?: string }>({ phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [lists, setLists] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);
  const [salesUsers, setSalesUsers] = useState<Array<{ id: number; code: string; name: string; email: string }>>([]);

  // Load lists and sales users when modal opens
  useEffect(() => {
    if (open) {
      fetch("/api/tl/lists")
        .then((r) => r.json())
        .then((d) => setLists(d?.rows || []))
        .catch(() => {});

      fetch("/api/users?role=sales")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setSalesUsers(data);
          }
        })
        .catch(() => {});
    }
  }, [open]);

  const createNewList = async () => {
    if (!newListName.trim()) return;
    try {
      setCreatingList(true);
      const res = await fetch("/api/tl/lists", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ name: newListName }) 
      });
      const data = await res.json();
      if (res.ok && data?.list) {
        const newList = data.list;
        startTransition(() => {
          setLists(prev => {
            const updated = [...prev, newList];
            console.log("Updated lists state:", updated);
            return updated;
          });
          setSelectedListId(String(newList.id));
        });
        setShowCreateList(false);
        setNewListName("");
        
        // Notify parent component about the new list
        if (onListCreated) {
          onListCreated(newList);
        }
        
        // Force a small delay to ensure React processes the state update
        setTimeout(() => {
          console.log("Lists after timeout:", lists);
        }, 100);
      }
    } catch {
      toast.error("Failed to create list");
    } finally {
      setCreatingList(false);
    }
  };

  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Lead</DialogTitle>
          <DialogDescription className="sr-only">Add a new lead to your system</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Phone (required)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Alternate Number (optional)" value={form.alternateNumber || ""} onChange={(e) => setForm({ ...form, alternateNumber: e.target.value })} />
          <Textarea 
            placeholder="Address (optional)" 
            value={form.address || ""} 
            onChange={(e) => setForm({ ...form, address: e.target.value })} 
            rows={2}
            className="resize-none"
          />
          <Input placeholder="Source" value={form.source || ""} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          <Textarea 
            placeholder="Notes (optional)" 
            value={form.notes || ""} 
            onChange={(e) => setForm({ ...form, notes: e.target.value })} 
            rows={3}
            className="resize-none"
          />
          
          {/* Owner / Assign To Sales Member */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Assign To (Sales Member)</label>
            <select
              value={form.ownerId || ""}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">Unassigned</option>
              {salesUsers.map((user) => (
                <option key={user.code || user.email} value={user.code || user.email}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {/* List Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Add to List</label>
            <div className="flex gap-2">
              <select
                key={`list-select-${lists.map(l => l.id).join('-')}-${selectedListId}`}
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No list</option>
                {lists.map((list) => (
                  <option key={list.id} value={String(list.id)}>
                    {list.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                onClick={() => setShowCreateList(true)}
                variant="outline"
                size="sm"
              >
                New
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={submitting || !form.phone.trim()}
            onClick={async () => {
              setSubmitting(true);
              const payload: any = { ...form };
              if (selectedListId) {
                payload.listId = Number(selectedListId);
              }
              const res = await fetch("/api/tl/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
              if (res.ok) toast.success("Lead added"); else toast.error("Failed to add lead");
              setSubmitting(false);
              onCreated();
              onClose();
            }}
          >
            {submitting ? "Adding..." : "Add Lead"}
          </Button>
        </div>
      </DialogContent>

      {/* Create New List Modal */}
      <Dialog open={showCreateList} onOpenChange={(open) => { if (!open) { setShowCreateList(false); setNewListName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription className="text-sm text-gray-600">Give your list a name.</DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <Input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="e.g. Hot leads"
            />
          </div>
          <div className="mt-6 flex items-center justify-end gap-2">
            <Button 
              variant="ghost"
              onClick={() => {
                setShowCreateList(false);
                setNewListName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={createNewList}
              disabled={creatingList || !newListName.trim()}
            >
              {creatingList ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// Available form fields for mapping
const FORM_FIELDS = [
  { key: 'phone', label: 'Phone Number', required: true, description: 'Primary identifier for the lead' },
  { key: 'name', label: 'Full Name', required: false, description: 'Lead\'s full name' },
  { key: 'email', label: 'Email Address', required: false, description: 'Lead\'s email address' },
  { key: 'address', label: 'Address', required: false, description: 'Lead\'s address' },
  { key: 'alternateNumber', label: 'Alternate Number', required: false, description: 'Alternative phone number' },
  { key: 'source', label: 'Lead Source', required: false, description: 'Where the lead came from' },
  { key: 'stage', label: 'Lead Stage', required: false, description: 'Current stage in sales process' },
  { key: 'score', label: 'Lead Score', required: false, description: 'Numerical score for lead quality' },
  { key: 'consent', label: 'Marketing Consent', required: false, description: 'Whether lead consented to marketing' },
  { key: 'utm', label: 'UTM Parameters', required: false, description: 'Campaign tracking parameters' },
  { key: 'owner', label: 'Owner', required: false, description: 'Assign to salesperson by email (preferred) or code' },
  { key: 'notes', label: 'Notes', required: false, description: 'Additional notes or comments about the lead' }
];

export function ImportLeadsModal({ open, onClose, onImported, onListCreated }: { open: boolean; onClose: () => void; onImported: () => void; onListCreated?: (list: { id: number; name: string }) => void }) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [fileData, setFileData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [mappedData, setMappedData] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  
  // List selection state
  const [lists, setLists] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  // Load lists when modal opens
  useEffect(() => {
    if (open) {
      fetch("/api/tl/lists")
        .then((r) => r.json())
        .then((d) => setLists(d?.rows || []))
        .catch(() => {});
    }
  }, [open]);

  const createNewList = async () => {
    if (!newListName.trim()) return;
    try {
      setCreatingList(true);
      const res = await fetch("/api/tl/lists", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ name: newListName }) 
      });
      const data = await res.json();
      if (res.ok && data?.list) {
        const newList = data.list;
        startTransition(() => {
          setLists(prev => {
            const updated = [...prev, newList];
            console.log("Updated lists state:", updated);
            return updated;
          });
          setSelectedListId(String(newList.id));
        });
        setShowCreateList(false);
        setNewListName("");
        
        // Notify parent component about the new list
        if (onListCreated) {
          onListCreated(newList);
        }
        
        // Force a small delay to ensure React processes the state update
        setTimeout(() => {
          console.log("Lists after timeout:", lists);
        }, 100);
      }
    } catch {
      toast.error("Failed to create list");
    } finally {
      setCreatingList(false);
    }
  };
  
  if (!open) return null;
  



  // Normalize phone: extract first numeric sequence with >=10 digits, strip non-digits, cap to 15 digits
  const normalizePhone = (value: any): string | null => {
    if (value === null || value === undefined) return null;
    const raw = String(value);
    // Replace non-ASCII spaces and weird unicode chars
    const cleaned = raw.replace(/[\u00A0\u2000-\u200F\u2028-\u202F\u205F\u3000]/g, ' ');
    // If multiple numbers separated by non-digits/commas etc, find the first run of digits with length >= 10
    const digitRuns = cleaned.match(/\d{10,}/g);
    if (!digitRuns || digitRuns.length === 0) return null;
    let digits = digitRuns[0];
    // Cap overly long sequences to last 15 digits to fit typical E.164 max length and DB limits
    if (digits.length > 15) {
      digits = digits.slice(-15);
    }
    return digits;
  };

  const resetForm = () => {
    setStep('upload');
    setFileData([]);
    setColumnMapping({});
    setMappedData([]);
    setError("");
    setValidationErrors([]);
    setSelectedListId("");
    setShowCreateList(false);
    setNewListName("");
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    try {
      setError("");
      setValidationErrors([]);
  
      const fileName = file.name.toLowerCase();
      let wb: XLSX.WorkBook;
  
      if (fileName.endsWith(".csv")) {
        // 🔹 CSV path – normalize to UTF-8 text
        const csvText = await normalizeCsvToUtf8(file);
  
        wb = XLSX.read(csvText, {
          type: "string",
          // If your CSV is actually tab-separated (TSV), uncomment this:
          // FS: "\t",
        });
      } else {
        // 🔹 Excel (.xlsx, .xlsb, etc.) path – use ArrayBuffer
        const data = await file.arrayBuffer();
        wb = XLSX.read(data, { type: "array" });
      }
  
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
  
      if (!Array.isArray(json) || json.length === 0) {
        setError("Invalid file format or empty file");
        return;
      }
  
      setFileData(json);
      setStep("mapping");
    } catch (error) {
      console.error("File upload error:", error);
      setError("Failed to read file. Please ensure it's a valid CSV or Excel file.");
    }
  };

  const getAvailableColumns = () => {
    if (fileData.length === 0) return [];
    return Object.keys(fileData[0]);
  };

  const handleMappingChange = (formField: string, csvColumn: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [formField]: csvColumn
    }));
  };

  const autoMapColumns = () => {
    const availableColumns = getAvailableColumns();
    const mapping: Record<string, string> = {};
    
    availableColumns.forEach(csvCol => {
      const csvColLower = csvCol.toLowerCase();
      
      // Try to find exact matches first
      FORM_FIELDS.forEach(field => {
        if (csvColLower === field.key.toLowerCase() || 
            csvColLower.includes(field.key.toLowerCase()) ||
            field.key.toLowerCase().includes(csvColLower)) {
          mapping[field.key] = csvCol;
        }
      });
      
      // Handle common variations
      if (csvColLower.includes('phone') || csvColLower.includes('mobile') || csvColLower.includes('cell')) {
        if (!mapping['phone']) {
          mapping['phone'] = csvCol;
        } else if (csvColLower.includes('alternate') || csvColLower.includes('alt') || csvColLower.includes('secondary')) {
          mapping['alternateNumber'] = csvCol;
        }
      }
      if (csvColLower.includes('first') || csvColLower.includes('last') || csvColLower.includes('full')) {
        mapping['name'] = csvCol;
      }
      if (csvColLower.includes('mail')) {
        mapping['email'] = csvCol;
      }
      if (csvColLower.includes('address') || csvColLower.includes('location') || csvColLower.includes('street')) {
        mapping['address'] = csvCol;
      }
      if (csvColLower.includes('source') || csvColLower.includes('origin') || csvColLower.includes('campaign')) {
        mapping['source'] = csvCol;
      }
      if (csvColLower.includes('stage') || csvColLower.includes('status') || csvColLower.includes('phase')) {
        mapping['stage'] = csvCol;
      }
      if (csvColLower.includes('score') || csvColLower.includes('rating') || csvColLower.includes('priority')) {
        mapping['score'] = csvCol;
      }
    });
    
    setColumnMapping(mapping);
  };

  const validateMapping = () => {
    const errors: string[] = [];
    
    if (!columnMapping.phone) {
      errors.push("Phone number column mapping is required");
    }
    
    return errors;
  };

  const proceedToPreview = () => {
    const errors = validateMapping();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    // Map the data according to the column mapping
    const mapped = fileData.map(row => {
      const mappedRow: any = {};
      
      Object.entries(columnMapping).forEach(([formField, csvColumn]) => {
        if (csvColumn && row[csvColumn] !== undefined) {
          let value = row[csvColumn];
          
          // Handle special cases
          if (formField === 'phone') {
            value = String(value).trim();
          } else if (formField === 'score') {
            value = Number(value) || 0;
          } else if (formField === 'consent') {
            value = Boolean(value);
          } else if (formField === 'utm') {
            // Try to parse UTM as JSON or create from individual columns
            try {
              value = typeof value === 'string' ? JSON.parse(value) : value;
            } catch {
              value = null;
            }
          }
          
          mappedRow[formField] = value;
        }
      });
      
      return mappedRow;
    });
    
    setMappedData(mapped);
    // Run data validation now so we can show errors and disable Import button
    const dataErrors = validateMappedData(mapped);
    setValidationErrors(dataErrors);
    setStep('preview');
  };

  const validateMappedData = (data: any[]) => {
    const errors: string[] = [];
    
    if (data.length === 0) {
      errors.push("No data to import");
      return errors;
    }
    
    // Check for required phone numbers
    const rowsWithPhone = data.filter(row => row.phone && String(row.phone).trim());
    if (rowsWithPhone.length === 0) {
      errors.push("No valid phone numbers found after mapping");
    }
    
    // Normalize all phones for validation
    const normalized = rowsWithPhone.map(row => normalizePhone(row.phone)).filter(Boolean) as string[];
    // Check for duplicate phone numbers after normalization
    const uniquePhones = new Set(normalized);
    if (normalized.length !== uniquePhones.size) {
      const duplicateCount = normalized.length - uniquePhones.size;
      errors.push(`${duplicateCount} duplicate phone numbers found`);
    }
    
    // Check for invalid phone numbers (after normalization)
    const invalidCount = normalized.filter(p => p.length < 10).length + (rowsWithPhone.length - normalized.length);
    if (invalidCount > 0) {
      errors.push(`${invalidCount} phone numbers are too short (minimum 10 digits)`);
    }
    
    // Check for invalid email formats
    const invalidEmails = data.filter(row => {
      const email = row.email;
      if (!email) return false;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return !emailRegex.test(String(email));
    });
    
    if (invalidEmails.length > 0) {
      errors.push(`${invalidEmails.length} email addresses have invalid format`);
    }
    
    return errors;
  };

  const handleImport = async () => {
    const errors = validateMappedData(mappedData);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setUploading(true);
    try {
      const payload: any = { rows: mappedData };
      if (selectedListId) {
        payload.listId = Number(selectedListId);
      }
      const res = await fetch("/api/tl/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        toast.success("Leads imported successfully");
        onImported();
        handleClose();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Import failed");
      }
    } catch (error) {
      toast.error("Import failed due to network error");
    } finally {
      setUploading(false);
    }
  };

  const renderUploadStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Upload Your File</h3>
        <p className="text-sm text-gray-600">Choose a CSV or Excel file to import your leads</p>
      </div>
      
      <input 
        ref={fileRef} 
        type="file" 
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
        onChange={handleFileUpload}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
      />
      
      <div className="text-xs text-gray-500 text-center">
        <p>Supported formats: CSV, XLSX, XLS</p>
        <p>Maximum file size: 10MB</p>
      </div>
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Map Your Columns</h3>
        <p className="text-sm text-gray-600">Match your file columns to our form fields</p>
      </div>
      
      {validationErrors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          {validationErrors.map((err, index) => (
            <div key={index} className="text-red-700 text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              {err}
            </div>
          ))}
        </div>
      )}
      
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-600">Found {getAvailableColumns().length} columns in your file</span>
        <Button
          onClick={autoMapColumns}
          variant="ghost"
          size="sm"
          className="text-blue-600 hover:text-blue-800"
        >
          Auto-map columns
        </Button>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {FORM_FIELDS.map(field => (
          <div key={field.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{field.label}</span>
                {field.required && <span className="text-red-500 text-xs">*</span>}
              </div>
              <p className="text-xs text-gray-500 mt-1">{field.description}</p>
            </div>
            <select
              value={columnMapping[field.key] || ""}
              onChange={(e) => handleMappingChange(field.key, e.target.value)}
              className="ml-4 border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Select Column --</option>
              {getAvailableColumns().map(col => (
                <option key={col} value={col}>
                  {col} {columnMapping[field.key] === col ? '✓' : ''}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      
      {/* List Selection */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-800 mb-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span className="font-medium">Add to List (Optional)</span>
        </div>
        <div className="flex gap-2">
          <select
            key={`mapping-list-select-${lists.map(l => l.id).join('-')}-${selectedListId}`}
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
            className="flex-1 border border-blue-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">No list</option>
            {lists.map((list) => (
              <option key={list.id} value={String(list.id)}>
                {list.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={() => setShowCreateList(true)}
            variant="outline"
            size="sm"
          >
            New List
          </Button>
        </div>
        {selectedListId && (
          <p className="text-blue-700 text-xs mt-2">
            ✓ Leads will be added to "{lists.find(l => String(l.id) === selectedListId)?.name}"
          </p>
        )}
      </div>
      
      <div className="flex justify-between pt-4">
        <Button
          onClick={() => setStep('upload')}
          variant="ghost"
        >
          ← Back
        </Button>
        <Button
          onClick={proceedToPreview}
          disabled={!columnMapping.phone}
        >
          Continue to Preview →
        </Button>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Preview & Import</h3>
        <p className="text-sm text-gray-600">Review your mapped data before importing</p>
      </div>
      
      {validationErrors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          {validationErrors.map((err, index) => (
            <div key={index} className="text-red-700 text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              {err}
            </div>
          ))}
        </div>
      )}
      
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Ready to Import</span>
        </div>
        <p className="text-green-700 text-sm mt-1">
          {mappedData.length} leads will be imported with the following mapping:
        </p>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-xs text-gray-600 mb-2">Column Mapping Summary:</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(columnMapping).map(([formField, csvColumn]) => (
            <div key={formField} className="flex justify-between">
              <span className="font-medium">{FORM_FIELDS.find(f => f.key === formField)?.label}:</span>
              <span className="text-gray-600">{csvColumn}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* List Selection */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-800 mb-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <span className="font-medium">Add to List (Optional)</span>
        </div>
        <div className="flex gap-2">
          <select
            key={`import-list-select-${lists.map(l => l.id).join('-')}-${selectedListId}`}
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
            className="flex-1 border border-blue-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">No list</option>
            {lists.map((list) => (
              <option key={list.id} value={String(list.id)}>
                {list.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={() => setShowCreateList(true)}
            variant="outline"
            size="sm"
          >
            New List
          </Button>
        </div>
        {selectedListId && (
          <p className="text-blue-700 text-xs mt-2">
            ✓ Leads will be added to "{lists.find(l => String(l.id) === selectedListId)?.name}"
          </p>
        )}
      </div>
      
      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {Object.keys(columnMapping).map(field => (
                <th key={field} className="px-3 py-2 text-left font-medium text-gray-700">
                  {FORM_FIELDS.find(f => f.key === field)?.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mappedData.slice(0, 5).map((row, index) => (
              <tr key={index} className="border-t border-gray-100">
                {Object.keys(columnMapping).map(field => (
                  <td key={field} className="px-3 py-2 text-gray-600">
                    {String(row[field] || '').substring(0, 30)}
                    {String(row[field] || '').length > 30 ? '...' : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {mappedData.length > 5 && (
          <div className="p-2 text-center text-xs text-gray-500 bg-gray-50">
            Showing first 5 rows of {mappedData.length} total rows
          </div>
        )}
      </div>
      
      <div className="flex justify-between pt-4">
        <Button
          onClick={() => setStep('mapping')}
          variant="ghost"
        >
          ← Back to Mapping
        </Button>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleImport}
            disabled={uploading || validationErrors.length > 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {uploading ? "Importing..." : `Import ${mappedData.length} Leads`}
          </Button>
          {/* Import unique-only helper button */}
          {(() => {
            const uniqueValidRows = (() => {
              const seen = new Set<string>();
              const result: any[] = [];
              for (const row of mappedData) {
                const normalized = normalizePhone(row.phone);
                if (!normalized) continue;
                if (normalized.length < 10) continue;
                if (seen.has(normalized)) continue;
                seen.add(normalized);
                result.push({ ...row, phone: normalized });
              }
              return result;
            })();
            const hasIssues = validationErrors.length > 0;
            const canImportUnique = uniqueValidRows.length > 0 && uniqueValidRows.length <= mappedData.length - 1; // only show if dedup reduces count
            const handleImportUnique = async () => {
              setUploading(true);
              try {
                const payload: any = { rows: uniqueValidRows };
                if (selectedListId) {
                  payload.listId = Number(selectedListId);
                }
                const res = await fetch("/api/tl/leads/import", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                if (res.ok) {
                  toast.success("Unique leads imported successfully");
                  onImported();
                  handleClose();
                } else {
                  const errorData = await res.json();
                  toast.error(errorData.error || "Import failed");
                }
              } catch (error) {
                toast.error("Import failed due to network error");
              } finally {
                setUploading(false);
              }
            };
            return hasIssues && canImportUnique ? (
              <Button
                onClick={handleImportUnique}
                disabled={uploading}
                variant="outline"
                title="Imports only unique, valid phone numbers"
              >
                {uploading ? "Importing..." : `Import Unique (${uniqueValidRows.length})`}
              </Button>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
          <DialogDescription className="sr-only">Upload CSV or Excel file to import leads</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          
          {/* Progress Steps */}
          <div className="flex items-center justify-center mt-4">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                1
              </div>
              <div className={`w-12 h-1 mx-2 ${
                step === 'mapping' || step === 'preview' ? 'bg-blue-600' : 'bg-gray-200'
              }`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'mapping' ? 'bg-blue-600 text-white' : step === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                2
              </div>
              <div className={`w-12 h-1 mx-2 ${
                step === 'preview' ? 'bg-blue-600' : 'bg-gray-200'
              }`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                3
              </div>
            </div>
          </div>
          
          <div className="text-center mt-2">
            <span className="text-sm text-gray-600">
              {step === 'upload' && 'Upload File'}
              {step === 'mapping' && 'Map Columns'}
              {step === 'preview' && 'Preview & Import'}
            </span>
          </div>
          
          <div className="mt-6">
            {step === 'upload' && renderUploadStep()}
            {step === 'mapping' && renderMappingStep()}
            {step === 'preview' && renderPreviewStep()}
          </div>
        </div>
      </DialogContent>

      {/* Create New List Modal */}
      <Dialog open={showCreateList} onOpenChange={(open) => { if (!open) { setShowCreateList(false); setNewListName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription className="text-sm text-gray-600">Give your list a name.</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="e.g. Hot leads"
            />
          </div>
          <div className="mt-6 flex items-center justify-end gap-2">
            <Button 
              variant="ghost"
              onClick={() => {
                setShowCreateList(false);
                setNewListName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={createNewList}
              disabled={creatingList || !newListName.trim()}
            >
              {creatingList ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}


