// @ts-nocheck
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock global fetch
const fetchMock = jest.fn();
(global as any).fetch = fetchMock;

// Import the page component
import ReportsPage from '@/app/team-leader/reports/page';

const leadsPayload = {
  success: true,
  rows: [
    { phone: '1234567890', name: 'Alice', email: 'alice@example.com', source: 'CSV', stage: 'Not contacted', score: 10, ownerId: 'A1', createdAt: new Date().toISOString(), lastActivityAt: null, needFollowup: false },
  ],
  total: 1,
};

const usersPayload = { success: true, users: { A1: 'Agent One' } };

const reportsPayload = {
  success: true,
  callsPerLead: [{ leadPhone: '1234567890', started: 2, completed: 1 }],
  assignedVsConverted: [{ ownerId: 'A1', assigned: 5, converted: 2 }],
  avgResponseMs: 5000,
  trends: { daily: [], weekly: [], monthly: [] },
};

function installStableFetch() {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url) => {
    const u = String(url);
    if (u.includes('/api/tl/leads')) return Promise.resolve({ json: async () => leadsPayload });
    if (u.includes('/api/tl/users')) return Promise.resolve({ json: async () => usersPayload });
    if (u.includes('/api/tl/reports')) return Promise.resolve({ json: async () => reportsPayload });
    return Promise.resolve({ json: async () => ({}) });
  });
}

describe('Reports Page', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    installStableFetch();
    // localStorage mock
    const store: Record<string, string> = {};
    jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => ({
      getItem: (k: string) => store[k],
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      key: (i: number) => Object.keys(store)[i] || null,
      length: 0,
    }) as any);
  });

  it('renders and loads data', async () => {
    render(<ReportsPage />);
    expect(screen.getByText('Reports')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    // owner appears in multiple widgets; ensure at least one occurrence exists
    expect(screen.getAllByText('Agent One').length).toBeGreaterThan(0);
    expect(screen.getByText(/Calls per Lead/)).toBeInTheDocument();
  });

  it('opens advanced filters and applies a change', async () => {
    render(<ReportsPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Open advanced filters
    fireEvent.click(screen.getByText('Advanced Filters'));
    const needSelect = screen.getByLabelText('Need Follow-up');
    fireEvent.change(needSelect, { target: { value: 'true' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('saves and applies a quick filter', async () => {
    render(<ReportsPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Save Filter'));

    const input = screen.getByPlaceholderText('e.g., High Priority Leads');
    fireEvent.change(input, { target: { value: 'My Filter' } });
    
    // Click Save Filter inside modal
    const modalSaveBtn = screen.getAllByRole('button', { name: 'Save Filter' }).pop()!;
    fireEvent.click(modalSaveBtn);

    // Quick filter chip should appear
    expect(await screen.findByText('My Filter')).toBeInTheDocument();

    // Apply quick filter
    fireEvent.click(screen.getByText('My Filter'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('paginates', async () => {
    render(<ReportsPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const nextBtn = screen.getByText('Next');
    fireEvent.click(nextBtn);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it('triggers CSV export', async () => {
    render(<ReportsPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Mock anchor click
    const aSpy = jest.spyOn(document, 'createElement');
    fireEvent.click(screen.getByText('Download CSV'));
    expect(aSpy).toHaveBeenCalledWith('a');
    aSpy.mockRestore();
  });
}); 