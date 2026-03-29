import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DailyLog from '../pages/DailyLog';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockCommit = jest.fn();
const mockSkip = jest.fn();
const mockUpdate = jest.fn();
const mockGetToday = jest.fn();

jest.mock('../utils/api', () => ({
  sessionsAPI: {
    getAll: jest.fn().mockResolvedValue({ data: { sessions: [] } }),
  },
  dailyAPI: {
    getToday: () => mockGetToday(),
    commit: () => mockCommit(),
    skip: () => mockSkip(),
    update: (data) => mockUpdate(data),
    getHistory: jest.fn().mockResolvedValue({ data: { history: [] } }),
  },
}));

jest.mock('react-hot-toast', () => {
  const t = jest.fn();
  t.error = jest.fn();
  t.success = jest.fn();
  return { default: t, error: jest.fn(), success: jest.fn() };
});

const renderPage = () => render(<MemoryRouter><DailyLog /></MemoryRouter>);

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('DailyLog — Today\'s Learning', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows commitment prompt when no commitment exists', async () => {
    mockGetToday.mockResolvedValue({ data: { commitment: null, date: '2026-03-29' } });
    renderPage();
    expect(await screen.findByText(/will you study today/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yes, i will study/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rest day/i })).toBeInTheDocument();
  });

  it('shows committed state when commitment is "committed"', async () => {
    mockGetToday.mockResolvedValue({
      data: {
        commitment: {
          id: 'c1', userId: 'u1', date: '2026-03-29',
          status: 'committed', studyMinutes: 60, youtubeLinks: [], notes: '',
        },
        date: '2026-03-29',
      },
    });
    renderPage();
    expect(await screen.findByText(/committed to study today/i)).toBeInTheDocument();
    expect(screen.getByText(/update today's log/i)).toBeInTheDocument();
  });

  it('shows skipped state when commitment is "skipped"', async () => {
    mockGetToday.mockResolvedValue({
      data: {
        commitment: { id: 'c1', userId: 'u1', date: '2026-03-29', status: 'skipped', studyMinutes: 0, youtubeLinks: [], notes: '' },
        date: '2026-03-29',
      },
    });
    renderPage();
    expect(await screen.findByText(/rest day marked/i)).toBeInTheDocument();
    expect(screen.getByText(/motivation email has been sent/i)).toBeInTheDocument();
  });

  it('calls commit API when "Yes I will study" is clicked', async () => {
    mockGetToday.mockResolvedValue({ data: { commitment: null, date: '2026-03-29' } });
    mockCommit.mockResolvedValue({
      data: { commitment: { id: 'c1', status: 'committed', studyMinutes: 0, youtubeLinks: [], notes: '' } },
    });
    renderPage();
    const btn = await screen.findByRole('button', { name: /yes, i will study/i });
    await userEvent.click(btn);
    await waitFor(() => expect(mockCommit).toHaveBeenCalledTimes(1));
  });

  it('calls skip API when "Rest day" is clicked', async () => {
    mockGetToday.mockResolvedValue({ data: { commitment: null, date: '2026-03-29' } });
    mockSkip.mockResolvedValue({
      data: { commitment: { id: 'c1', status: 'skipped', studyMinutes: 0, youtubeLinks: [], notes: '' } },
    });
    renderPage();
    const btn = await screen.findByRole('button', { name: /rest day/i });
    await userEvent.click(btn);
    await waitFor(() => expect(mockSkip).toHaveBeenCalledTimes(1));
  });

  it('saves log with study minutes when form is submitted', async () => {
    mockGetToday.mockResolvedValue({
      data: {
        commitment: { id: 'c1', status: 'committed', studyMinutes: 0, youtubeLinks: [], notes: '' },
        date: '2026-03-29',
      },
    });
    mockUpdate.mockResolvedValue({
      data: { commitment: { id: 'c1', status: 'committed', studyMinutes: 120, youtubeLinks: [], notes: '' } },
    });
    renderPage();

    // Click 2h preset
    const twoHr = await screen.findByRole('button', { name: '2h' });
    await userEvent.click(twoHr);

    // Save
    const saveBtn = screen.getByRole('button', { name: /save today's log/i });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ studyMinutes: 120 })
      );
    });
  });

  it('adds and removes YouTube links', async () => {
    mockGetToday.mockResolvedValue({
      data: {
        commitment: { id: 'c1', status: 'committed', studyMinutes: 0, youtubeLinks: [], notes: '' },
        date: '2026-03-29',
      },
    });
    renderPage();

    const input = await screen.findByPlaceholderText(/youtube\.com/i);
    await userEvent.type(input, 'https://youtube.com/watch?v=dQw4w9WgXcQ');
    const addBtn = screen.getByRole('button', { name: /^add$/i });
    await userEvent.click(addBtn);

    expect(await screen.findByText('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBeInTheDocument();

    // Remove it
    const removeBtn = screen.getByText('×');
    await userEvent.click(removeBtn);
    await waitFor(() => {
      expect(screen.queryByText('https://youtube.com/watch?v=dQw4w9WgXcQ')).not.toBeInTheDocument();
    });
  });
});
