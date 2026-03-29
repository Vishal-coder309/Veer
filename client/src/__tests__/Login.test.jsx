import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('react-hot-toast', () => {
  const t = Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() });
  return { __esModule: true, default: t, error: t.error, success: t.success };
});

jest.mock('../utils/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  authAPI: { login: jest.fn() },
}));

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ login: jest.fn() }) }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: jest.fn() }) }));

// ── Helpers ───────────────────────────────────────────────────────────────────
const getApi = () => require('../utils/api').default;
const getToast = () => require('react-hot-toast').default;

const renderLogin = () => render(<MemoryRouter><Login /></MemoryRouter>);

beforeEach(() => {
  jest.clearAllMocks();
  delete window.location;
  window.location = { href: '' };
  Object.defineProperty(window, 'localStorage', {
    value: { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() },
    writable: true,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Login page', () => {
  it('renders email and password fields', () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with password/i })).toBeInTheDocument();
  });

  it('switches to PIN mode when PIN tab clicked', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /🔢 pin/i }));
    expect(screen.getByRole('button', { name: /sign in with pin/i })).toBeInTheDocument();
  });

  it('fills demo credentials on demo button click', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /click to fill/i }));
    expect(screen.getByDisplayValue('demo@veer.com')).toBeInTheDocument();
  });

  it('submits login request with email and credential', async () => {
    getApi().post.mockResolvedValue({
      data: { token: 'tok123', user: { id: '1', email: 'u@v.com', profileComplete: true } },
    });
    renderLogin();
    await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), 'u@v.com');
    await userEvent.type(screen.getByPlaceholderText(/••••••••/i), 'pass123');
    await userEvent.click(screen.getByRole('button', { name: /sign in with password/i }));
    await waitFor(() => {
      expect(getApi().post).toHaveBeenCalledWith('/auth/login', {
        email: 'u@v.com',
        credential: 'pass123',
        credentialType: 'password',
      });
    });
  });

  it('shows error toast on bad credentials', async () => {
    getApi().post.mockRejectedValue({ response: { data: { message: 'Invalid email or credentials' } } });
    renderLogin();
    await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), 'bad@v.com');
    await userEvent.type(screen.getByPlaceholderText(/••••••••/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in with password/i }));
    await waitFor(() => expect(getToast().error).toHaveBeenCalledWith('Invalid email or credentials'));
  });

  it('shows verify message when email not verified', async () => {
    getApi().post.mockRejectedValue({ response: { data: { action: 'verify', message: 'Email not verified' } } });
    renderLogin();
    await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), 'unverified@v.com');
    await userEvent.type(screen.getByPlaceholderText(/••••••••/i), 'pass');
    await userEvent.click(screen.getByRole('button', { name: /sign in with password/i }));
    await waitFor(() => expect(screen.getByText(/email isn't verified/i)).toBeInTheDocument());
  });
});
